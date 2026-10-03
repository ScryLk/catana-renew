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
