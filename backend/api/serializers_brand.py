"""Validation at the existing DRF boundary for the persistent Brand domain."""
import json
import math
import re
from django.db import transaction
from rest_framework import serializers
from api.models import Brand, BrandAsset, BrandGuideline, BrandMemory, BrandVersion
from api.services.brand_intelligence import assert_organization_access, material_save, validate_safe_url, DEFAULT_ASSET_POLICY


def validate_json(value, expected=dict, maximum=100000):
    if not isinstance(value, expected):
        raise serializers.ValidationError('Estrutura JSON inválida.')
    try:
        encoded = json.dumps(value, allow_nan=False)
    except (TypeError, ValueError) as error:
        raise serializers.ValidationError('JSON inválido.') from error
    if len(encoded) > maximum:
        raise serializers.ValidationError('Conteúdo excede o limite permitido.')
    def depth(item, level=0):
        if level > 8:
            raise serializers.ValidationError('JSON excede a profundidade permitida.')
        if isinstance(item, dict):
            for key, child in item.items():
                if not isinstance(key, str):
                    raise serializers.ValidationError('Chaves devem ser texto.')
                depth(child, level + 1)
        elif isinstance(item, list):
            for child in item:
                depth(child, level + 1)
    depth(value)
    return value


class BrandGuidelineSerializer(serializers.ModelSerializer):
    class Meta:
        model = BrandGuideline
        fields = ['id', 'type', 'category', 'rule', 'source', 'source_text', 'confidence', 'status', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']
        extra_kwargs = {'rule': {'max_length': 10000}, 'source_text': {'max_length': 100000}}

    def validate(self, attrs):
        if attrs.get('status', 'user_supplied') == 'confirmed':
            raise serializers.ValidationError({'status': 'Confirme sugestões pela ação de decisão.'})
        if attrs.get('status', 'user_supplied') == 'user_supplied' and attrs.get('source', 'user_input') != 'user_input':
            raise serializers.ValidationError({'source': 'Conteúdo interpretado deve começar como inferred.'})
        return attrs


class BrandMemorySerializer(serializers.ModelSerializer):
    class Meta:
        model = BrandMemory
        fields = ['id', 'type', 'category', 'rule', 'source', 'confidence', 'status', 'supporting_catalogs', 'supporting_actions', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']
        extra_kwargs = {'rule': {'max_length': 10000}}

    def validate(self, attrs):
        status = attrs.get('status', 'user_supplied')
        if status == 'confirmed':
            raise serializers.ValidationError({'status': 'Confirme sugestões pela ação de decisão.'})
        if status == 'user_supplied' and attrs.get('source', 'user_input') != 'user_input':
            raise serializers.ValidationError({'source': 'Memória interpretada deve começar como inferred.'})
        brand = self.context['brand']
        for catalog in attrs.get('supporting_catalogs', []):
            if catalog.organization_id != brand.organization_id or catalog.brand_id != brand.pk:
                raise serializers.ValidationError({'supporting_catalogs': 'Catálogo de apoio deve pertencer a esta marca e organização.'})
        if 'supporting_actions' in attrs:
            validate_json(attrs['supporting_actions'], list)
        return attrs


class BrandAssetSerializer(serializers.ModelSerializer):
    url = serializers.SerializerMethodField()
    class Meta:
        model = BrandAsset
        fields = ['id', 'media', 'asset_type', 'url', 'width', 'height', 'policy', 'active', 'created_at']
        read_only_fields = ['id', 'url', 'width', 'height', 'active', 'created_at']

    def get_url(self, obj):
        return obj.media.file.url

    def validate_media(self, media):
        if media.organization_id != self.context['brand'].organization_id:
            raise serializers.ValidationError('Ativo e marca devem pertencer à mesma organização.')
        return media

    def validate_policy(self, value):
        validate_json(value)
        if set(value) - set(DEFAULT_ASSET_POLICY):
            raise serializers.ValidationError('Propriedade de política desconhecida.')
        for key in ('crop_allowed', 'recolor_allowed'):
            if key in value and type(value[key]) is not bool:
                raise serializers.ValidationError('Permissões de logo devem ser booleanas.')
        for key, maximum in (('maximum_frequency', 1), ('safe_space', 2), ('minimum_width', 490)):
            if key in value and (type(value[key]) not in (int, float) or not math.isfinite(value[key]) or not 0 <= value[key] <= maximum):
                raise serializers.ValidationError('Limite geométrico inválido.')
        roles = {'cover', 'back_cover', 'institutional', 'product', 'divider', 'editorial', 'opening', 'closing'}
        for key in ('allowed_page_roles', 'preferred_page_roles'):
            if key in value and (not isinstance(value[key], list) or any(not isinstance(role, str) or role not in roles for role in value[key])):
                raise serializers.ValidationError('Papel de página inválido.')
        if 'preferred_background' in value and value['preferred_background'] not in ('light', 'dark') and not re.fullmatch(r'#[0-9a-fA-F]{6}', str(value['preferred_background'])):
            raise serializers.ValidationError('Fundo preferencial inválido.')
        if 'dominance' in value and value['dominance'] not in ('primary', 'secondary', 'subtle'):
            raise serializers.ValidationError('Dominância inválida.')
        return value


class BrandVersionSerializer(serializers.ModelSerializer):
    class Meta:
        model = BrandVersion
        fields = ['id', 'number', 'snapshot', 'snapshot_hash', 'created_at']
        read_only_fields = fields


class BrandSerializer(serializers.ModelSerializer):
    assets = serializers.SerializerMethodField()
    guidelines_input = BrandGuidelineSerializer(many=True, write_only=True, required=False)
    guidelines = BrandGuidelineSerializer(many=True, read_only=True)
    memories = BrandMemorySerializer(many=True, read_only=True)
    logo_url = serializers.CharField(required=False, allow_blank=True, max_length=8 * 1024 * 1024)

    class Meta:
        model = Brand
        fields = ['id', 'organization', 'created_by', 'name', 'slug', 'description', 'segment', 'website', 'logo_url', 'palette_name', 'custom_palette', 'colors', 'typography', 'visual_dna', 'tone_of_voice', 'commercial_contact', 'brand_markdown', 'intelligence', 'intelligence_fingerprint', 'status', 'current_version', 'legacy_id', 'legacy_source', 'migration_version', 'assets', 'guidelines', 'guidelines_input', 'memories', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_by', 'slug', 'intelligence', 'intelligence_fingerprint', 'status', 'current_version', 'legacy_id', 'legacy_source', 'migration_version', 'created_at', 'updated_at']
        extra_kwargs = {'description': {'max_length': 10000}, 'tone_of_voice': {'max_length': 10000}, 'brand_markdown': {'max_length': 100000}}

    def get_assets(self, brand):
        return BrandAssetSerializer(brand.assets.filter(active=True).select_related('media'), many=True).data

    def validate_organization(self, organization):
        assert_organization_access(self.context['request'].user, organization, write=True)
        if self.instance is not None and organization.pk != self.instance.organization_id:
            raise serializers.ValidationError('A organização da marca não pode ser alterada.')
        return organization

    def validate_website(self, value):
        return validate_safe_url(value)

    def validate_custom_palette(self, value):
        validate_json(value)
        for key, color in value.items():
            if key in ('name', 'contrastRatio'):
                if not isinstance(color, str) or len(color) > 255:
                    raise serializers.ValidationError('Metadados de paleta inválidos.')
                continue
            if key == 'locked':
                if type(color) is not bool:
                    raise serializers.ValidationError('Estado da paleta inválido.')
                continue
            if (not isinstance(color, str) or not re.fullmatch(r'#[0-9a-fA-F]{6}', color)):
                raise serializers.ValidationError('As cores devem usar hexadecimal #RRGGBB.')
        return value

    def validate_colors(self, value):
        validate_json(value, list)
        if len(value) > 100:
            raise serializers.ValidationError('Limite de 100 cores.')
        roles = {'primary', 'secondary', 'accent', 'neutral', 'background', 'support', 'forbidden', 'text'}
        for color in value:
            if not isinstance(color, dict) or not re.fullmatch(r'#[0-9a-fA-F]{6}', str(color.get('hex', ''))) or color.get('role') not in roles or color.get('status') not in {'user_supplied', 'inferred', 'confirmed', 'rejected'}:
                raise serializers.ValidationError('Cor, função ou estado inválido.')
            if not isinstance(color.get('source'), str) or len(color['source']) > 50:
                raise serializers.ValidationError('Origem da cor obrigatória.')
            confidence = color.get('confidence', 1)
            if type(confidence) not in (int, float) or not 0 <= confidence <= 1:
                raise serializers.ValidationError('Confiança inválida.')
        return value

    def validate_typography(self, value):
        return validate_json(value)

    def validate_visual_dna(self, value):
        return validate_json(value)

    def validate_commercial_contact(self, value):
        return validate_json(value)

    @transaction.atomic
    def create(self, validated_data):
        logo = validated_data.pop('logo_url', None)
        guidelines = validated_data.pop('guidelines_input', [])
        brand = Brand(**validated_data, created_by=self.context['request'].user)
        return material_save(brand, self.context['request'].user, logo, before_version=lambda: self._sync_guidelines(brand, guidelines))

    @transaction.atomic
    def update(self, instance, validated_data):
        brand = Brand.objects.select_for_update().get(pk=instance.pk)
        assert_organization_access(self.context['request'].user, brand.organization, write=True)
        logo = validated_data.pop('logo_url', None)
        guidelines = validated_data.pop('guidelines_input', None)
        for key, value in validated_data.items():
            setattr(brand, key, value)
        if guidelines is not None:
            self._sync_guidelines(brand, guidelines)
        return material_save(brand, self.context['request'].user, logo)

    @staticmethod
    def _sync_guidelines(brand, guidelines):
        if len(guidelines) > 100:
            raise serializers.ValidationError({'guidelines_input': 'Limite de 100 diretrizes por salvamento.'})
        for rule in guidelines:
            if rule.get('source') == 'brand_markdown' and rule.get('status') != 'inferred':
                raise serializers.ValidationError({'guidelines_input': 'Diretrizes importadas precisam de confirmação explícita.'})
            lookup = {key: rule[key] for key in ('type', 'category', 'rule', 'source') if key in rule}
            if not brand.guidelines.filter(**lookup).exists():
                BrandGuideline.objects.create(brand=brand, **rule)
