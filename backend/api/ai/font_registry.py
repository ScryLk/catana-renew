"""Typography derived exclusively from the shared, versioned registry."""
import json
from .contracts import SHARED_ROOT


def load_font_registry():
    data = json.loads((SHARED_ROOT / 'font_registry.json').read_text())
    fonts = data['fonts']
    categories, roles = {}, {}
    for font in fonts:
        category = categories.setdefault(font['category'], {'fonts': [], 'default': font['family']})
        category['fonts'].append(font['family'])
        for role in font['roles']:
            roles.setdefault(role, []).append(font['family'])
    return {**data, 'categories': categories, 'roles': roles,
            'all_fonts': [font['family'] for font in fonts]}


try:
    _REGISTRY = load_font_registry()
except (OSError, ValueError, KeyError, TypeError):
    # No copied registry: generation will fail closed if registry-dependent planning fails.
    _REGISTRY = {'all_fonts': [], 'categories': {}, 'fallbacks': {'body': 'sans-serif'}}
ALL_VERIFIED_FONTS = _REGISTRY['all_fonts']
DEFAULT_FONT_REGISTRY = {key: value['fonts'] for key, value in _REGISTRY['categories'].items()}


def is_font_available(font_family):
    return isinstance(font_family, str) and font_family.strip('\"\' ').lower() in {f.lower() for f in ALL_VERIFIED_FONTS}


is_font_verified = is_font_available


def resolve_font_fallback(font_role, requested_font=None):
    if is_font_available(requested_font):
        return next(f for f in ALL_VERIFIED_FONTS if f.lower() == requested_font.strip('\"\' ').lower())
    return _REGISTRY['fallbacks'].get(font_role, _REGISTRY['fallbacks']['body'])


def resolve_pdf_font(name, weight=0):
    """Resolve PDF naming conventions against the one shared font registry.

    Registry membership describes a supported browser family, never proof that
    the embedded PDF font is byte-identical to that web font.
    """
    import re
    source = re.sub(r'^[A-Z]{6}\+', '', name or '')
    token = re.sub(r'[^a-z0-9]', '', source.lower())
    style = 'italic' if any(s in token for s in ('italic', 'oblique', 'itmt')) else 'normal'
    inferred = next((value for suffix, value in (
        ('extrabold', 800), ('semibold', 600), ('demibold', 600), ('black', 900),
        ('bold', 700), ('light', 300), ('medium', 500), ('thin', 100),
    ) if suffix in token), 700 if token.endswith('bd') else 400)
    family_token = re.sub(r'(?:psmt|ps|mt|ltstd|std|regular|roman|extrabold|semibold|demibold|bold|black|light|medium|thin|italic|oblique|bd|it)+$', '', token)
    if token.startswith('timesnewroman'):
        family_token = 'timesnewroman'
    families = {re.sub(r'[^a-z0-9]', '', f.lower()): f for f in ALL_VERIFIED_FONTS}
    resolved = families.get(family_token) or families.get(token)
    status = 'exact' if resolved and source == resolved else 'registry_alias' if resolved else None
    if not resolved:
        aliases = {'arial': 'Arial', 'helvetica': 'Arial', 'helveticaneue': 'Arial',
                   'timesnewroman': 'Times New Roman', 'times': 'Times New Roman',
                   'courier': 'Courier New', 'couriernew': 'Courier New'}
        resolved = aliases.get(family_token)
        status = 'compatible_family' if resolved else None
    if not resolved:
        role = 'metadata' if any(s in token for s in ('mono', 'courier', 'code')) else 'display' if 'serif' in token and 'sans' not in token else 'body'
        resolved = resolve_font_fallback(role)
        status = 'generic_fallback'
    return {'sourceFont': name, 'sourceFamily': families.get(family_token, re.sub(r'(?i)(?:[- ]?(?:regular|bold|italic|oblique|semibold|light|medium))+$', '', source)),
            'resolvedFont': resolved, 'fontResolutionStatus': status,
            'fontResolutionConfidence': 1.0 if status == 'exact' else .9 if status == 'registry_alias' else .5,
            'fontFallback': status not in ('exact', 'registry_alias'),
            'fontWeight': weight if 100 <= weight <= 900 else inferred, 'fontStyle': style}
