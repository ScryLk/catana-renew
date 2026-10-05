"""
Requirement Contract - Modelagem Estruturada de Requisitos para Design Editorial.
Define as estruturas de dados formais para transformar solicitações livres do usuário
em um contrato verificável, desacoplado de templates e modelos de linguagem.
"""
from dataclasses import dataclass, field, asdict
from typing import List, Dict, Any, Optional, Literal


PageCountMode = Literal["exact", "maximum", "minimum", "auto"]
OrientationType = Literal["portrait", "landscape", "square"]
ColorSpaceType = Literal["monochrome", "duotone", "full_color", "high_contrast"]


@dataclass
class OutputRequirements:
    """Requisitos de mídia e formato de saída."""
    type: str = "catalog"  # catalog, lookbook, presentation, data_sheet, menu, report
    page_count: Optional[int] = None
    page_count_mode: PageCountMode = "auto"
    orientation: OrientationType = "portrait"
    dimensions: Optional[Dict[str, int]] = None  # ex: {"width": 794, "height": 1123}
    language: str = "pt-BR"


@dataclass
class ContentRequirements:
    """Requisitos semânticos de conteúdo textual e dados."""
    required: List[str] = field(default_factory=list)
    optional: List[str] = field(default_factory=list)
    forbidden: List[str] = field(default_factory=list)
    user_provided_content: List[str] = field(default_factory=list)
    preserve_verbatim: List[str] = field(default_factory=list)


@dataclass
class DesignRequirements:
    """Diretrizes estéticas parametrizadas em espaço contínuo (0-100)."""
    style_keywords: List[str] = field(default_factory=list)
    visual_energy: int = 50          # 0 (estático/calmo) a 100 (explosivo/dinâmico)
    density: int = 50                # 0 (ultra-respiro/luxo) a 100 (máxima informação/b2b)
    whitespace: int = 50             # 0 (sem respiro) a 100 (respiro monumental)
    symmetry: int = 50               # 0 (assimétrico) a 100 (simetria pura)
    typographic_contrast: int = 50   # 0 (neutro/uniforme) a 100 (dramático/display)
    image_dominance: int = 50        # 0 (text-led/sem fotos) a 100 (photo-led)
    decorative_intensity: int = 30   # 0 (funcional puro) a 100 (ricamente ornamentado)
    grid_rigidity: int = 60          # 0 (experimental livre) a 100 (grid suíço implacável)
    layout_behavior: List[str] = field(default_factory=list)
    typography_preferences: List[str] = field(default_factory=list)
    color_preferences: List[str] = field(default_factory=list)
    allowed_color_space: Optional[ColorSpaceType] = None
    image_behavior: Optional[str] = None  # photo_led, typography_led, data_led, diagram_led


@dataclass
class ConstraintSet:
    """Conjunto formal de restrições por ordem de precedência."""
    hard: List[str] = field(default_factory=list)               # P1: Restrições cardinais invioláveis
    content_mandatory: List[str] = field(default_factory=list)  # P2: Dados obrigatórios do usuário
    negative: List[str] = field(default_factory=list)           # P3: Itens/padrões proibidos
    format: List[str] = field(default_factory=list)             # P4: Limites de mídia/canvas
    soft: List[str] = field(default_factory=list)               # P6: Preferências negociáveis


@dataclass
class AssetInventory:
    """Inventário de mídias e ativos fornecidos ou requeridos."""
    images: List[Dict[str, Any]] = field(default_factory=list)
    logos: List[Dict[str, Any]] = field(default_factory=list)
    documents: List[Dict[str, Any]] = field(default_factory=list)
    missing_assets: List[str] = field(default_factory=list)
    has_product_images: bool = False


@dataclass
class RequirementContract:
    """
    Contrato Unificado de Requisitos.
    Representa a especificação completa e imutável que rege a geração do documento.
    """
    output: OutputRequirements = field(default_factory=OutputRequirements)
    content: ContentRequirements = field(default_factory=ContentRequirements)
    design: DesignRequirements = field(default_factory=DesignRequirements)
    constraints: ConstraintSet = field(default_factory=ConstraintSet)
    assets: AssetInventory = field(default_factory=AssetInventory)
    raw_prompt: str = ""
    brand_context: Dict[str, Any] = field(default_factory=dict)
    source_document: Dict[str, Any] = field(default_factory=dict)
    detected_industry: str = "general_retail"

    def to_dict(self) -> Dict[str, Any]:
        """Serializa o contrato para dicionário legível por JSON."""
        result = asdict(self)
        if not self.brand_context:
            result.pop('brand_context')
        if not self.source_document:
            result.pop('source_document')
        return result

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "RequirementContract":
        """Instancia o contrato a partir de um dicionário."""
        output_data = data.get("output", {})
        content_data = data.get("content", {})
        design_data = data.get("design", {})
        constraints_data = data.get("constraints", {})
        assets_data = data.get("assets", {})

        return cls(
            output=OutputRequirements(**output_data) if isinstance(output_data, dict) else OutputRequirements(),
            content=ContentRequirements(**content_data) if isinstance(content_data, dict) else ContentRequirements(),
            design=DesignRequirements(**design_data) if isinstance(design_data, dict) else DesignRequirements(),
            constraints=ConstraintSet(**constraints_data) if isinstance(constraints_data, dict) else ConstraintSet(),
            assets=AssetInventory(**assets_data) if isinstance(assets_data, dict) else AssetInventory(),
            raw_prompt=data.get("raw_prompt", ""),
            brand_context=data.get("brand_context", {}) if isinstance(data.get("brand_context", {}), dict) else {},
            source_document=data.get("source_document", {}) if isinstance(data.get("source_document", {}), dict) else {},
            detected_industry=data.get("detected_industry", "general_retail"),
        )
