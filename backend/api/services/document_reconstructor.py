"""One source-first import coordinator: analysis, preview, then atomic confirmation.

Geometry adapters own extraction. Source data never becomes a prompt or an
invented product, and private source files never enter the public Media alias.
"""
import copy
import hashlib
import io
import json
import logging
import math
import os
import re
from datetime import timedelta
from pathlib import Path
from urllib.parse import urlsplit

from django.conf import settings
from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.files.base import ContentFile
from django.db import transaction
from django.utils import timezone
from PIL import Image
from rest_framework.exceptions import NotFound, ValidationError

from api.models import DocumentImport, DocumentImportAsset, StudioCatalog, CatalogSpread, ChatThread
from api.services.brand_intelligence import (assert_organization_access, get_brand_for_user,
    visible_organizations, BrandContextResolver, snapshot_hash)

logger = logging.getLogger(__name__)
MODES = {'preserve', 'editable', 'redesign'}
RENDER_ASSET_KINDS = {'source_snapshot', 'raster_fallback', 'element_appearance', 'image'}


def normalize_import_mode(mode):
    if not isinstance(mode, str):
        raise ValidationError({'mode': 'Escolha preservar, reconstruir ou redesenhar.'})
    mode = {'faithful': 'preserve', 'preserve_original': 'preserve', 'editable_reconstruction': 'editable'}.get(mode, mode)
    if mode not in MODES:
        raise ValidationError({'mode': 'Escolha preservar, reconstruir ou redesenhar.'})
    return mode


def import_quality_passed(metadata):
    quality = metadata.get('quality', {}) if isinstance(metadata, dict) else {}
    return isinstance(quality, dict) and quality.get('passed') is True and quality.get('sourceRetained') is True


def _render_fields(value, fields):
    return {key: copy.deepcopy(value[key]) for key in fields if key in value}


def _public_snapshot(snapshot):
    return _render_fields(snapshot, ('url', 'hash', 'assetId', 'mediaId', 'widthPixels', 'heightPixels')) if isinstance(snapshot, dict) else None


def _visible_rectangle(value):
    if not isinstance(value, dict):
        return False
    numbers = [value.get(key) for key in ('x', 'y', 'width', 'height')]
    if not all(type(number) in (int, float) and math.isfinite(number) for number in numbers):
        return False
    x, y, width, height = numbers
    return x >= 0 and y >= 0 and width > 0 and height > 0 and x + width <= 1.001 and y + height <= 1.001


def public_import_page(page):
    """Publish render data, never hidden PDF text, source boxes or extraction evidence."""
    if not isinstance(page, dict):
        return None
    original = page.get('documentPage')
    if not isinstance(original, dict):
        # Authored pages have no imported evidence to expose. Use the normal runtime projection.
        return _render_fields(page, ('id','pageNumber','pageOrigin','type','contentRole','renderMode','title','subtitle','content','quote','label','backgroundColor','textColor','accentColor','folio','products','blocks','safeArea','composition','overlays','editorialImage'))
    document = _render_fields(original, ('pageNumber', 'width', 'height', 'unit'))
    document.update(sourceSnapshot=_public_snapshot(original.get('sourceSnapshot')),
                    visibility='source_only', elements=[])
    is_generative = page.get('renderMode') == 'generative'
    from api.services.imported_text_resolver import safe_element, valid_style_revision
    candidates = [element for element in original.get('elements', []) if safe_element(element)]
    reconstructs = (not is_generative and page.get('sourceVisibility') != 'source_only'
                    and original.get('visibility') in ('hybrid', 'reconstructed')
                    and bool(original.get('fallbackSnapshot')) and bool(candidates))
    if reconstructs:
        document['visibility'] = original['visibility']
        document['fallbackSnapshot'] = _public_snapshot(original.get('fallbackSnapshot'))
        for element in candidates:
            projected = _render_fields(element, ('id', 'type', 'editable', 'edited', 'x', 'y', 'width', 'height',
                'resolvedFont', 'fontSize', 'fontWeight', 'fontStyle', 'color', 'zIndex'))
            if valid_style_revision(element.get('styleRevision')):
                projected['styleRevision'] = copy.deepcopy(element['styleRevision'])
            if element.get('edited') is True or 'styleRevision' in projected:
                projected.update(_render_fields(element, ('text', 'content')))
            if element.get('appearance'):
                appearance = _render_fields(element['appearance'], ('x', 'y', 'width', 'height'))
                appearance['asset'] = _public_snapshot(element['appearance'].get('asset'))
                projected['appearance'] = appearance
            if element.get('snapshot'):
                projected['snapshot'] = _public_snapshot(element['snapshot'])
            document['elements'].append(projected)
    result = _render_fields(page, ('id', 'pageNumber', 'renderMode', 'pageWidth', 'pageHeight', 'sourceUnit','pageOrigin','sourcePageNumber','derivedFromPageId','overlays'))
    result['documentPage'] = document
    if is_generative:
        result.update(_render_fields(page, ('type', 'contentRole', 'backgroundColor', 'textColor',
                                           'accentColor', 'folio', 'safeArea')))
        block_fields = ('id', 'type', 'role', 'x', 'y', 'width', 'height', 'rotation', 'opacity', 'zIndex',
            'alignment', 'fontRole', 'fontFamily', 'fontSize', 'fontWeight', 'letterSpacing', 'lineHeight',
            'textTransform', 'colorToken', 'content', 'productId', 'imageUrl', 'cropMode', 'bleed',
            'allowOverlap', 'intentionalCrop', 'marginExempt')
        result['blocks'] = [_render_fields(block, block_fields) for block in page.get('blocks', []) if isinstance(block, dict)]
        # Only commercial fields required by actually rendered product blocks cross
        # the public boundary; technical candidate evidence remains private.
        required = {}
        for block in result['blocks']:
            product_id = block.get('productId')
            field = (block['type'] if block.get('type') in ('price', 'sku') else
                     'name' if block.get('role') == 'product_name' else
                     'description' if block.get('role') == 'product_description' else
                     'image' if block.get('type') == 'product_image' else None)
            if product_id is not None and field:
                required.setdefault(str(product_id), {'id'}).add(field)
        result['products'] = [_render_fields(product, required[str(product['id'])])
                              for product in page.get('products', []) if isinstance(product, dict)
                              and str(product.get('id')) in required]
    else:
        result['renderMode'] = 'document'
        result['products'] = []
    return result


