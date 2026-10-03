"""
Font Registry - Fonte Única da Verdade para Tipografia do Catana.
Garante paridade total entre fontes sugeridas pelo CreativeDirector no backend
e fontes instaladas/carregadas no frontend DOM, html2canvas e PDF export.
"""
import json
import os
from typing import Dict, List, Any

_CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
_SHARED_JSON_PATH = os.path.abspath(os.path.join(_CURRENT_DIR, "..", "..", "..", "shared", "font_registry.json"))

DEFAULT_FONT_REGISTRY: Dict[str, List[str]] = {
    "high_contrast_serif": ["Playfair Display", "Cinzel", "Prata"],
    "editorial_serif": ["Cormorant Garamond", "Instrument Serif"],
    "neo_grotesque": ["Inter", "Plus Jakarta Sans", "Jost"],
    "geometric_sans": ["Space Grotesk", "Outfit", "Syne"],
    "condensed_display": ["Oswald", "Anton", "Bebas Neue"],
    "mono": ["JetBrains Mono", "Space Mono", "IBM Plex Mono"],
}

ALL_VERIFIED_FONTS: List[str] = [
    "Cormorant Garamond",
    "Playfair Display",
    "Cinzel",
    "Prata",
    "Instrument Serif",
    "Inter",
    "Plus Jakarta Sans",
    "Jost",
    "Space Grotesk",
    "Outfit",
    "Syne",
    "Oswald",
    "Anton",
    "Bebas Neue",
    "JetBrains Mono",
    "Space Mono",
    "IBM Plex Mono",
]


def load_font_registry() -> Dict[str, Any]:
    if os.path.exists(_SHARED_JSON_PATH):
        try:
            with open(_SHARED_JSON_PATH, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return {
        "categories": {k: {"fonts": v, "default": v[0]} for k, v in DEFAULT_FONT_REGISTRY.items()},
        "all_fonts": ALL_VERIFIED_FONTS,
    }


def is_font_available(font_family: str) -> bool:
    """Verifica se a fonte solicitada está registrada e carregada no frontend."""
    if not font_family:
        return False
    clean_name = font_family.strip().replace('"', '').replace("'", "")
    return any(clean_name.lower() == f.lower() for f in ALL_VERIFIED_FONTS)


# Alias
is_font_verified = is_font_available


def resolve_font_fallback(font_role: str, requested_font: str = None) -> str:
    """Retorna a fonte solicitada se válida ou um fallback seguro verificado para o role."""
    if requested_font and is_font_available(requested_font):
        return requested_font
    if font_role == "display":
        return "Cormorant Garamond"
    if font_role == "metadata":
        return "JetBrains Mono"
    return "Inter"
