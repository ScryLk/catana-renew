"""Canonical customer identity, explicit inference decisions and immutable brand history.

Source documents remain untrusted data. This service never fetches websites, runs
instructions from documents, or changes commercial product data.
"""
import base64
import binascii
import copy
import hashlib
import json
import re
from collections import Counter
from urllib.parse import urlsplit, unquote

from django.conf import settings
from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.files.base import ContentFile
from django.db import transaction
from django.db.models import Q
from django.utils.text import slugify
from PIL import Image
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError

from api.models import Brand, BrandAsset, BrandVersion, Media, Organization
from api.services.image_validator import validate_image_file

CONFIRMED_STATUSES = {'user_supplied', 'confirmed'}
DEFAULT_ASSET_POLICY = {
    'allowed_page_roles': ['cover', 'back_cover', 'institutional'],
    'preferred_page_roles': ['cover'], 'maximum_frequency': 0.35,
    'minimum_width': 48, 'safe_space': 0.5, 'crop_allowed': False,
    'recolor_allowed': False, 'dominance': 'secondary',
    'preferred_background': 'light',
}


def snapshot_hash(snapshot):
    return hashlib.sha256(json.dumps(snapshot, sort_keys=True, ensure_ascii=False, separators=(',', ':'), allow_nan=False).encode('utf-8')).hexdigest()


def visible_organizations(user):
    if not user or not user.is_authenticated:
        return Organization.objects.none()
    if user.is_superuser:
        return Organization.objects.all()
    return Organization.objects.filter(Q(owner=user) | Q(members=user)).distinct()


def assert_organization_access(user, organization, write=False):
    if not visible_organizations(user).filter(pk=organization.pk).exists():
        raise PermissionDenied('Você não tem acesso a esta organização.')
    if write and not (user.is_superuser or organization.owner_id == user.pk or user.role in ('admin', 'editor')):
        raise PermissionDenied('Apenas administradores e editores podem alterar a marca.')


def get_brand_for_user(user, brand_id, organization_id=None, allow_archived=False):
    try:
        brand = Brand.objects.select_related('organization').filter(organization__in=visible_organizations(user), pk=brand_id).first()
    except (ValueError, TypeError, ValidationError, DjangoValidationError):
        brand = None
    if brand is None:
        raise NotFound('Marca não encontrada.')
    if organization_id is not None and str(brand.organization_id) != str(organization_id):
        raise ValidationError({'brand': 'Marca e recurso devem pertencer à mesma organização.'})
    if not allow_archived and brand.status != 'active':
        raise ValidationError({'brand': 'Marcas arquivadas não podem ser utilizadas em novos catálogos.'})
    return brand


def validate_safe_url(value, allow_relative=False):
    if not value:
        return ''
    if not isinstance(value, str) or len(value) > 2048:
        raise ValidationError('URL inválida.')
    try:
        parts = urlsplit(value)
        decoded_path = parts.path
    except ValueError as error:
        raise ValidationError('URL inválida.') from error
    for _ in range(3):
        decoded_path = unquote(decoded_path)
    if any(part in ('.', '..') for part in decoded_path.split('/')) or any(ord(char) < 32 for char in decoded_path) or '\\' in decoded_path:
        raise ValidationError('Caminho de URL inválido.')
    if allow_relative and value.startswith('/') and not value.startswith('//') and not any(c in value for c in ('\\', '\r', '\n')):
        return value
    if parts.scheme not in ('https', 'http') or not parts.hostname or parts.username or parts.password:
        raise ValidationError('Utilize uma URL HTTP(S) válida, sem credenciais.')
    # Retained URLs are never fetched by the backend. Deny executable/data/blob schemes.
    if any(c in value for c in ('\r', '\n', '\\')):
        raise ValidationError('URL inválida.')
    return value


def _record(item):
    return {key: getattr(item, key) for key in ('id', 'type', 'category', 'rule', 'source', 'status', 'confidence')}


