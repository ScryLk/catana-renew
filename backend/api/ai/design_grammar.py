"""
Design Grammar - Primitives de Composição e Gramática Visual Editorial.
Define os blocos estruturais elementares e regras geométricas de composição normalizada (0.0 a 1.0).
"""
from dataclasses import dataclass, field, asdict
from typing import Dict, Any, List, Optional, Literal

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


@dataclass
class GenerativeBlock:
    """
    Bloco individual de composição geométrica com coordenadas normalizadas (0.0 a 1.0).
    Independente de resolução de tela, renderizável em PDF, Canvas e DOM com proporção perfeita.
    """
    id: str
    type: str                              # "text", "image", "product_image", "metadata", "price", "sku", etc.
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

    def to_dict(self) -> Dict[str, Any]:
        d = asdict(self)
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
