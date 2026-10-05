"""
Design Grammar - Primitives de Composição e Gramática Visual Editorial.
Define os blocos estruturais elementares e regras geométricas de composição normalizada (0.0 a 1.0).
Inclui validação runtime rigorosa contra dados malformados, injeção de HTML/CSS arbitrário e URLs maliciosas.
"""
from dataclasses import dataclass, field, asdict
from enum import Enum
import math
import re
from typing import Dict, Any, List, Optional, Tuple, Literal

DEFAULT_SAFE_AREA: Dict[str, float] = {"top": 0.04, "right": 0.04, "bottom": 0.04, "left": 0.04}


from .contracts import BLOCK_TYPES

BlockType = Enum('BlockType', {value.upper(): value for value in BLOCK_TYPES}, type=str)
GenerativeBlockType = str
FORBIDDEN_RAW_KEYS = {
    'innerhtml', 'dangerouslysetinnerhtml', 'rawhtml', 'rawcss', 'html',
    'stylestring', 'script', 'eval', 'onclick', 'onload', 'onerror',
}


def is_safe_image_url(url):
    if not isinstance(url, str) or not url.strip():
        return False
    value = url.strip()
    if any(ord(c) < 32 for c in value) or "\\" in value:
        return False
    return bool(re.match(r'^(https?://[^/\s]+|/(?!/)|blob:|data:image/(png|jpeg|webp|gif);base64,)', value, re.I))


def validate_runtime_block(block_dict):
    errors = []
    if not isinstance(block_dict, dict):
        return False, ['INVALID_BLOCK_OBJECT']

    def inspect(value):
        if isinstance(value, dict):
            for key, child in value.items():
                if key.lower() in FORBIDDEN_RAW_KEYS or key.lower().startswith('on'):
                    errors.append('SECURITY_VIOLATION: DISALLOWED_KEY: ' + key)
                if key.lower() in {'imageurl', 'src', 'url', 'href'} and child is not None and not is_safe_image_url(child):
                    errors.append('MALICIOUS_URL_PROTOCOL: ' + key)
                inspect(child)
        elif isinstance(value, list):
            for child in value:
                inspect(child)
        elif isinstance(value, float) and not math.isfinite(value):
            errors.append('INVALID_NUMERIC: non-finite nested value')
    inspect(block_dict)
    if not isinstance(block_dict.get('id'), str) or not block_dict['id']:
        errors.append('INVALID_BLOCK_ID')
    if block_dict.get('type') not in BLOCK_TYPES:
        errors.append('INVALID_BLOCK_TYPE')
    numbers = {}
    for key in ('x', 'y', 'width', 'height'):
        value = block_dict.get(key)
        if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value):
            errors.append('INVALID_NUMERIC: ' + key)
        else:
            numbers[key] = value
    if len(numbers) == 4:
        x, y, w, h = (numbers[k] for k in ('x', 'y', 'width', 'height'))
        margin = 0.05 if block_dict.get('bleed') is True else 0.0
        if w <= 0 or h <= 0 or x < -margin or y < -margin or x + w > 1 + margin + 1e-9 or y + h > 1 + margin + 1e-9:
            errors.append('INVALID_BLOCK_BOUNDS')
    for key, low, high in [('opacity', 0, 1), ('rotation', -360, 360),
                           ('fontSize', 0.1, 500), ('fontWeight', 1, 1000),
                           ('lineHeight', 0.1, 10), ('zIndex', -100, 1000)]:
        value = block_dict.get(key)
        if value is not None and (isinstance(value, bool) or not isinstance(value, (int, float)) or
                                  not math.isfinite(value) or not low <= value <= high):
            errors.append('INVALID_NUMERIC: ' + key)
    for key in ('imageUrl', 'fontFamily', 'letterSpacing', 'colorToken'):
        value = block_dict.get(key)
        if value is not None and not isinstance(value, str):
            errors.append('INVALID_PROPERTY: ' + key)
    if block_dict.get('content') is not None and (isinstance(block_dict['content'], bool) or not isinstance(block_dict['content'], (str,int,float))):
        errors.append('INVALID_PROPERTY: content')
    for key, allowed in [('alignment', {'left','center','right'}), ('textTransform', {'none','uppercase','lowercase'}), ('cropMode', {'cover','contain','editorial'})]:
        if key in block_dict and block_dict[key] not in allowed:
            errors.append('INVALID_PROPERTY: ' + key)
    spacing = block_dict.get('letterSpacing')
    if spacing is not None and not re.fullmatch(r'-?\d+(?:\.\d+)?(?:em|px)', str(spacing)):
        errors.append('INVALID_LETTER_SPACING')
    return not errors, errors