class BrandContextResolver:
    @staticmethod
    def resolve(brand, products=None, catalog_intent=None, user_request=''):
        # Read an immutable revision, avoiding mixtures of stale identity/live rules.
        version = brand.versions.filter(number=brand.current_version).first()
        if version is not None:
            context = copy.deepcopy(version.snapshot)
            context['categories'] = BrandContextResolver._resolve_current(brand, products)['categories']
            return context
        return BrandContextResolver._resolve_current(brand, products)

    @staticmethod
    def _resolve_current(brand, products=None):
        identity = {
            'id': str(brand.pk), 'name': brand.name, 'slug': brand.slug,
            'description': brand.description, 'segment': brand.segment,
            'website': brand.website, 'brand_markdown': brand.brand_markdown,
            'commercial_contact': copy.deepcopy(brand.commercial_contact),
        }
        assets = []
        for asset in brand.assets.filter(active=True).select_related('media').order_by('id'):
            if asset.media.organization_id != brand.organization_id:
                continue
            assets.append({'id': asset.pk, 'type': asset.asset_type, 'url': asset.media.file.url,
                           'width': asset.width, 'height': asset.height,
                           'policy': {**DEFAULT_ASSET_POLICY, **asset.policy}})
        if brand.logo_url and not any(a['type'] == 'logo_primary' for a in assets):
            assets.append({'id': None, 'type': 'logo_primary', 'url': brand.logo_url,
                           'width': None, 'height': None, 'policy': copy.deepcopy(DEFAULT_ASSET_POLICY)})
        palette = [copy.deepcopy(c) for c in brand.colors if c.get('status') in CONFIRMED_STATUSES]
        for role, value in brand.custom_palette.items():
            if isinstance(value, str) and re.fullmatch(r'#[0-9a-fA-F]{6}', value) and not any(c.get('hex', '').lower() == value.lower() and c.get('role') == role for c in brand.colors):
                palette.append({'hex': value, 'role': role, 'source': 'user_input', 'confidence': 1, 'status': 'user_supplied'})
        guidelines = [_record(g) for g in brand.guidelines.filter(status__in=CONFIRMED_STATUSES).order_by('id')]
        memories = [_record(m) for m in brand.memories.filter(status__in=CONFIRMED_STATUSES).order_by('id')]
        confirmed = {key: entry['value'] for key, entry in brand.intelligence.items()
                     if isinstance(entry, dict) and entry.get('status') == 'confirmed' and 'value' in entry}
        if products is None:
            category_names = list(brand.products.filter(organization_id=brand.organization_id, category__organization_id=brand.organization_id).exclude(category__isnull=True).values_list('category__name', flat=True))
        else:
            category_names = []
            for product in products:
                if isinstance(product, dict):
                    category = product.get('category') or product.get('category_name')
                    if isinstance(category, dict):
                        category = category.get('name')
                else:
                    category = getattr(getattr(product, 'category', None), 'name', None)
                if isinstance(category, str) and category.strip():
                    category_names.append(category.strip())
        counts = Counter(category_names)
        total = sum(counts.values())
        categories = [{'name': name, 'count': count, 'proportion': round(count / total, 6),
                       'source': 'product_portfolio', 'confidence': 1, 'status': 'inferred'}
                      for name, count in sorted(counts.items(), key=lambda entry: (-entry[1], entry[0]))]
        tone = {'text': brand.tone_of_voice, 'dimensions': confirmed.get('tone_dimensions', {}),
                'preferred_vocabulary': confirmed.get('preferred_vocabulary', []),
                'forbidden_expressions': confirmed.get('forbidden_expressions', []),
                'writing_rules': confirmed.get('writing_rules', [])}
        return {'identity': identity, 'assets': assets, 'palette': palette,
                'typography': copy.deepcopy(brand.typography), 'tone': tone,
                'visual_dna': copy.deepcopy(brand.visual_dna) or confirmed.get('visual_dna', {}),
                'business_profile': confirmed.get('business_profile', {}), 'categories': categories,
                'guidelines': guidelines, 'negative_constraints': [g for g in guidelines + memories if g['type'] == 'AVOID'],
                'confirmed_memories': memories,
                'meta': {'schema_version': 1, 'brand_id': str(brand.pk), 'brand_version': brand.current_version}}


def _material_context(context):
    data = copy.deepcopy(context)
    data.pop('meta', None)
    # Product distribution is observation, not an edit to customer brand truth.
    data.pop('categories', None)
    return data


@transaction.atomic
def create_material_version(brand, user):
    locked = Brand.objects.select_for_update().get(pk=brand.pk)
    context = BrandContextResolver._resolve_current(locked)
    latest = locked.versions.first()
    if latest and _material_context(latest.snapshot) == _material_context(context):
        brand.current_version = locked.current_version
        return latest
    locked.current_version += 1
    locked.save(update_fields=['current_version', 'updated_at'])
    context['meta']['brand_version'] = locked.current_version
    version = BrandVersion.objects.create(brand=locked, number=locked.current_version,
                                          snapshot=context, snapshot_hash=snapshot_hash(context), created_by=user)
    brand.current_version = locked.current_version
    return version


