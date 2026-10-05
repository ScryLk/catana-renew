"""Persistent Brand endpoints using the existing tenant/role and Media infrastructure."""
import copy
import io
import json
from django.db import transaction
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from api.models import Brand, BrandAsset, Media, Organization, StudioCatalog
from api.permissions import IsOrganizationResourceEditor
from api.serializers_brand import (BrandSerializer, BrandAssetSerializer, BrandGuidelineSerializer,
                                   BrandMemorySerializer, BrandVersionSerializer, validate_json)
from api.services.brand_intelligence import (BrandContextResolver, assert_organization_access,
    visible_organizations, create_material_version, bind_catalog_brand, snapshot_hash, brand_source_fingerprint, _image_metadata)
from api.services.image_validator import validate_image_file


class BrandViewSet(viewsets.ModelViewSet):
    serializer_class = BrandSerializer
    permission_classes = [permissions.IsAuthenticated, IsOrganizationResourceEditor]
    queryset = Brand.objects.none()
    pagination_class = None
    http_method_names = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options']

    def get_queryset(self):
        queryset = Brand.objects.filter(organization__in=visible_organizations(self.request.user)).select_related('organization').prefetch_related('assets__media', 'guidelines', 'memories')
        organization = self.request.query_params.get('organization')
        if organization:
            if not organization.isdecimal():
                raise ValidationError({'organization': 'Organização inválida.'})
            queryset = queryset.filter(organization_id=int(organization))
        if self.action == 'list' and self.request.query_params.get('status', 'active') != 'all':
            queryset = queryset.filter(status=self.request.query_params.get('status', 'active'))
        return queryset

    def _writable(self):
        brand = self.get_object()
        assert_organization_access(self.request.user, brand.organization, write=True)
        if brand.status == 'archived' and self.action != 'restore':
            raise ValidationError({'brand': 'Restaure a marca antes de editar sua identidade.'})
        return brand

    def update(self, request, *args, **kwargs):
        self._writable()
        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        brand = self.get_object()
        assert_organization_access(request.user, brand.organization, write=True)
        brand.status = 'archived'
        brand.save(update_fields=['status', 'updated_at'])
        return Response({'id': str(brand.pk), 'status': 'archived'})

    @action(detail=True, methods=['post'])
    def restore(self, request, pk=None):
        brand = self.get_object()
        assert_organization_access(request.user, brand.organization, write=True)
        brand.status = 'active'
        brand.save(update_fields=['status', 'updated_at'])
        return Response(self.get_serializer(brand).data)

    @action(detail=True, methods=['get'])
    def versions(self, request, pk=None):
        return Response(BrandVersionSerializer(self.get_object().versions.all(), many=True).data)

    @action(detail=True, methods=['get', 'post'])
    def intelligence(self, request, pk=None):
        if request.method == 'GET':
            brand = self.get_object()
            observations = BrandContextResolver._resolve_current(brand)['categories']
            fingerprint = brand_source_fingerprint(brand)
            return Response({'intelligence': brand.intelligence, 'context': BrandContextResolver.resolve(brand),
                             'categories': observations, 'portfolio_fingerprint': fingerprint,
                             'stale': bool(brand.intelligence_fingerprint and brand.intelligence_fingerprint != fingerprint)})
        brand = self._writable()
        key = request.data.get('key')
        allowed = {'visual_dna', 'business_profile', 'tone_dimensions', 'preferred_vocabulary', 'forbidden_expressions', 'writing_rules', 'photographic_language', 'visual_density'}
        if key not in allowed or 'value' not in request.data:
            raise ValidationError('Propriedade de inteligência inválida.')
        value = request.data['value']
        validate_json({'value': value})
        expected = list if key in ('preferred_vocabulary', 'forbidden_expressions', 'writing_rules') else dict if key in ('visual_dna', 'business_profile', 'tone_dimensions') else (str, int, float)
        if not isinstance(value, expected):
            raise ValidationError('Estrutura da interpretação inválida.')
        if isinstance(value, list) and (len(value) > 100 or any(not isinstance(word, str) or len(word) > 1000 for word in value)):
            raise ValidationError('Vocabulário inválido.')
        if key == 'tone_dimensions' and any(type(dimension) not in (int, float) or not 0 <= dimension <= 1 for dimension in value.values()):
            raise ValidationError('As dimensões de voz devem estar entre 0 e 1.')
        source = request.data.get('source', 'brand_analysis')
        confidence = request.data.get('confidence', 0.5)
        if not isinstance(source, str) or len(source) > 50 or type(confidence) not in (int, float) or not 0 <= confidence <= 1:
            raise ValidationError('Origem ou confiança inválida.')
        with transaction.atomic():
            brand = Brand.objects.select_for_update().get(pk=brand.pk)
            if brand.intelligence.get(key, {}).get('status') == 'confirmed':
                raise ValidationError('Rejeite a interpretação anterior antes de propor sua substituição.')
            brand.intelligence = {**brand.intelligence, key: {'value': value, 'source': source, 'confidence': confidence, 'status': 'inferred'}}
            brand.intelligence_fingerprint = brand_source_fingerprint(brand)
            brand.save(update_fields=['intelligence', 'intelligence_fingerprint', 'updated_at'])
        return Response(self.get_serializer(brand).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['get', 'post'])
    def guidelines(self, request, pk=None):
        return self._rules(request, BrandGuidelineSerializer, 'guidelines')

    @action(detail=True, methods=['get', 'post'])
    def memories(self, request, pk=None):
        return self._rules(request, BrandMemorySerializer, 'memories')

    def _rules(self, request, serializer_class, relation):
        if request.method == 'GET':
            return Response(serializer_class(getattr(self.get_object(), relation).all(), many=True).data)
        brand = self._writable()
        with transaction.atomic():
            brand = Brand.objects.select_for_update().get(pk=brand.pk)
            serializer = serializer_class(data=request.data, context={'brand': brand, 'request': request})
            serializer.is_valid(raise_exception=True)
            serializer.save(brand=brand)
            create_material_version(brand, request.user)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'])
    def decisions(self, request, pk=None):
        brand = self._writable()
        kind = request.data.get('kind')
        decision = request.data.get('status')
        if decision not in ('confirmed', 'rejected') or kind not in ('guideline', 'memory', 'intelligence', 'color'):
            raise ValidationError('Decisão inválida.')
        with transaction.atomic():
            brand = Brand.objects.select_for_update().get(pk=brand.pk)
            if kind in ('guideline', 'memory'):
                relation = brand.guidelines if kind == 'guideline' else brand.memories
                identifier = request.data.get('id')
                if not str(identifier).isdecimal():
                    raise ValidationError('Identificador inválido.')
                item = relation.filter(pk=identifier).first()
                if item is None:
                    raise ValidationError('Sugestão não encontrada nesta marca.')
                item.status = decision
                item.save(update_fields=['status', 'updated_at'])
            elif kind == 'intelligence':
                key = request.data.get('key')
                if key not in brand.intelligence:
                    raise ValidationError('Inferência não encontrada.')
                brand.intelligence = copy.deepcopy(brand.intelligence)
                brand.intelligence[key]['status'] = decision
                brand.save(update_fields=['intelligence', 'updated_at'])
            else:
                identifier = request.data.get('id')
                if type(identifier) is not int or not 0 <= identifier < len(brand.colors):
                    raise ValidationError('Cor não encontrada.')
                brand.colors = copy.deepcopy(brand.colors)
                brand.colors[identifier]['status'] = decision
                brand.save(update_fields=['colors', 'updated_at'])
            create_material_version(brand, request.user)
        return Response(self.get_serializer(brand).data)

    @action(detail=True, methods=['get', 'post'])
    def assets(self, request, pk=None):
        if request.method == 'GET':
            return Response(BrandAssetSerializer(self.get_object().assets.filter(active=True), many=True).data)
        brand = self._writable()
        with transaction.atomic():
            brand = Brand.objects.select_for_update().get(pk=brand.pk)
            data = {key: request.data.get(key) for key in request.data}
            if isinstance(data.get('policy'), str):
                try:
                    data['policy'] = json.loads(data['policy'])
                except ValueError as error:
                    raise ValidationError({'policy': 'Política JSON inválida.'}) from error
            if 'policy' in data:
                BrandAssetSerializer().validate_policy(data['policy'])
            uploaded = request.FILES.get('file')
            if uploaded:
                width, height = self._validate_asset_file(uploaded, data.get('asset_type', ''))
                media = Media.objects.create(file=uploaded, name=uploaded.name, organization=brand.organization, uploaded_by=request.user)
                data['media'] = media.pk
            serializer = BrandAssetSerializer(data=data, context={'brand': brand, 'request': request})
            serializer.is_valid(raise_exception=True)
            media = serializer.validated_data['media']
            width, height = self._validate_asset_file(media.file, serializer.validated_data['asset_type'])
            if serializer.validated_data['asset_type'] == 'logo_primary':
                brand.assets.filter(asset_type='logo_primary', active=True).update(active=False)
            asset = serializer.save(brand=brand, width=width, height=height)
            if asset.asset_type == 'logo_primary':
                brand.logo_url = media.file.url
                brand.save(update_fields=['logo_url', 'updated_at'])
            create_material_version(brand, request.user)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @staticmethod
    def _validate_asset_file(file_obj, asset_type):
        if asset_type not in dict(BrandAsset.ASSET_TYPES):
            raise ValidationError({'asset_type': 'Tipo de ativo inválido.'})
        if asset_type not in ('brand_manual', 'font_reference', 'brand_document'):
            valid, _, error = validate_image_file(file_obj)
            if not valid:
                raise ValidationError({'file': error})
            return _image_metadata(file_obj)
        try:
            if not 0 < file_obj.size <= 10 * 1024 * 1024:
                raise ValidationError({'file': 'O documento deve ter até 10 MB.'})
            file_obj.seek(0)
            content = file_obj.read()
            file_obj.seek(0)
        except OSError as error:
            raise ValidationError({'file': 'O arquivo não está disponível no armazenamento.'}) from error
        name = file_obj.name.lower()
        if name.endswith('.pdf'):
            if not content.startswith(b'%PDF-'):
                raise ValidationError({'file': 'PDF inválido.'})
            try:
                from pypdf import PdfReader
                reader = PdfReader(io.BytesIO(content))
                if reader.is_encrypted or len(reader.pages) > 500 or '/JavaScript' in reader.trailer['/Root'].get('/Names', {}) or '/OpenAction' in reader.trailer['/Root']:
                    raise ValueError('PDF protegido ou ativo.')
            except Exception as error:
                raise ValidationError({'file': 'Utilize um PDF válido, sem scripts ou criptografia.'}) from error
        elif name.endswith(('.txt', '.md')):
            try:
                text = content.decode('utf-8')
            except UnicodeDecodeError as error:
                raise ValidationError({'file': 'O texto deve usar UTF-8.'}) from error
            if '\x00' in text:
                raise ValidationError({'file': 'Texto inválido.'})
        else:
            raise ValidationError({'file': 'Utilize PDF, TXT ou Markdown para documentos.'})
        return None, None

    @action(detail=True, methods=['delete'], url_path=r'assets/(?P<asset_id>[^/.]+)')
    def deactivate_asset(self, request, pk=None, asset_id=None):
        brand = self._writable()
        if not str(asset_id).isdecimal():
            raise ValidationError('Ativo inválido.')
        with transaction.atomic():
            brand = Brand.objects.select_for_update().get(pk=brand.pk)
            asset = brand.assets.filter(pk=asset_id, active=True).first()
            if asset is None:
                raise ValidationError('Ativo não encontrado.')
            asset.active = False
            asset.save(update_fields=['active'])
            if asset.asset_type == 'logo_primary':
                brand.logo_url = ''
                brand.save(update_fields=['logo_url', 'updated_at'])
            create_material_version(brand, request.user)
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=False, methods=['post'])
    def migrate(self, request):
        organization_id = request.data.get('organization')
        if not str(organization_id).isdecimal():
            raise ValidationError({'organization': 'Selecione uma organização.'})
        organization = visible_organizations(request.user).filter(pk=organization_id).first()
        if organization is None:
            raise ValidationError({'organization': 'Organização não encontrada.'})
        assert_organization_access(request.user, organization, write=True)
        brands = request.data.get('brands')
        if not isinstance(brands, list) or not 1 <= len(brands) <= 100:
            raise ValidationError({'brands': 'Envie de 1 a 100 marcas legadas.'})
        if len(json.dumps(brands)) > 16 * 1024 * 1024:
            raise ValidationError('Importação excede 16 MB; importe em grupos menores.')
        aliases = {'logoUrl': 'logo_url', 'paletteName': 'palette_name', 'customPalette': 'custom_palette',
                   'brandMarkdown': 'brand_markdown', 'toneOfVoice': 'tone_of_voice', 'commercialContact': 'commercial_contact'}
        migrated = []
        mapping = {}
        with transaction.atomic():
            # Organization lock serializes two imports before the unique legacy record exists.
            Organization.objects.select_for_update().get(pk=organization.pk)
            for legacy in brands:
                if not isinstance(legacy, dict) or not isinstance(legacy.get('id'), str) or not 0 < len(legacy['id']) <= 255:
                    raise ValidationError({'brands': 'Toda marca legada precisa de um identificador estável.'})
                legacy_id = legacy['id']
                brand = Brand.objects.filter(organization=organization, created_by=request.user, legacy_id=legacy_id).first()
                if brand is None:
                    data = {aliases.get(key, key): value for key, value in legacy.items() if key in aliases or key in ('name', 'segment', 'description', 'website', 'typography', 'visual_dna', 'colors', 'guidelines_input')}
                    # Legacy empty palettes are null, not an invalid customer color definition.
                    if data.get('custom_palette') is None:
                        data['custom_palette'] = {}
                    data['organization'] = organization.pk
                    serializer = BrandSerializer(data=data, context={'request': request})
                    serializer.is_valid(raise_exception=True)
                    brand = serializer.save()
                    source = copy.deepcopy(legacy)
                    if isinstance(source.get('logoUrl'), str) and source['logoUrl'].startswith('data:'):
                        source['legacy_logo_digest'] = snapshot_hash(source['logoUrl'])
                        source['logoUrl'] = brand.logo_url
                    brand.legacy_id = legacy_id
                    brand.legacy_source = source
                    brand.migration_version = 1
                    brand.save(update_fields=['legacy_id', 'legacy_source', 'migration_version'])
                    for old_catalog in legacy.get('catalogs', []) if isinstance(legacy.get('catalogs'), list) else []:
                        if not isinstance(old_catalog, dict):
                            continue
                        identifier = old_catalog.get('backendId') or old_catalog.get('backend_id')
                        if not str(identifier).isdecimal():
                            continue
                        catalog = StudioCatalog.objects.filter(pk=identifier, organization=organization, brand__isnull=True).first()
                        if catalog:
                            bind_catalog_brand(catalog, brand, request.user)
                            catalog.save(update_fields=['brand', 'brand_version', 'brand_snapshot', 'brand_snapshot_hash'])
                mapping[legacy_id] = str(brand.pk)
                migrated.append(brand)
        return Response({'brands': self.get_serializer(migrated, many=True).data, 'id_mapping': mapping, 'migration_version': 1})
