"""Factual input adapter for the existing editorial pipeline.

Only normalized server extraction enters this boundary. Source strings are data,
never instructions; unknown fields stay null and original pages survive failure.
"""
import copy
import hashlib
import json
import math
import re

from .commercial_guard import CommercialIntegrityGuard
from .design_grammar import GenerativeBlock, is_safe_image_url


class SourceDocumentContext:
    MAX_PAGES = 100
    MAX_ELEMENTS = 12000
    MAX_TEXT_CHARACTERS = 600000
    IMPORT_NULLABLE_FIELDS = ('category', 'details', 'material', 'dimensions', 'reference_code', 'commercial_condition')

    @staticmethod
    def digest(value):
        return hashlib.sha256(json.dumps(value, sort_keys=True, ensure_ascii=False,
                                        separators=(',', ':'), allow_nan=False).encode()).hexdigest()

    @classmethod
    def validate_input(cls, source, enforce_redesign_limits=True):
        if not isinstance(source, dict) or source.get('schemaVersion') != 1:
            raise ValueError('SOURCE_IR_INVALID')
        pages = source.get('pages')
        if (not isinstance(pages, list) or not pages
                or type(source.get('pageCount')) is not int or source['pageCount'] != len(pages)):
            raise ValueError('SOURCE_PAGE_COUNT_INVALID')
        fingerprint = source.get('sourceFingerprint')
        if not isinstance(fingerprint, str) or not re.fullmatch(r'[0-9a-f]{64}', fingerprint):
            raise ValueError('SOURCE_FINGERPRINT_INVALID')
        elements_count, characters = 0, 0
        for index, page in enumerate(pages, 1):
            if not isinstance(page, dict) or page.get('pageNumber') != index:
                raise ValueError('SOURCE_PAGE_ORDER_INVALID')
            for key in ['width', 'height']:
                value = page.get(key)
                if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value) or value <= 0:
                    raise ValueError('SOURCE_GEOMETRY_INVALID')
            snapshot = page.get('sourceSnapshot')
            if not isinstance(snapshot, dict) or not is_safe_image_url(snapshot.get('url')):
                raise ValueError('SOURCE_SNAPSHOT_MISSING')
            elements = page.get('elements', [])
            if not isinstance(elements, list):
                raise ValueError('SOURCE_ELEMENTS_INVALID')
            identifiers = set()
            for element in elements:
                if not isinstance(element, dict) or not isinstance(element.get('id'), str) or element['id'] in identifiers:
                    raise ValueError('SOURCE_ELEMENT_ID_INVALID')
                identifiers.add(element['id'])
                evidence = element.get('provenance')
                if not isinstance(evidence, dict) or evidence.get('sourcePage') != index or evidence.get('sourceElement') != element['id']:
                    raise ValueError('SOURCE_PROVENANCE_INVALID')
                if element.get('type') == 'text':
                    text = element.get('text')
                    if not isinstance(text, str) or evidence.get('sourceText') != text:
                        raise ValueError('SOURCE_TEXT_EVIDENCE_INVALID')
                    text_hash = hashlib.sha256(text.encode()).hexdigest()
                    if evidence.get('sourceTextHash') != text_hash:
                        raise ValueError('SOURCE_TEXT_HASH_INVALID')
                    characters += len(text)
            elements_count += len(elements)
        if enforce_redesign_limits and (len(pages) > cls.MAX_PAGES or elements_count > cls.MAX_ELEMENTS
                                        or characters > cls.MAX_TEXT_CHARACTERS):
            raise ValueError('SOURCE_RESOURCE_LIMIT')
        cls.digest(source)  # Reject nonfinite or unserializable values anywhere in the IR.
        return source

    @classmethod
    def candidates(cls, source):
        candidates = source.get('candidates', source.get('productCandidates', []))
        if not isinstance(candidates, list) or not all(isinstance(p, dict) for p in candidates):
            raise ValueError('SOURCE_CANDIDATES_INVALID')
        return [cls.sanitize_candidate(p) for p in candidates]

    @classmethod
    def sanitize_candidate(cls, product):
        product = CommercialIntegrityGuard.sanitize_supplied_product(product)
        for field in cls.IMPORT_NULLABLE_FIELDS:
            product.setdefault(field, None)
        return product

    @classmethod
    def visually_admitted(cls, element):
        """Only server-verified painted source objects may become new visible content."""
        if element.get('sourceVisible') is not True or element.get('nested') or element.get('clipped'):
            return False
        numbers = [element.get(key) for key in ('x', 'y', 'width', 'height')]
        if not all(type(value) in (int, float) and math.isfinite(value) for value in numbers):
            return False
        x, y, width, height = numbers
        if x < 0 or y < 0 or width <= 0 or height <= 0 or x + width > 1.000001 or y + height > 1.000001:
            return False
        if element.get('type') == 'text':
            if element.get('textRenderMode', 0) != 0 or element.get('opacity', 1) != 1:
                return False
        return element.get('type') in {'text', 'image'}

    @classmethod
    def page_title(cls, page):
        return next((e['text'] for e in page.get('elements', []) if e.get('type') == 'text'
                     and e.get('text', '').strip() and cls.visually_admitted(e)), '')

    @classmethod
    def document_title(cls, source):
        return next((cls.page_title(page) for page in source['pages'] if cls.page_title(page)), '')

    @classmethod
    def bind(cls, contract, source, supplied_products):
        cls.validate_input(source)
        expected = cls.candidates(source)
        supplied = [cls.sanitize_candidate(p) for p in (supplied_products or [])]
        # The importer may add a UI index, never a commercial fact or provenance.
        def factual(product):
            return {key: value for key, value in product.items() if key != 'index'}
        if cls.digest([factual(p) for p in expected]) != cls.digest([factual(p) for p in supplied]):
            raise ValueError('SOURCE_PRODUCTS_NOT_FROM_DOCUMENT')
        contract.source_document = copy.deepcopy(source)
        contract.output.page_count = source['pageCount']
        contract.output.page_count_mode = 'exact'
        contract.constraints.hard = [c for c in contract.constraints.hard if not c.startswith('PAGE_COUNT_')]
        contract.constraints.hard.append(f"PAGE_COUNT_EXACT:{source['pageCount']}")
        contract.constraints.hard.append('SOURCE_FACTS_IMMUTABLE')
        contract.assets.images = [copy.deepcopy(e) for p in source['pages'] for e in p.get('elements', [])
                                  if e.get('imageUrl') and is_safe_image_url(e['imageUrl'])]
        contract.assets.has_product_images = any(p.get('image') for p in expected)
        return contract

    @classmethod
    def content_plan(cls, contract, slots, products):
        from .content_planner import DocumentContentPlan, PageContentPlan
        source = contract.source_document
        first_text = cls.document_title(source)
        maps = [PageContentPlan(page_number=p['pageNumber'], slot_index=index,
                                purpose='', required_content=[], supporting_content=[], verbatim_blocks=[],
                                product_items=slots[index].allocated_products)
                for index, p in enumerate(source['pages'])]
        return DocumentContentPlan(title=first_text, category='', summary='', page_maps=maps,
                                   verbatim_rules=[], total_products_allocated=len(products or []))

    @classmethod
    def attach(cls, document, source):
        document['sourceDocument'] = copy.deepcopy(source)
        document['sourceContentHash'] = cls.digest(source)
        document['importMode'] = 'redesign'
        for index, page in enumerate(document.get('pages', [])):
            if index >= len(source['pages']):
                break
            original = source['pages'][index]
            page['sourceSnapshot'] = copy.deepcopy(original['sourceSnapshot'])
            page['documentPage'] = copy.deepcopy(original)
            page['geometry'] = {'width': original['width'], 'height': original['height'], 'unit': original.get('unit', 'pt')}
            page['sourcePage'] = original['pageNumber']
        return document

    @classmethod
    def fallback_page(cls, source, number, reason, existing=None):
        """Keep an original page visible when its appearance cannot be recomposed safely."""
        original = source['pages'][number - 1]
        page = copy.deepcopy(existing or {})
        page.pop('generativeDraft', None)  # Hidden repair drafts have not passed the source boundary.
        draft = {key: copy.deepcopy(page[key]) for key in ['blocks', 'composition', 'safeArea'] if page.get(key)}
        if draft:
            page['generativeDraft'] = draft
        for key in ['composition', 'safeArea', 'fingerprint']:
            page.pop(key, None)
        page.update(id=page.get('id') or f"source-{source['sourceFingerprint'][:12]}-p{number}",
                    pageNumber=number, type=page.get('type', 'single'), renderMode='document',
                    sourceVisibility='source_only', title=cls.page_title(original), subtitle='', content='',
                    quote='', label='', folio=str(number), blocks=[], products=page.get('products', []),
                    backgroundColor='#FFFFFF', textColor='#141416', accentColor='#141416',
                    sourceSnapshot=copy.deepcopy(original['sourceSnapshot']), documentPage=copy.deepcopy(original),
                    sourcePage=number, geometry={'width': original['width'], 'height': original['height'],
                                                'unit': original.get('unit', 'pt')},
                    importWarning=reason, qualityGate={'passed': False, 'publishable': False,
                                                      'status': 'blocked', 'reasons': [reason]})
        return page

    @classmethod
    def fallback(cls, source, reason):
        cls.validate_input(source, enforce_redesign_limits=False)
        pages = [cls.fallback_page(source, p['pageNumber'], reason) for p in source['pages']]
        first_text = cls.document_title(source)
        document = {'catalogId': 'source-' + source['sourceFingerprint'][:12], 'title': first_text, 'category': '',
                    'summary': '', 'palette': {'name': 'Documento original', 'primary': '#141416',
                    'background': '#FFFFFF', 'accent': '#141416'}, 'pages': pages, 'totalPages': len(pages),
                    'renderMode': 'document', 'qualityGate': {'passed': False, 'publishable': False,
                    'status': 'blocked', 'reasons': [reason]}, 'observability': {'fallbackUsed': True,
                    'sourceFingerprint': source['sourceFingerprint'], 'sourcePageCount': len(pages)}}
        return cls.attach(document, source)

    @classmethod
    def blocks(cls, contract, page, direction):
        source_page = contract.source_document['pages'][page['pageNumber'] - 1]
        elements = source_page.get('elements', [])
        if any(e.get('type') not in {'text', 'image'} for e in elements):
            raise ValueError('SOURCE_UNSUPPORTED_APPEARANCE')
        usable = [e for e in elements if (e.get('type') == 'text' and e.get('text', '').strip())
                  or (e.get('type') == 'image' and is_safe_image_url(e.get('imageUrl')))]
        if len(usable) != len([e for e in elements if e.get('type') == 'image' or e.get('text', '').strip()]):
            raise ValueError('SOURCE_IMAGE_APPEARANCE_MISSING')
        if not usable:
            raise ValueError('SOURCE_PRESERVE_ONLY')
        if any(not cls.visually_admitted(element) for element in usable):
            raise ValueError('SOURCE_VISIBILITY_NOT_ADMITTED')
        usable.sort(key=lambda e: (float(e.get('y', 0)), float(e.get('x', 0)), e['id']))
        columns = 1 if len(usable) < 8 else 2
        rows = math.ceil(len(usable) / columns)
        width = (.88 - .04 * (columns - 1)) / columns
        height = min(.80 / rows - .012, .30)
        if height < .025:
            raise ValueError('SOURCE_CONTENT_DENSITY_REQUIRES_REVIEW')
        blocks = []
        text_index = 0
        for index, element in enumerate(usable):
            column, row = divmod(index, rows)
            geometry = dict(x=.06 + column * (width+.04), y=.06 + row * (height+.012), width=width, height=height)
            evidence = copy.deepcopy(element['provenance'])
            if element['type'] == 'text':
                display = text_index == 0
                text_index += 1
                lines = max(1, math.ceil(len(element['text']) / max(12, width * 490 / 7)))
                font_size = min(26 if display else 12, height * 693 / (lines * 1.4))
                if font_size < 8:
                    raise ValueError('SOURCE_TEXT_DENSITY_REQUIRES_REVIEW')
                blocks.append(GenerativeBlock(id=f"p{page['pageNumber']}-source-{element['id']}", type='text',
                    role='source_text', content=element['text'], fontRole='display' if display else 'body',
                    fontFamily=direction.font_pairing.get('display' if display else 'body'), fontSize=font_size,
                    lineHeight=1.3, colorToken='primary', provenance=evidence, **geometry))
            else:
                blocks.append(GenerativeBlock(id=f"p{page['pageNumber']}-source-{element['id']}", type='image',
                    role='source_image', imageUrl=element['imageUrl'], cropMode='contain', provenance=evidence, **geometry))
        return blocks