def public_import_asset_ids(catalog):
    """A shared job does not make unused/off-crop extracted images public."""
    identifiers = set()

    def inspect(value):
        if isinstance(value, dict):
            for key, child in value.items():
                if key in ('url', 'imageUrl') and isinstance(child, str):
                    try:
                        match = re.fullmatch(r'/api/v2/studio/catalogs/import-document/assets/([a-fA-F0-9-]{36})/', urlsplit(child).path)
                    except ValueError:
                        match = None
                    if match:
                        identifiers.add(match.group(1).lower())
                inspect(child)
        elif isinstance(value, list):
            for child in value:
                inspect(child)

    for spread in catalog.spreads.all():
        for elements in (spread.left_page_elements, spread.right_page_elements):
            if isinstance(elements, list) and elements:
                inspect(public_import_page(elements[0]))
    return identifiers


class DocumentReconstructorService:
    @staticmethod
    def get_import(user, identifier, write=False, allow_expired=False):
        try:
            job = DocumentImport.objects.select_related('organization', 'catalog', 'brand').filter(
                pk=identifier, organization__in=visible_organizations(user)).first()
        except (DjangoValidationError, ValueError, TypeError):
            job = None
        if job is None:
            raise NotFound('Importação não encontrada.')
        assert_organization_access(user, job.organization, write=write)
        if job.status != 'confirmed' and job.expires_at <= timezone.now() and not allow_expired:
            raise ValidationError({'import_id': 'Esta prévia expirou. Analise o documento novamente.'})
        return job

    @staticmethod
    def _asset(job, raw, filename, kind):
        if kind not in RENDER_ASSET_KINDS | {'source'}:
            raise ValidationError('Tipo de ativo de importação inválido.')
        width = height = None
        if kind in RENDER_ASSET_KINDS:
            with Image.open(io.BytesIO(raw)) as image:
                image.verify()
                if image.format != 'PNG' or image.width * image.height > 12_000_000:
                    raise ValidationError('A imagem da página excede os limites de importação.')
                width, height = image.size
        clean_name = re.sub(r'[^a-zA-Z0-9_.-]', '_', os.path.basename(filename))[-150:] or 'source'
        asset = DocumentImportAsset.objects.create(
            document_import=job, file=ContentFile(raw, name=f'{job.pk}-{clean_name}'), kind=kind,
            source_hash=hashlib.sha256(raw).hexdigest(), width_pixels=width, height_pixels=height)
        return asset, {'url': f'/api/v2/studio/catalogs/import-document/assets/{asset.pk}/',
                       'mediaId': str(asset.pk), 'assetId': str(asset.pk), 'hash': asset.source_hash,
                       'widthPixels': width, 'heightPixels': height}

    @classmethod
    def analyze_file(cls, file_bytes, filename, user, organization, content_type='application/pdf',
                     title=None, mode='preserve', brand=None, brief=''):
        mode = normalize_import_mode(mode)
        if title is not None and not isinstance(title, str):
            raise ValidationError({'title': 'Informe um título em texto.'})
        assert_organization_access(user, organization, write=True)
        from api.services.document_preflight import DocumentImportError, validate_source_file
        validate_source_file(file_bytes, filename, content_type=content_type)
        if brand:
            assert_organization_access(user, brand.organization, write=True)
            if brand.organization_id != organization.pk or brand.status != 'active':
                raise ValidationError({'brand_id': 'Selecione uma marca ativa desta organização.'})
        created_files = []
        try:
            with transaction.atomic():
                # Keep the UUID in memory while the isolated worker parses and
                # renders. SQLite must not hold a write lock for that entire time.
                job = DocumentImport(
                    organization=organization, created_by=user, source_fingerprint=hashlib.sha256(file_bytes).hexdigest(),
                    filename=os.path.basename(filename)[:255], title=(title or Path(filename).stem).strip()[:255], mode=mode,
                    expires_at=timezone.now() + timedelta(hours=getattr(settings, 'DOCUMENT_IMPORT_PREVIEW_TTL_HOURS', 24)))

                def sink(raw, name, kind):
                    if job._state.adding:
                        job.save(force_insert=True)
                    asset, data = cls._asset(job, raw, name, kind)
                    created_files.append(asset.file)
                    return data

                # The adapter isolates untrusted PDF parsing/rendering and only sinks
                # files once all accepted pages have a faithful visual snapshot.
                from api.services.pdf_import_adapter import PdfImportAdapter
                document = PdfImportAdapter.analyze(file_bytes, filename, sink)
                if not document.get('pages') or document.get('pageCount') != len(document['pages']):
                    raise DocumentImportError('source_not_preserved', 'Não foi possível preservar todas as páginas.', 422)
                cls._validate_ir_assets(job, document)
                source, _ = cls._asset(job, file_bytes, filename, 'source')
                created_files.append(source.file)
                job.source_asset = source
                job.document_ir = document
                job.report = copy.deepcopy(document.get('report', {}))
                job.status = 'ready'
                cls.prepare_preview(job, mode, brand=brand, brief=brief)
                job.save()
                logger.info('document_import analyzed id=%s fingerprint=%s pages=%s adapter=%s mode=%s',
                            job.pk, job.source_fingerprint, len(document['pages']), document.get('adapter'), mode)
                return job
        except Exception:
            for file in created_files:
                try:
                    file.storage.delete(file.name)
                except OSError:
                    logger.warning('document_import temporary asset cleanup failed')
            raise

    @staticmethod
    def _validate_ir_assets(job, document):
        stored = {str(asset.pk): asset for asset in job.assets.all()}
        for page in document['pages']:
            snapshot = page.get('sourceSnapshot') or {}
            asset = stored.get(str(snapshot.get('assetId') or snapshot.get('mediaId')))
            if asset is None or asset.kind != 'source_snapshot' or snapshot.get('hash') != asset.source_hash:
                raise ValidationError('A página não possui uma representação original válida.')
            if not all(type(page.get(key)) in (int, float) and page[key] > 0 for key in ('width', 'height')):
                raise ValidationError('A geometria da página é inválida.')

    @staticmethod
    def _document_pages(document, mode):
        pages = []
        for source in document['pages']:
            page = copy.deepcopy(source)
            if mode == 'preserve':
                page['visibility'] = 'source_only'
            elif page.get('visibility') not in ('reconstructed', 'hybrid'):
                page['visibility'] = 'source_only'
            pages.append({'id': f"import-page-{page['pageNumber']}", 'pageNumber': page['pageNumber'],
                          'renderMode': 'document', 'documentPage': page, 'pageWidth': page['width'],
                          'pageHeight': page['height'], 'sourceUnit': 'pt', 'products': []})
        return pages

    @classmethod
    def prepare_preview(cls, job, mode, brand=None, brief=''):
        mode = normalize_import_mode(mode)
        if not isinstance(brief, str) or len(brief) > 20000:
            raise ValidationError({'brief': 'Informe um briefing em texto com até 20000 caracteres.'})
        if job.status == 'confirmed':
            raise ValidationError('A importação já foi confirmada.')
        if brand and (brand.organization_id != job.organization_id or brand.status != 'active'):
            raise ValidationError({'brand_id': 'Selecione uma marca ativa da mesma organização.'})
        document = job.document_ir
        job.mode = mode
        job.brand = brand
        job.brand_snapshot = BrandContextResolver.resolve(brand) if brand else {}
        job.brand_snapshot_hash = snapshot_hash(job.brand_snapshot) if brand else ''
        job.previews = cls._document_pages(document, mode)
        job.report = copy.deepcopy(document.get('report', {}))
        if mode == 'redesign':
            from api.ai.catalog_builder import generate_catalog_from_gemini
            kwargs = {'prompt': brief.strip() or 'Redesenhar a composição deste documento preservando integralmente os fatos da origem.',
                      'products': copy.deepcopy(document.get('candidates', [])), 'source_document': copy.deepcopy(document)}
            if brand:
                kwargs['brand_context'] = copy.deepcopy(job.brand_snapshot)
            try:
                result = generate_catalog_from_gemini(**kwargs)
                if not isinstance(result, dict) or not isinstance(result.get('qualityGate', {}), dict):
                    raise ValueError('invalid_redesign_result')
            except Exception:
                # A design failure never rolls back the faithful source capture.
                # Exceptions may contain document text: log only the job identifier.
                logger.warning('document_import redesign failed id=%s', job.pk)
                result = {'qualityGate': {'passed': False, 'publishable': False,
                          'status': 'needs_review', 'errors': ['REDESIGN_UNAVAILABLE']}}
            gate = result.get('qualityGate') or {}
            job.report['redesignQualityGate'] = gate
            generated = result.get('pages') or []
            approved = gate.get('passed') is True and gate.get('publishable') is True
            from api.ai.requirement_contract import RequirementContract
            from api.ai.source_context import SourceIntegrityGuard
            from api.ai.design_grammar import validate_runtime_block
            try:
                safe_source = (not SourceIntegrityGuard.verify(RequirementContract(source_document=copy.deepcopy(document)), result)
                               and all(validate_runtime_block(block)[0] for page in generated for block in page.get('blocks', [])))
            except (ValueError, TypeError, KeyError, AttributeError):
                safe_source = False
            if safe_source and len(generated) == len(document['pages']):
                for generated_page, source in zip(generated, document['pages']):
                    generated_page['documentPage'] = copy.deepcopy(source)
                    generated_page['pageWidth'] = source['width']
                    generated_page['pageHeight'] = source['height']
                    generated_page['sourceUnit'] = 'pt'
                    generated_page['sourceSnapshot'] = copy.deepcopy(source['sourceSnapshot'])
                job.previews = generated
            if not approved or not safe_source or len(generated) != len(document['pages']):
                job.report['redesignFallback'] = True
                job.report['warnings'] = list(job.report.get('warnings', [])) + ['O redesenho requer revisão; a representação original foi preservada.']
        job.report['mode'] = mode
        job.report['pagesPreserved'] = len(document['pages'])
        job.report['commercialValuesInvented'] = 0
        geometry_valid = all(page.get('quality', {}).get('geometryValidated') is True for page in document['pages'])
        has_editable = any(page.get('quality', {}).get('editableCount', 0) > 0 for page in document['pages'])
        job.report['quality'] = {'passed': geometry_valid, 'sourceRetained': True, 'pageCountRetained': True,
                                 'geometryRetained': geometry_valid,
                                 'status': ('faithful' if mode == 'preserve' else ('hybrid' if has_editable else 'preserved'))
                                           if geometry_valid else 'needs_review'}
        if mode == 'redesign' and job.report.get('redesignFallback'):
            job.report['quality']['status'] = 'needs_review'
            job.report['quality']['passed'] = False
        return job

    @classmethod
    def validate_catalog_source(cls, catalog):
        """Sharing certifies the captured preview, including its private asset scope."""
        try:
            job = catalog.source_import
        except DocumentImport.DoesNotExist:
            raise ValidationError({'share_import': 'O histórico de origem está indisponível.'})
        if (job.status != 'confirmed' or job.organization_id != catalog.organization_id
                or catalog.import_metadata.get('sourceFingerprint') != job.source_fingerprint):
            raise ValidationError({'share_import': 'A origem do catálogo é inválida.'})
        cls._validate_ir_assets(job, job.document_ir)
        pages = []
        for spread in catalog.spreads.order_by('spread_index'):
            for values in (spread.left_page_elements, spread.right_page_elements):
                if values:
                    if not isinstance(values, list) or len(values) != 1 or not isinstance(values[0], dict):
                        raise ValidationError({'share_import': 'A composição deve ser revisada antes de compartilhar.'})
                    pages.append(values[0])
        from api.services.catalog_page_origin import validate_sequence
        validate_sequence(catalog, pages)
        if catalog.total_pages != len(pages):
            raise ValidationError({'share_import': 'A sequência atual deve ser salva antes de compartilhar.'})
        for position, page in enumerate(pages):
            cls.validate_page_update(catalog, [copy.deepcopy(page)], position)
        return True

    @staticmethod
    def validate_page_update(catalog, elements, source_index):
        """Editable text is a customer revision; retained source evidence is immutable."""
        if not catalog.import_metadata:
            if not isinstance(elements,list) or any(not isinstance(page,dict) or page.get('pageOrigin') not in (None,'catana_authored') for page in elements):
                raise ValidationError({'code':'invalid_structure'})
            return
        job = catalog.source_import
        if (job.organization_id != catalog.organization_id
                or catalog.import_metadata.get('sourceFingerprint', job.source_fingerprint) != job.source_fingerprint):
            raise ValidationError({'documentPage': 'A origem não pertence a este catálogo.'})
        originals = job.previews
        if not originals and isinstance(job.document_ir.get('pages'), list):
            originals = DocumentReconstructorService._document_pages(job.document_ir, job.mode)
        if not originals:
            raise ValidationError({'code': 'reanalyze_required', 'documentPage': 'Atualizar editabilidade antes de salvar.'})
        from api.services.catalog_page_origin import normalize_page, origin, source_number
        if not elements:
            return  # Sequence removals are validated atomically by the bulk endpoint.
        if not isinstance(elements, list) or len(elements) != 1 or not isinstance(elements[0], dict):
            raise ValidationError({'code': 'invalid_structure'})
        requested = elements[0]
        if origin(requested, catalog) == 'catana_authored':
            normalize_page(requested, catalog)  # Cannot claim any source evidence.
            if requested.get('renderMode') not in (None, 'legacy', 'generative'):
                raise ValidationError({'code': 'invalid_structure'})
            from api.ai.design_grammar import is_safe_image_url
            if requested.get('editorialImage') and not is_safe_image_url(requested['editorialImage']):
                raise ValidationError({'code': 'invalid_structure'})
            from api.ai.design_grammar import validate_runtime_block
            blocks=requested.get('blocks',[])
            if not isinstance(blocks,list) or len(blocks)>500 or any(not validate_runtime_block(b)[0] for b in blocks):
                raise ValidationError({'code':'invalid_structure'})
            # Bounded runtime JSON; imported evidence cannot hide in authored pages.
            if len(json.dumps(requested)) > 100000:
                raise ValidationError({'code': 'invalid_structure'})
            return
        normalized_origin = normalize_page(requested, catalog)
        number = source_number(normalized_origin)
        original = originals[number - 1]
        for key in ('id',):
            if origin(requested, catalog) == 'imported_source' and requested.get(key) != original.get(key):
                raise ValidationError({'code': 'source_integrity_violation'})
        elements[0].update(normalized_origin)
        for field in ('pageWidth', 'pageHeight', 'sourceUnit', 'sourceSnapshot'):
            if requested.get(field) != original.get(field):
                raise ValidationError({'documentPage': 'A geometria e os ativos de origem são imutáveis.'})
        # Source-derived product facts and bound runtime blocks remain authoritative.
        from api.ai.commercial_guard import CommercialIntegrityGuard
        if not CommercialIntegrityGuard.verify_document_commercial_integrity(original.get('products',[]),[requested])[0]:
            raise ValidationError({'code':'commercial_integrity_blocked'})
        before, after = original.get('documentPage'), requested.get('documentPage')
        if not isinstance(after, dict) or not isinstance(before, dict):
            raise ValidationError({'documentPage': 'A página original deve acompanhar a composição.'})
        # Render-only clients can submit safe visible revisions without private PDF evidence.
        # Compare their entire projection, then merge bounded customer revisions
        # into the retained private source; never replace original font metadata.
        projection = public_import_page(original)['documentPage']
        public_ids = [item['id'] for item in projection['elements']]
        requested_ids = [item.get('id') for item in after.get('elements', []) if isinstance(item, dict)]
        if requested_ids == public_ids and after.get('elements') and not any(
                'sourceVisible' in item for item in after['elements']):
            public_normalized = copy.deepcopy(after)
            revisions, style_revisions = {}, {}
            private_by_id = {item['id']: item for item in before['elements']}
            for expected, revision in zip(projection['elements'], public_normalized['elements']):
                identity = revision['id']
                if 'provenance' in revision:
                    if revision.pop('provenance') != {'sourceText': private_by_id[identity].get('text')}:
                        raise ValidationError({'documentPage': 'A origem do texto é imutável.'})
                if 'styleRevision' in revision:
                    from api.services.imported_text_resolver import valid_style_revision
                    style = revision.pop('styleRevision')
                    if not valid_style_revision(style):
                        raise ValidationError({'documentPage': 'Somente o peso tipográfico suportado pode ser revisado.'})
                    style_revisions[identity] = style
                if 'text' in revision:
                    if revision.get('edited') is not True and revision['text'] != private_by_id[identity].get('text'):
                        raise ValidationError({'documentPage': 'Confirme explicitamente a edição de texto.'})
                    revisions[identity] = revision.get('text')
                    revision.pop('text', None)
                    revision.pop('content', None)
                    revision.pop('edited', None)
                if revision != expected:
                    raise ValidationError({'documentPage': 'A projeção de origem é imutável.'})
            if public_normalized != projection:
                raise ValidationError({'documentPage': 'A geometria de origem é imutável.'})
            after = copy.deepcopy(before)
            for element in after['elements']:
                if element['id'] in revisions:
                    replacement = revisions[element['id']]
                    element.update(text=replacement, edited=replacement != element.get('text'))
                if element['id'] in style_revisions:
                    element['styleRevision'] = style_revisions[element['id']]
            requested['documentPage'] = after
        normalized = copy.deepcopy(after)
        before_elements, after_elements = before.get('elements', []), normalized.get('elements', [])
        if not isinstance(after_elements, list) or len(after_elements) != len(before_elements):
            raise ValidationError({'documentPage': 'Os elementos e a proveniência de origem são imutáveis.'})
        for source, edited in zip(before_elements, after_elements):
            if not isinstance(edited, dict):
                raise ValidationError({'documentPage': 'Elemento inválido.'})
            if 'styleRevision' in edited:
                from api.services.imported_text_resolver import safe_element, protected_text, valid_style_revision, PROTECTED_STYLE_ROLES
                style = edited.pop('styleRevision')
                if (not valid_style_revision(style) or before.get('visibility') == 'source_only'
                        or not safe_element(source) or not isinstance(source.get('text'), str)
                        or source.get('role') in PROTECTED_STYLE_ROLES
                        or not isinstance(edited.get('text'), str) or protected_text(source.get('text', ''), source)
                        or protected_text(edited.get('text', ''), source)):
                    raise ValidationError({'documentPage': 'O estilo não é editável ou possui dados comerciais protegidos.'})
            if edited.get('text') != source.get('text'):
                if source.get('type') != 'text' or source.get('editable') is not True or edited.get('edited') is not True or not isinstance(edited.get('text'), str):
                    raise ValidationError({'documentPage': 'Somente textos editáveis podem ser alterados explicitamente.'})
                if len(edited['text']) > 20000:
                    raise ValidationError({'documentPage': 'O texto editado excede o limite permitido.'})
                from api.services.imported_text_resolver import safe_element, protected_text
                if (before.get('visibility') == 'source_only' or not safe_element(source)
                        or protected_text(source.get('text', ''), source) or protected_text(edited['text'])):
                    raise ValidationError({'documentPage': 'O texto não é editável ou possui dados comerciais protegidos.'})
                edited['text'] = source.get('text')
            edited.pop('edited', None)
        if normalized != before:
            raise ValidationError({'documentPage': 'A representação original e sua proveniência são imutáveis.'})

    @classmethod
    def reconstruction_revision(cls, catalog):
        values = [(s.spread_index, s.left_page_elements, s.right_page_elements)
                  for s in catalog.spreads.order_by('spread_index')]
        return hashlib.sha256(json.dumps(values, sort_keys=True, ensure_ascii=False).encode()).hexdigest()

    @classmethod
    def _reconcile_reanalysis(cls, catalog, source, prepared):
        """Map retained revisions to proven fresh source objects, never to browser evidence."""
        from api.services.catalog_page_origin import catalog_pages, origin, source_number
        from api.services.imported_text_resolver import safe_element, protected_text, valid_style_revision, PROTECTED_STYLE_ROLES
        originals = source.previews
        if not originals and isinstance(source.document_ir.get('pages'), list):
            originals = cls._document_pages(source.document_ir, source.mode)
        fresh = prepared.previews
        review = {'preservedTextEdits': 0, 'preservedStyleEdits': 0,
                  'preservedAuthoredPages': 0, 'conflicts': [], 'preserveEdits': True}
        pages = []

        def conflict(page, code, element=None):
            review['conflicts'].append({'pageNumber': page.get('pageNumber'), 'code': code,
                                        **({'elementId': element.get('id')} if element else {})})

        def identity(element):
            provenance = element.get('provenance') or {}
            return (element.get('type'), provenance.get('sourcePage'), provenance.get('sourceElement'),
                    provenance.get('sourceTextHash'), provenance.get('sourceBoundingBox'),
                    *[element.get(key) for key in ('x', 'y', 'width', 'height')])

        if originals and len(originals) != len(fresh):
            review['conflicts'].append({'code': 'page_count_mismatch'})
        for current in catalog_pages(catalog):
            kind = origin(current, catalog)
            if kind == 'catana_authored':
                pages.append(copy.deepcopy(current))
                review['preservedAuthoredPages'] += 1
                continue
            number = source_number(current)
            if type(number) is not int or not 1 <= number <= len(fresh):
                conflict(current, 'source_page_unavailable')
                pages.append(copy.deepcopy(current))
                continue
            replacement = copy.deepcopy(fresh[number - 1])
            before = originals[number - 1] if originals and number <= len(originals) else None
            current_doc = current.get('documentPage') or {}
            fresh_doc = replacement['documentPage']
            before_doc = (before or {}).get('documentPage') or {}
            if (any(current_doc.get(key) != fresh_doc.get(key) for key in ('width', 'height', 'unit'))
                    or current_doc.get('sourceSnapshot', {}).get('hash') != fresh_doc.get('sourceSnapshot', {}).get('hash')
                    or current.get('sourceFingerprint', source.source_fingerprint) != source.source_fingerprint
                    or current.get('sourceImportId', str(source.pk)) != str(source.pk)):
                conflict(current, 'source_identity_changed')
            if current.get('renderMode') == 'generative':
                conflict(current, 'redesign_requires_separate_review')
            old_elements = {element.get('id'): element for element in before_doc.get('elements', []) if isinstance(element, dict)}
            projected = public_import_page(before) if before else None
            projected_elements = {element['id']: element for element in (projected or {}).get('documentPage', {}).get('elements', [])}
            current_elements = current_doc.get('elements', [])
            if not isinstance(current_elements, list):
                conflict(current, 'source_revision_unavailable')
                current_elements = []
            current_ids = [element.get('id') for element in current_elements if isinstance(element, dict)]
            if before and (len(current_ids) != len(set(current_ids)) or set(current_ids) not in (set(old_elements), set(projected_elements))):
                conflict(current, 'source_elements_changed')
            for element in current_elements:
                if not isinstance(element, dict):
                    conflict(current, 'source_revision_unavailable')
                    continue
                original = old_elements.get(element.get('id'))
                has_text_edit = element.get('edited') is True
                has_style_edit = element.get('styleRevision') is not None
                if original is None:
                    # Without a retained baseline, even an absent "edited" flag
                    # cannot establish that replacing persisted content is safe.
                    conflict(current, 'source_revision_unavailable', element)
                    continue
                # A stored render projection is accepted only when its immutable
                # fields exactly match the retained private source projection.
                comparison = copy.deepcopy(element)
                for key in ('text', 'content', 'edited', 'styleRevision'):
                    comparison.pop(key, None)
                private = {key: value for key, value in original.items() if key not in ('text', 'content', 'edited', 'styleRevision')}
                public = {key: value for key, value in projected_elements.get(element.get('id'), {}).items()
                          if key not in ('text', 'content', 'edited', 'styleRevision')}
                if comparison != private:
                    provenance = comparison.pop('provenance', None)
                    if comparison != public or provenance not in (None, {'sourceText': original.get('text')}):
                        conflict(current, 'source_evidence_changed', element)
                        continue
                text = element.get('text', original.get('text'))
                if not has_text_edit and text != original.get('text'):
                    conflict(current, 'unconfirmed_text_revision', element)
                    continue
                has_text_edit = has_text_edit and text != original.get('text')
                if not has_text_edit and not has_style_edit:
                    continue
                if ((has_text_edit and (not isinstance(text, str) or len(text) > 20000))
                        or (has_style_edit and not valid_style_revision(element['styleRevision']))):
                    conflict(current, 'invalid_revision', element)
                    continue
                evidence = original.get('provenance') or {}
                if (not isinstance(original.get('text'), str) or not evidence.get('sourceElement') or not evidence.get('sourceTextHash')
                        or evidence.get('sourceTextHash') != hashlib.sha256(original.get('text', '').encode()).hexdigest()):
                    conflict(current, 'source_revision_unavailable', element)
                    continue
                matches = [candidate for candidate in fresh_doc.get('elements', [])
                           if isinstance(candidate, dict) and identity(candidate) == identity(original)]
                if len(matches) != 1:
                    conflict(current, 'edited_target_mapping_conflict', element)
                    continue
                target = matches[0]
                if (fresh_doc.get('visibility') == 'source_only' or not safe_element(target)
                        or has_style_edit and target.get('role') in PROTECTED_STYLE_ROLES
                        or protected_text(original.get('text', ''), original)
                        or protected_text(text or '', target)):
                    conflict(current, 'edited_target_not_editable', element)
                    continue
                if has_text_edit:
                    target.update(text=text, edited=True)
                    if 'content' in target:
                        target['content'] = text
                    review['preservedTextEdits'] += 1
                if has_style_edit:
                    target['styleRevision'] = copy.deepcopy(element['styleRevision'])
                    review['preservedStyleEdits'] += 1
            # Preserve current ordering, derived page IDs, and separately authored
            # composition. Only the proven reconstruction and source link change.
            page = copy.deepcopy(current)
            page.update(documentPage=fresh_doc, pageWidth=replacement['pageWidth'],
                        pageHeight=replacement['pageHeight'], sourceUnit=replacement['sourceUnit'],
                        sourceImportId=str(prepared.pk), sourceFingerprint=prepared.source_fingerprint,
                        sourcePageNumber=number,
                        sourcePageFingerprint=hashlib.sha256(json.dumps(prepared.document_ir['pages'][number - 1], sort_keys=True, ensure_ascii=False).encode()).hexdigest())
            if 'sourceVisibility' in page:
                page['sourceVisibility'] = fresh_doc['visibility']
            pages.append(page)
        review['canConfirm'] = not review['conflicts']
        return pages, review

    @classmethod
    def reanalyze_catalog(cls, catalog, user, preserve_edits=True):
        """Prepare a separate preview from retained bytes; never overwrite customer edits."""
        assert_organization_access(user, catalog.organization, write=True)
        if preserve_edits is not True:
            raise ValidationError({'code': 'preservation_required', 'error': 'A atualização deve preservar as edições existentes.'})
        try:
            source = catalog.source_import
        except DocumentImport.DoesNotExist:
            raise ValidationError({'code': 'source_unavailable', 'error': 'A origem preservada não está disponível.'})
        if (source.organization_id != catalog.organization_id or source.status != 'confirmed'
                or catalog.import_metadata.get('sourceFingerprint', source.source_fingerprint) != source.source_fingerprint
                or not source.source_asset):
            raise ValidationError({'code': 'source_unavailable'})
        from api.services.document_preflight import MAX_SOURCE_BYTES
        try:
            with source.source_asset.file.open('rb') as file:
                raw = file.read(MAX_SOURCE_BYTES + 1)
        except OSError:
            raise ValidationError({'code': 'source_unavailable'})
        if hashlib.sha256(raw).hexdigest() != source.source_fingerprint:
            raise ValidationError({'code': 'source_unavailable', 'error': 'A origem preservada não passou pela verificação.'})
        revision = cls.reconstruction_revision(catalog)
        prepared = cls.analyze_file(raw, source.filename, user, catalog.organization,
            title=catalog.title, mode='editable', brand=catalog.brand)
        pages, review = cls._reconcile_reanalysis(catalog, source, prepared)
        if revision != cls.reconstruction_revision(catalog):
            review['conflicts'].append({'code': 'catalog_changed_during_analysis'})
            review['canConfirm'] = False
        prepared.report['reanalysis'] = {**review, 'catalogId': catalog.pk, 'sourceImportId': str(source.pk),
            'expectedRevision': revision, 'replacementRequiresConfirmation': True,
            'reviewPages': [public_import_page(page) for page in pages]}
        prepared.save(update_fields=['report'])
        return prepared

    @classmethod
    @transaction.atomic
    def confirm_reanalysis(cls, job, catalog, user, replace_reconstruction=False, preserve_edits=True):
        assert_organization_access(user, catalog.organization, write=True)
        catalog = StudioCatalog.objects.select_for_update().get(pk=catalog.pk)
        job = DocumentImport.objects.select_for_update().get(pk=job.pk)
        decision = job.report.get('reanalysis', {})
        if (preserve_edits is not True or decision.get('preserveEdits') is not True):
            raise ValidationError({'code': 'preservation_required', 'error': 'Prepare uma nova prévia que preserve suas edições.'})
        if (replace_reconstruction is not True or decision.get('catalogId') != catalog.pk
                or job.organization_id != catalog.organization_id or job.status != 'ready'
                or job.expires_at <= timezone.now()):
            raise ValidationError({'code': 'confirmation_required', 'error': 'Revise a prévia e confirme a substituição da reconstrução.'})
        old = catalog.source_import
        if (decision.get('sourceImportId') != str(old.pk)
                or decision.get('expectedRevision') != cls.reconstruction_revision(catalog)):
            raise ValidationError({'code': 'reanalysis_conflict', 'error': 'O catálogo mudou. Prepare uma nova prévia.'})
        cls._validate_ir_assets(job, job.document_ir)
        if len(job.previews) != len(old.previews) and old.previews:
            raise ValidationError({'code': 'page_count_mismatch'})
        pages, review = cls._reconcile_reanalysis(catalog, old, job)
        if decision.get('canConfirm') is not True or review['conflicts']:
            raise ValidationError({'code': 'reanalysis_edit_conflict',
                'error': 'Não foi possível preservar todas as edições. O catálogo atual foi mantido.',
                'conflicts': review['conflicts'] or decision.get('conflicts', [])})
        old.catalog = None
        old.save(update_fields=['catalog'])  # confirmed source history remains immutable and retained
        job.catalog = catalog
        job.status = 'confirmed'
        job.save(update_fields=['catalog', 'status'])
        for offset in range(0, len(pages), 2):
            spread, _ = CatalogSpread.objects.get_or_create(catalog=catalog, spread_index=offset // 2)
            spread.left_page_elements = [copy.deepcopy(pages[offset])]
            spread.right_page_elements = [copy.deepcopy(pages[offset + 1])] if offset + 1 < len(pages) else []
            spread.save(update_fields=['left_page_elements', 'right_page_elements', 'updated_at'])
        if any(review[key] for key in ('preservedTextEdits', 'preservedStyleEdits', 'preservedAuthoredPages')):
            job.report['quality'] = {**job.report.get('quality', {}), 'passed': False, 'status': 'needs_review'}
            job.save(update_fields=['report'])
        catalog.import_metadata = {'importId': str(job.pk), 'mode': 'editable',
            'sourceFingerprint': job.source_fingerprint, 'quality': job.report.get('quality', {}),
            'report': copy.deepcopy(job.report), 'share_enabled': False}
        catalog.total_pages = len(pages)
        catalog.save(update_fields=['import_metadata', 'total_pages', 'updated_at'])
        return job

    @classmethod
    @transaction.atomic
    def confirm_import(cls, job, user, title=None, mode=None, brand=None, brand_explicit=False):
        job = DocumentImport.objects.select_for_update(of=('self',)).select_related('organization', 'catalog', 'brand').get(pk=job.pk)
        assert_organization_access(user, job.organization, write=True)
        if job.report.get('reanalysis'):
            raise ValidationError({'code': 'confirmation_required', 'error': 'Confirme a substituição no catálogo de origem.'})
        if job.catalog_id is not None:
            return job, False
        from api.guards.quota_guard import check_catalog_creation_guard
        check_catalog_creation_guard(user, job.organization)
        if job.status != 'ready' or job.expires_at <= timezone.now():
            raise ValidationError('A prévia não está disponível para confirmação.')
        if title is not None and not isinstance(title, str):
            raise ValidationError({'title': 'Informe um título em texto.'})
        selected_mode = normalize_import_mode(mode or job.mode)
        selected_brand = brand if brand_explicit else job.brand
        if selected_brand:
            assert_organization_access(user, selected_brand.organization, write=True)
            if selected_brand.organization_id != job.organization_id or selected_brand.status != 'active':
                raise ValidationError({'brand_id': 'Selecione uma marca ativa da mesma organização.'})
        if selected_mode == 'redesign' and (job.mode != 'redesign' or (brand_explicit and job.brand_id != getattr(brand, 'pk', None))):
            raise ValidationError({'mode': 'Analise a prévia do redesenho antes de confirmar.', 'code': 'preview_required'})
        if selected_mode != 'redesign':
            cls.prepare_preview(job, selected_mode, brand=selected_brand)
        first_page = job.document_ir['pages'][0]
        catalog = StudioCatalog.objects.create(
            title=(title or job.title).strip()[:255], organization=job.organization, created_by=user,
            brand=selected_brand, brand_name=selected_brand.name if selected_brand else '',
            brand_snapshot=job.brand_snapshot if selected_brand else {},
            brand_snapshot_hash=job.brand_snapshot_hash if selected_brand else '',
            brand_version=(job.brand_snapshot.get('meta') or {}).get('brand_version') if selected_brand else None,
            style_preset='document_import', page_width=max(1, round(first_page['width'])),
            page_height=max(1, round(first_page['height'])), total_pages=len(job.previews),
            import_metadata={'importId': str(job.pk), 'mode': job.mode, 'sourceFingerprint': job.source_fingerprint,
                             'report': job.report, 'quality': job.report['quality'], 'share_enabled': False})
        for offset in range(0, len(job.previews), 2):
            left = job.previews[offset]
            right = job.previews[offset + 1] if offset + 1 < len(job.previews) else None
            CatalogSpread.objects.create(catalog=catalog, spread_index=offset // 2,
                                         title=f'Páginas {offset + 1}–{min(offset + 2, len(job.previews))}',
                                         left_page_elements=[left], right_page_elements=[right] if right else [])
        ChatThread.objects.create(catalog=catalog, user=user, title=f'Chat: {catalog.title}')
        job.catalog = catalog
        job.status = 'confirmed'
        job.title = catalog.title
        job.save()
        logger.info('document_import confirmed id=%s catalog=%s pages=%s mode=%s', job.pk, catalog.pk, len(job.previews), job.mode)
        return job, True

    @staticmethod
    def response(job):
        return {'import_id': str(job.pk), 'status': job.status, 'title': job.title, 'mode': job.mode,
                'source_fingerprint': job.source_fingerprint, 'total_pages': len(job.document_ir.get('pages', [])),
                'pages': job.previews, 'document_ir': job.document_ir, 'report': job.report,
                'expires_at': job.expires_at.isoformat(),
                **({'catalog_id': job.catalog_id, 'spreads_count': job.catalog.spreads.count()} if job.catalog_id else {})}

    @staticmethod
    @transaction.atomic
    def cancel_import(job, user):
        job = DocumentImport.objects.select_for_update().select_related('organization').get(pk=job.pk)
        assert_organization_access(user, job.organization, write=True)
        if job.status == 'confirmed':
            raise ValidationError('O histórico de origem de um catálogo confirmado deve ser preservado.')
        files = [(asset.file.storage, asset.file.name) for asset in job.assets.all()]
        job.delete()
        transaction.on_commit(lambda: [storage.delete(name) for storage, name in files])
