"""
Creative Director - Diretor Criativo e de Arte Editorial Autônomo.
Produz regras compositivas concretas, diretrizes fotográficas e tipográficas,
e proibições estilísticas explícitas baseadas no VisualDNA e no briefing.
"""
from dataclasses import dataclass, field, asdict
from typing import Dict, Any, List, Optional
import random
import logging
from .requirement_contract import RequirementContract
from .visual_dna import VisualDNA
from .content_planner import DocumentContentPlan

logger = logging.getLogger(__name__)


# Font Registry seguro mapeado para fontes existentes e seguras no frontend
FONT_REGISTRY = {
    "high_contrast_serif": ["Playfair Display", "Cinzel", "Prata"],
    "editorial_serif": ["Cormorant Garamond", "EB Garamond", "Instrument Serif"],
    "neo_grotesque": ["Inter", "Plus Jakarta Sans", "Jost"],
    "geometric_sans": ["Space Grotesk", "Outfit", "Syne"],
    "condensed_display": ["Oswald", "Anton", "Bebas Neue"],
    "mono": ["JetBrains Mono", "Space Mono", "IBM Plex Mono"],
}


@dataclass
class CreativeDirection:
    """Diretrizes concretas de direção de arte geradas para o catálogo."""
    concept_name: str
    concept_statement: str
    visual_narrative: str                  # "slow-fast-slow", "crescendo", "minimal_pause", "monumental_contrast"
    photographic_behavior: str             # "cropped_editorial", "monumental_bleed", "floating_detail", "spec_framing"
    typographic_behavior: str              # "oversized_off_axis_serif", "disciplined_grotesque", "scale_jump_didone"
    composition_behavior: str              # "asymmetric_controlled_tension", "stark_negative_space", "modular_discipline"
    graphic_language: str                  # "hairlines_plus_oversized_folios", "pure_typography_zero_rules", "technical_brackets"
    avoid: List[str] = field(default_factory=list)
    font_pairing: Dict[str, str] = field(default_factory=dict)
    palette_behavior: Dict[str, str] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