@dataclass
class GenerativeBlock:
    """
    Bloco individual de composição geométrica com coordenadas normalizadas (0.0 a 1.0).
    Independente de resolução de tela, renderizável em PDF, Canvas e DOM com proporção perfeita.
    """
    id: str
    type: BlockType | str                  # BlockType enum ou string canônica correspondente
    role: str = "element"                  # "headline", "body", "hero_image", "caption", "folio", "price_tag"
    x: float = 0.0                         # 0.0 a 1.0
    y: float = 0.0                         # 0.0 a 1.0
    width: float = 0.5                     # 0.0 a 1.0
    height: float = 0.2                    # 0.0 a 1.0
    rotation: float = 0.0                  # Graus (-45 a +45)
    opacity: float = 1.0                   # 0.0 a 1.0
    zIndex: int = 1                        # Camada de profundidade
    alignment: str = "left"                # "left", "center", "right"
    fontRole: str = "body"                 # "display", "body", "metadata"
    fontFamily: Optional[str] = None       # Família concreta da fonte (ex: "Instrument Serif")
    fontSize: Optional[float] = None       # Tamanho relativo (pt / escala)
    fontWeight: Optional[int] = 400        # 300, 400, 500, 600, 700
    letterSpacing: Optional[str] = None    # "0.05em", "0.2em"
    lineHeight: Optional[float] = 1.3
    textTransform: Optional[str] = "none"  # "uppercase", "none", "lowercase"
    colorToken: str = "primary"            # "primary", "background", "accent", "muted", "surface" ou HEX
    content: Optional[str] = None          # Texto do bloco
    productId: Optional[str] = None        # ID do produto associado
    imageUrl: Optional[str] = None         # URL da fotografia / asset
    cropMode: str = "cover"                # "cover", "contain", "editorial"
    bleed: bool = False                    # Se ultrapassa intencionalmente as margens
    allowOverlap: bool = False             # Se a sobreposição é intencional
    provenance: Optional[Dict[str, Any]] = None
    intentionalCrop: bool = False          # Se o corte do elemento é intencional

    def __post_init__(self):
        if isinstance(self.type, BlockType):
            self.type = self.type.value

    def to_dict(self) -> Dict[str, Any]:
        d = asdict(self)
        if isinstance(d.get("type"), BlockType):
            d["type"] = d["type"].value
        # Limpa None para deixar o JSON enxuto
        return {k: v for k, v in d.items() if v is not None}


@dataclass
class GenerativeGridSpec:
    """Configuração da malha compositiva da prancheta."""
    columns: int = 12
    rows: int = 16
    gutter: float = 0.02


@dataclass
class GenerativeCompositionMeta:
    """Metadados da composição espacial da prancheta."""
    grid: GenerativeGridSpec = field(default_factory=GenerativeGridSpec)
    balance: str = "asymmetric"            # "asymmetric", "axial", "diagonal"
    axis: str = "diagonal"
    whitespaceRatio: float = 0.45
    visualTension: float = 0.60
    dominantPrimitive: str = "headline"

    def to_dict(self) -> Dict[str, Any]:
        return {
            "grid": asdict(self.grid),
            "balance": self.balance,
            "axis": self.axis,
            "whitespaceRatio": self.whitespaceRatio,
            "visualTension": self.visualTension,
            "dominantPrimitive": self.dominantPrimitive,
        }