class SourceIntegrityGuard:
    @classmethod
    def verify(cls, contract, document, complete=True, allow_repair_legacy=False):
        source = contract.source_document
        if not source:
            return []
        errors = []
        pages = document.get('pages', [])
        if complete:
            if len(pages) != source['pageCount']:
                errors.append('SOURCE_PAGE_COUNT_CHANGED')
            if [p.get('pageNumber') for p in pages] != list(range(1, source['pageCount'] + 1)):
                errors.append('SOURCE_PAGE_ORDER_CHANGED')
            if (document.get('sourceDocument') != source or document.get('sourceContentHash') != SourceDocumentContext.digest(source)
                    or SourceDocumentContext.digest(document.get('sourceDocument')) != SourceDocumentContext.digest(source)):
                errors.append('SOURCE_IR_CHANGED')
            first_text = SourceDocumentContext.document_title(source)
            if document.get('title') != first_text or document.get('category') or document.get('summary'):
                errors.append('SOURCE_EDITORIAL_COPY_FABRICATED')
        source_candidates = SourceDocumentContext.candidates(source)
        candidates = {CommercialIntegrityGuard.identity(p): p for p in source_candidates}
        for page in pages:
            number = page.get('pageNumber')
            if type(number) is not int or not 1 <= number <= source['pageCount']:
                errors.append('SOURCE_PAGE_REFERENCE_INVALID')
                continue
            original = source['pages'][number-1]
            if complete:
                mode = page.get('renderMode')
                if (mode not in {'generative', 'document'} and not (allow_repair_legacy and mode == 'legacy')
                        or mode == 'document' and page.get('sourceVisibility') != 'source_only'):
                    errors.append('SOURCE_RENDER_MODE_INVALID')
                if (page.get('sourceSnapshot') != original['sourceSnapshot'] or page.get('documentPage') != original
                        or page.get('sourcePage') != number):
                    errors.append('SOURCE_PAGE_SNAPSHOT_CHANGED')
                expected_geometry = {'width': original['width'], 'height': original['height'], 'unit': original.get('unit', 'pt')}
                if page.get('geometry') != expected_geometry:
                    errors.append('SOURCE_GEOMETRY_CHANGED')
                if page.get('title') != SourceDocumentContext.page_title(original) or any(page.get(k) for k in ['subtitle', 'content', 'quote', 'label', 'editorialImage']):
                    errors.append('SOURCE_EDITORIAL_COPY_FABRICATED')
            originals = {e['id']: e for e in original.get('elements', [])}
            if page.get('renderMode') == 'generative':
                if any(e.get('type') in {'text', 'image'} and (e.get('text', '').strip() or e.get('imageUrl'))
                       and not SourceDocumentContext.visually_admitted(e) for e in originals.values()):
                    errors.append('SOURCE_VISIBILITY_NOT_ADMITTED')
                if any(e.get('type') not in {'text', 'image'} for e in originals.values()):
                    errors.append('SOURCE_UNSUPPORTED_APPEARANCE')
                if any(e.get('type') == 'image' and not is_safe_image_url(e.get('imageUrl')) for e in originals.values()):
                    errors.append('SOURCE_IMAGE_APPEARANCE_MISSING')
            seen = set()
            for product in page.get('products', []):
                expected = candidates.get(CommercialIntegrityGuard.identity(product))
                actual = {k: v for k, v in product.items() if k != 'index'}
                expected_facts = {k: v for k, v in (expected or {}).items() if k != 'index'}
                if expected is None or SourceDocumentContext.digest(actual) != SourceDocumentContext.digest(expected_facts):
                    errors.append('SOURCE_COMMERCIAL_FACT_CHANGED')
            for block in page.get('blocks', []):
                if block.get('role') == 'folio':
                    if (block.get('type') != 'folio' or block.get('imageUrl') or block.get('productId') is not None
                            or block.get('content') not in {str(number), str(number).zfill(2)}):
                        errors.append('SOURCE_FOLIO_FACT_FABRICATED')
                    continue
                evidence = block.get('provenance')
                element = originals.get(evidence.get('sourceElement')) if isinstance(evidence, dict) else None
                if element is None or evidence != element.get('provenance'):
                    errors.append('SOURCE_PROVENANCE_CHANGED')
                    continue
                if not SourceDocumentContext.visually_admitted(element):
                    errors.append('SOURCE_VISIBILITY_NOT_ADMITTED')
                if element['id'] in seen:
                    errors.append('SOURCE_CONTENT_DUPLICATED')
                seen.add(element['id'])
                expected_type = element['type']
                if (expected_type not in {'text', 'image'} or block.get('type') != expected_type
                        or block.get('role') != f'source_{expected_type}' or block.get('productId') is not None):
                    errors.append('SOURCE_ELEMENT_ROLE_CHANGED')
                if expected_type == 'text' and (block.get('content') != element.get('text') or block.get('imageUrl')):
                    errors.append('SOURCE_TEXT_FACT_CHANGED')
                if expected_type == 'image' and (block.get('imageUrl') != element.get('imageUrl') or block.get('content')):
                    errors.append('SOURCE_IMAGE_FACT_CHANGED')
                if element['type'] == 'image' and block.get('cropMode') != 'contain':
                    errors.append('SOURCE_IMAGE_CROP_FORBIDDEN')
            if complete and page.get('renderMode') == 'generative':
                expected = {e['id'] for e in original.get('elements', []) if e.get('type') in {'text', 'image'}
                            and (e.get('text', '').strip() or e.get('imageUrl'))}
                if seen != expected:
                    errors.append('SOURCE_CONTENT_MISSING')
        return sorted(set(errors))