class CreativeDirector:
    """
    Diretor de Arte Autônomo.
    Transforma intenção estética em instruções compositivas operacionais.
    """

    CONCEPTS_BY_ARCHETYPE = {
        "luxury_editorial": [
            ("Monumental Silence", "O espaço negativo atua como luxo primordial; tipografia nobre em assimetria tensa e fotografia em corte macro.", "slow-fast-slow", "cropped_editorial", "oversized_off_axis_serif", "asymmetric_controlled_tension", "hairlines_plus_oversized_folios"),
            ("Atelier Archive", "Documentação rigorosa e despojada de ateliê com alinhamentos periféricos e respiro contemplativo.", "monumental_contrast", "floating_detail", "editorial_serif_tight", "stark_negative_space", "hairlines_plus_whisper_folios"),
            ("Fragmented Haute", "Tensão visual entre escala monumental e detalhes microscópicos de costura.", "crescendo", "monumental_bleed", "scale_jump_didone", "asymmetric_controlled_tension", "bold_folios_and_stark_contrasts"),
        ],
        "contemporary_minimalist": [
            ("Pure Volume", "Supressão total de adornos supérfluos; pureza estrutural e legibilidade arquitetônica.", "slow-fast-slow", "monumental_bleed", "disciplined_grotesque", "stark_negative_space", "pure_typography_zero_rules"),
            ("Architectural Rhythm", "Pausas ópticas generosas com grids geométricos desobstruídos e blocos esculturais.", "minimal_pause", "floating_detail", "geometric_sans_spaced", "modular_discipline", "monospaced_coordinates"),
        ],
        "brutalist_editorial": [
            ("Raw Cadence", "Grid exposto com tipografia massiva que desafia as bordas e contrastes mecânicos.", "crescendo", "cropped_editorial", "condensed_heavy_grotesque", "asymmetric_controlled_tension", "exposed_grid_markers"),
            ("Structural Tension", "Blocos tipográficos densos justapostos a campos cromáticos planos e frios.", "monumental_contrast", "spec_framing", "heavy_sans_against_mono", "modular_discipline", "thick_rules_and_stamps"),
        ],
        "commercial_technical": [
            ("Precision Matrix", "Clareza absoluta para produtos e especificações técnicas sem abrir mão de dignidade editorial.", "information_flow", "spec_framing", "disciplined_grotesque", "modular_discipline", "technical_brackets_and_tables"),
            ("Executive Clarity", "Hierarquia imediata entre SKU, preço e atributos de engenharia comercial.", "balanced_cadence", "floating_detail", "neo_grotesque_tabular", "modular_discipline", "clean_hairlines_and_badges"),
        ],
    }

    @classmethod
    def direct(
        cls,
        contract: RequirementContract,
        content_plan: DocumentContentPlan,
        visual_dna: VisualDNA,
        rag_context: Optional[Dict[str, Any]] = None,
        creative_seed: int = 42,
    ) -> CreativeDirection:
        """Elabora a direção criativa completa para a geração."""
        rng = random.Random(creative_seed)
        style_keywords = [k.lower() for k in contract.design.style_keywords]
        raw_prompt = contract.raw_prompt.lower()
        negatives = set(contract.constraints.negative)

        # 1. Determina o arquétipo estético dominante
        if any(k in style_keywords or k in raw_prompt for k in ["luxury", "luxo", "alta costura", "haute", "joias", "couture"]):
            archetype = "luxury_editorial"
        elif any(k in style_keywords or k in raw_prompt for k in ["brutalist", "brutalista", "raw"]):
            archetype = "brutalist_editorial"
        elif any(k in style_keywords or k in raw_prompt for k in ["technical", "tecnico", "b2b", "especificacao", "industrial"]):
            archetype = "commercial_technical"
        else:
            archetype = "contemporary_minimalist"

        # 2. Seleciona conceito determinístico via creative_seed
        concepts = cls.CONCEPTS_BY_ARCHETYPE[archetype]
        concept_idx = rng.randint(0, len(concepts) - 1)
        name, statement, narrative, photo_beh, typo_beh, comp_beh, graphic_lang = concepts[concept_idx]

        # 3. Lista de proibições criativas (Anti-Generic & Anti-Cliche)
        avoid = [
            "centered hero on consecutive pages",
            "uniform cards across all items",
            "redundant decorative horizontal line below every heading",
            "generic purple gradient SaaS treatment",
            "monogram inside circle on every single cover",
        ]

        if "NO_CARDS" in negatives:
            avoid.append("cards and boxed containers")
        if "NO_IMAGES" in negatives:
            avoid.append("photography and editorial background images")
            photo_beh = "typography_only"
        if "NO_GRADIENTS" in negatives:
            avoid.append("color gradients")
        if visual_dna.symmetry < 0.4:
            avoid.append("symmetrical central axes")

        # 4. Seleção segura de Font Pairing a partir do FONT_REGISTRY
        if archetype == "luxury_editorial":
            # Não usar sempre a mesma fonte: variar entre as famílias editoriais seguras
            display_family = rng.choice(FONT_REGISTRY["editorial_serif"] if visual_dna.experimentalism < 0.6 else FONT_REGISTRY["high_contrast_serif"])
            body_family = rng.choice(FONT_REGISTRY["neo_grotesque"])
            mono_family = FONT_REGISTRY["mono"][0]
        elif archetype == "brutalist_editorial":
            display_family = rng.choice(FONT_REGISTRY["condensed_display"] + FONT_REGISTRY["geometric_sans"])
            body_family = rng.choice(FONT_REGISTRY["neo_grotesque"])
            mono_family = FONT_REGISTRY["mono"][1]
        elif archetype == "commercial_technical":
            display_family = FONT_REGISTRY["neo_grotesque"][0]
            body_family = FONT_REGISTRY["neo_grotesque"][1]
            mono_family = FONT_REGISTRY["mono"][2]
        else:
            display_family = rng.choice(FONT_REGISTRY["geometric_sans"])
            body_family = rng.choice(FONT_REGISTRY["neo_grotesque"])
            mono_family = FONT_REGISTRY["mono"][0]

        font_pairing = {
            "display": display_family,
            "body": body_family,
            "metadata": mono_family,
            "displayRole": "high_contrast_serif" if "Serif" in display_family or "Cinzel" in display_family or "Playfair" in display_family else "geometric_sans",
            "bodyRole": "neo_grotesque",
            "metadataRole": "mono",
        }

        # 5. Comportamento cromático
        palette_behavior = {
            "contrast_strategy": "high_contrast_editorial",
            "accent_usage": "restrained_focal_points",
            "dominant_tone": "noir_and_ivory" if "NO_COLORS" not in negatives else "pure_monochrome",
        }

        return CreativeDirection(
            concept_name=name,
            concept_statement=statement,
            visual_narrative=narrative,
            photographic_behavior=photo_beh,
            typographic_behavior=typo_beh,
            composition_behavior=comp_beh,
            graphic_language=graphic_lang,
            avoid=avoid,
            font_pairing=font_pairing,
            palette_behavior=palette_behavior,
        )