def bind_catalog_brand(catalog, brand, user, refresh_snapshot=False):
    assert_organization_access(user, brand.organization, write=True)
    if brand.status != 'active':
        raise ValidationError({'brand': 'Marca arquivada.'})
    if catalog.organization_id is not None and catalog.organization_id != brand.organization_id:
        raise ValidationError({'brand': 'Marca e catálogo devem pertencer à mesma organização.'})
    if catalog.brand_snapshot and not refresh_snapshot:
        if catalog.brand_id != brand.pk:
            raise ValidationError({'brand': 'A identidade histórica requer atualização explícita.'})
        return catalog
    catalog.organization = brand.organization
    catalog.brand = brand
    context = BrandContextResolver.resolve(brand)
    catalog.brand_version = context['meta']['brand_version']
    catalog.brand_snapshot = context
    catalog.brand_snapshot_hash = snapshot_hash(context)
    return catalog


def _image_metadata(file_obj):
    file_obj.seek(0)
    with Image.open(file_obj) as image:
        size = image.size
    file_obj.seek(0)
    return size


@transaction.atomic
def persist_logo(brand, value, user):
    if value == brand.logo_url:
        return
    if not value.startswith('data:'):
        brand.logo_url = validate_safe_url(value, allow_relative=True)
        path = urlsplit(value).path
        for _ in range(3):
            path = unquote(path)
        if path.startswith(settings.MEDIA_URL):
            media = Media.objects.filter(file=path[len(settings.MEDIA_URL):], organization=brand.organization).first()
            if media is None:
                raise ValidationError({'logo_url': 'O logo deve pertencer à mesma organização.'})
            valid, _, error = validate_image_file(media.file)
            if not valid:
                raise ValidationError({'logo_url': error})
            width, height = _image_metadata(media.file)
            brand.assets.filter(asset_type='logo_primary', active=True).update(active=False)
            BrandAsset.objects.create(brand=brand, media=media, asset_type='logo_primary', width=width, height=height, policy=DEFAULT_ASSET_POLICY)
            brand.logo_url = media.file.url
            return
        # Replacement leaves historical Media intact for catalog snapshots.
        brand.assets.filter(asset_type='logo_primary', active=True).update(active=False)
        return
    if len(value) > 8 * 1024 * 1024:
        raise ValidationError({'logo_url': 'O logo excede o limite de 5 MB.'})
    match = re.fullmatch(r'data:image/(png|jpeg|webp);base64,([A-Za-z0-9+/=\s]+)', value)
    if not match:
        raise ValidationError({'logo_url': 'Utilize PNG, JPEG ou WEBP válido.'})
    try:
        raw = base64.b64decode(match.group(2), validate=True)
    except (binascii.Error, ValueError) as error:
        raise ValidationError({'logo_url': 'Imagem codificada inválida.'}) from error
    file_obj = ContentFile(raw, name=f'brand-logo.{match.group(1)}')
    valid, _, error = validate_image_file(file_obj)
    if not valid:
        raise ValidationError({'logo_url': error})
    width, height = _image_metadata(file_obj)
    media = Media.objects.create(file=file_obj, name=f'{brand.name} — logo', media_type='image', organization=brand.organization, uploaded_by=user)
    brand.assets.filter(asset_type='logo_primary', active=True).update(active=False)
    BrandAsset.objects.create(brand=brand, media=media, asset_type='logo_primary', width=width, height=height, policy=DEFAULT_ASSET_POLICY)
    brand.logo_url = media.file.url


def material_save(brand, user, logo_value=None, before_version=None):
    brand.slug = slugify(brand.name)[:255]
    brand.save()
    if logo_value is not None:
        persist_logo(brand, logo_value, user)
        brand.save(update_fields=['logo_url', 'updated_at'])
    if before_version is not None:
        before_version()
    create_material_version(brand, user)
    return brand


def brand_source_fingerprint(brand):
    """A source edit invalidates proposals without depending on their own output."""
    current = BrandContextResolver._resolve_current(brand)
    return snapshot_hash({
        'identity': current['identity'], 'assets': current['assets'], 'palette': current['palette'],
        'typography': brand.typography, 'visual_dna': brand.visual_dna,
        'tone_of_voice': brand.tone_of_voice, 'categories': current['categories'],
        'portfolio_sources': list(brand.products.filter(organization_id=brand.organization_id).order_by('pk').values(
            'id', 'name', 'description', 'category_id', 'image_id', 'image__file', 'cover_image_id', 'cover_image__file'
        )),
    })
