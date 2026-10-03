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


class BlockType(str, Enum):
    """Tipos formais e fechados de primitivas de bloco generativo."""
    TEXT = "text"
    HEADLINE = "headline"
    TITLE = "title"
    IMAGE = "image"
    PRODUCT_IMAGE = "product_image"
    METADATA = "metadata"
    PRICE = "price"
    SKU = "sku"
    CAPTION = "caption"
    LINE = "line"
    SHAPE = "shape"
    FOLIO = "folio"
    BADGE = "badge"
    QUOTE = "quote"
    LOGO = "logo"
    TABLE = "table"
    COLOR_FIELD = "color_field"


GenerativeBlockType = Literal[
    "text",
    "image",
    "product_image",
    "metadata",
    "price",
    "sku",
    "caption",
    "line",
    "shape",
    "folio",
    "badge",
    "quote",
    "logo",
    "table",
    "color_field"
]

FORBIDDEN_RAW_KEYS = {
    "innerHTML",
    "dangerouslySetInnerHTML",
    "rawCss",
    "html",
    "styleString",
    "script",
    "eval",
}

DISALLOWED_URL_PROTOCOLS = [
    "javascript:",
    "vbscript:",
    "file:",
    "data:text",
    "data:application",
]


def validate_runtime_block(block_dict: Dict[str, Any]) -> Tuple[bool, List[str]]:
    """
    Executa validação runtime profunda de um bloco generativo emitido pela IA ou mutadores.
    Rejeita:
    - Tipos não cadastrados no Enum BlockType
    - Coordenadas NaN, Infinito ou fora de escala física razoável
    - Injeção de chaves arbitrárias de HTML / CSS bruto (XSS prevention)
    - URLs maliciosas com protocolo perigoso
    """
    errors: List[str] = []

    # 1. Proibição de injeção de HTML/CSS arbitrário
    for key in block_dict.keys():
        if key in FORBIDDEN_RAW_KEYS:
            errors.append(f"SECURITY_VIOLATION: DISALLOWED_KEY: Campo proibido '{key}' detectado no bloco.")

    # 2. Validação do Tipo do Bloco
    raw_type = block_dict.get("type")
    valid_types = {e.value for e in BlockType}
    if not raw_type or raw_type not in valid_types:
        errors.append(f"INVALID_BLOCK_TYPE: Tipo '{raw_type}' não pertence ao Enum BlockType.")

    # 3. Validação Numérica de Coordenadas
    for coord_name in ["x", "y", "width", "height"]:
        val = block_dict.get(coord_name)
        if val is None:
            errors.append(f"MISSING_COORDINATE: Campo '{coord_name}' é obrigatório.")
            continue
        try:
            f_val = float(val)
            if math.isnan(f_val) or math.isinf(f_val):
                errors.append(f"INVALID_NUMERIC: '{coord_name}' não pode ser NaN ou Infinito.")
            elif coord_name in ["width", "height"] and f_val <= 0.0:
                errors.append(f"INVALID_DIMENSION: '{coord_name}' deve ser > 0 (recebido {f_val}).")
            elif coord_name in ["x", "y"] and (f_val < -0.1 or f_val > 1.5):
                errors.append(f"ABSURD_COORDINATE: '{coord_name}' com valor absurdo ({f_val}).")
        except (ValueError, TypeError):
            errors.append(f"TYPE_ERROR: '{coord_name}' deve ser um número float (recebido {type(val)}).")

    # 4. Validação de Opacidade e Rotação
    opacity = block_dict.get("opacity")
    if opacity is not None:
        try:
            f_op = float(opacity)
            if math.isnan(f_op) or not (0.0 <= f_op <= 1.0):
                errors.append(f"INVALID_OPACITY: Opacidade deve estar entre 0.0 e 1.0 (recebido {f_op}).")
        except (ValueError, TypeError):
            errors.append("TYPE_ERROR: Opacidade deve ser numérica.")

    rotation = block_dict.get("rotation")
    if rotation is not None:
        try:
            f_rot = float(rotation)
            if math.isnan(f_rot) or abs(f_rot) > 360.0:
                errors.append(f"INVALID_ROTATION: Rotação deve ser finita em graus (recebido {f_rot}).")
        except (ValueError, TypeError):
            errors.append("TYPE_ERROR: Rotação deve ser numérica.")

    # 5. Validação de Segurança em Image URL
    img_url = block_dict.get("imageUrl")
    if img_url:
        clean_url = str(img_url).strip().lower()
        for proto in DISALLOWED_URL_PROTOCOLS:
            if clean_url.startswith(proto):
                errors.append(f"MALICIOUS_URL_PROTOCOL: Protocolo inseguro '{proto}' detectado em imageUrl.")
                break

    return len(errors) == 0, errors


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
