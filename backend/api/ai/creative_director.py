"""
Creative Director - Diretor Criativo e de Arte Editorial Autônomo.
Produz regras compositivas concretas, diretrizes fotográficas e tipográficas através de
composição combinatória ortogonal (ritmo, eixo, tipografia, fotografia, ornamento, malha),
governada pelo VisualDNA e princípios do RAG, eliminando presets fechados.
"""
from dataclasses import dataclass, field, asdict
from typing import Dict, Any, List, Optional
import random
import logging
from .requirement_contract import RequirementContract
from .visual_dna import VisualDNA
from .content_planner import DocumentContentPlan
from .font_registry import ALL_VERIFIED_FONTS, DEFAULT_FONT_REGISTRY, load_font_registry
from .rag_principle_extractor import RAGPrincipleExtractor
from .constraint_engine import ConstraintEngine

logger = logging.getLogger(__name__)

# Backward-compatibility alias
FONT_REGISTRY = DEFAULT_FONT_REGISTRY


@dataclass
class CreativeDirection:
    """Diretrizes concretas de direção de arte geradas para o catálogo."""
    concept_name: str
    concept_statement: str
    visual_narrative: str                  # "slow-fast-slow", "crescendo", "minimal_pause", "monumental_contrast", "dense_flow"
    photographic_behavior: str             # "cropped_editorial", "monumental_bleed", "floating_detail", "spec_framing", "typography_only"
    typographic_behavior: str              # "oversized_off_axis_serif", "disciplined_grotesque", "scale_jump_didone", "heavy_sans_against_mono"
    composition_behavior: str              # "asymmetric_controlled_tension", "stark_negative_space", "modular_discipline"
    graphic_language: str                  # "hairlines_plus_oversized_folios", "pure_typography_zero_rules", "technical_brackets"
    axis_strategy: str = "asymmetric_left" # "asymmetric_left", "asymmetric_right", "diagonal_dynamic", "stark_horizontal"
    grid_strategy: str = "modular_loose"   # "broken_12_column", "modular_loose", "strict_12_column"
    scale_strategy: str = "high_contrast"  # "extreme_scale_contrast", "harmonic_progression", "monumental_focal"
    avoid: List[str] = field(default_factory=list)
    font_pairing: Dict[str, str] = field(default_factory=dict)
    palette_behavior: Dict[str, str] = field(default_factory=dict)
    brand_voice: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        result = asdict(self)
        if not self.brand_voice:
            result.pop('brand_voice')
        return result


class CreativeDirector:
    """
    Diretor de Arte Autônomo com Composição Combinatória.
    Evita templates Python fixos ao compor dimensões independentes parametrizadas pelo VisualDNA.
    """

    RHYTHM_STRATEGIES = [
        "slow-fast-slow",
        "crescendo",
        "minimal_pause",
        "monumental_contrast",
        "dense_flow",
    ]

    TYPOGRAPHIC_STRATEGIES = [
        "oversized_off_axis_serif",
        "disciplined_grotesque",
        "scale_jump_didone",
        "geometric_sans_spaced",
        "heavy_sans_against_mono",
    ]

    PHOTOGRAPHIC_STRATEGIES = [
        "cropped_editorial",
        "monumental_bleed",
        "floating_detail",
        "spec_framing",
    ]

    GRID_STRATEGIES = [
        "broken_12_column",
        "modular_loose",
        "strict_12_column",
        "single_axis_asymmetric",
    ]

    AXIS_STRATEGIES = [
        "asymmetric_left",
        "asymmetric_right",
        "diagonal_dynamic",
        "stark_horizontal",
    ]

    ORNAMENT_STRATEGIES = [
        "hairlines_plus_oversized_folios",
        "pure_typography_zero_rules",
        "technical_brackets",
        "whisper_folios_clean",
    ]

    @classmethod
    def direct(
        cls,
        contract: RequirementContract,
        content_plan: DocumentContentPlan,
        visual_dna: VisualDNA,
        rag_context: Optional[Dict[str, Any]] = None,
        creative_seed: int = 42,
        brand_context: Optional[Dict[str, Any]] = None,
    ) -> CreativeDirection:
        """Elabora a direção criativa combinatória para o catálogo."""
        load_font_registry()  # An unavailable/corrupt canonical registry fails closed.
        rng = random.Random(creative_seed)
        negatives = set(contract.constraints.negative)
        brand_context = brand_context or contract.brand_context
        brand_rules = ConstraintEngine.brand_rules(brand_context)

        # 1. Extração de princípios via RAGPrincipleExtractor
        rag_principles = RAGPrincipleExtractor.extract_principles(rag_context)

        # 2. Seleção Combinatória Independente de Dimensões Artísticas

        # 2.1 Ritmo Narrativo (Influenciado pelo target de whitespace do VisualDNA)
        if visual_dna.whitespace_ratio > 0.50:
            rhythm_pool = ["slow-fast-slow", "minimal_pause", "monumental_contrast"]
        elif visual_dna.whitespace_ratio < 0.35:
            rhythm_pool = ["dense_flow", "crescendo"]
        else:
            rhythm_pool = cls.RHYTHM_STRATEGIES
        visual_narrative = rng.choice(rhythm_pool)

        # 2.2 Estratégia de Eixo (Governada por Simetria e Tensão Visual)
        if visual_dna.symmetry < 0.40:
            axis_pool = ["asymmetric_left", "asymmetric_right", "diagonal_dynamic"]
        elif visual_dna.symmetry > 0.70:
            axis_pool = ["stark_horizontal"]
        else:
            axis_pool = cls.AXIS_STRATEGIES
        axis_strat = rng.choice(axis_pool)

        # 2.3 Estratégia de Malha / Grid
        if visual_dna.grid_rigidity > 0.65:
            grid_strat = "strict_12_column"
        elif visual_dna.experimentalism > 0.60:
            grid_strat = "broken_12_column"
        else:
            grid_strat = rag_principles.get("grid_behavior", "modular_loose")

        # 2.4 Estratégia Fotográfica (Com proteção de NO_IMAGES)
        if "NO_IMAGES" in negatives:
            photo_beh = "typography_only"
        else:
            photo_beh = rag_principles.get("image_behavior") or rng.choice(cls.PHOTOGRAPHIC_STRATEGIES)

        # 2.5 Estratégia Tipográfica (Governada por contraste e experimentalismo)
        if visual_dna.contrast_ratio > 0.70:
            typo_pool = ["scale_jump_didone", "oversized_off_axis_serif"]
        elif visual_dna.grid_rigidity > 0.60:
            typo_pool = ["disciplined_grotesque", "heavy_sans_against_mono"]
        else:
            typo_pool = cls.TYPOGRAPHIC_STRATEGIES
        if brand_rules['avoid_serif']:
            typo_pool = [t for t in typo_pool if 'serif' not in t and 'didone' not in t] or ['disciplined_grotesque']
        typo_beh = rng.choice(typo_pool)

        # 2.6 Linguagem Gráfica e Ornamentos
        if "no_cards" in contract.design.layout_behavior or "NO_CARDS" in negatives:
            ornament_pool = ["hairlines_plus_oversized_folios", "pure_typography_zero_rules", "whisper_folios_clean"]
        else:
            ornament_pool = cls.ORNAMENT_STRATEGIES
        graphic_lang = rng.choice(ornament_pool)

        # 3. Composição de Conceito e Declaração de Arte
        style_keywords = [k.lower() for k in contract.design.style_keywords]
        raw_prompt = contract.raw_prompt.lower()
        
        is_luxury = any(k in style_keywords or k in raw_prompt for k in ["luxury", "luxo", "alta costura", "haute", "couture", "joias"])
        is_tech = any(k in style_keywords or k in raw_prompt for k in ["technical", "tecnico", "b2b", "industrial", "engenharia"])
        
        if is_luxury:
            concept_name = "Haute Disruption" if visual_dna.experimentalism > 0.5 else "Monumental Silence"
            statement = "Espaço negativo e tensão tipográfica articulados com precisão de alta-costura."
        elif is_tech:
            concept_name = "Precision Matrix"
            statement = "Estrutura modular de máxima densidade informacional e legibilidade analítica."
        else:
            concept_name = "Architectural Cadence"
            statement = "Composição contemporânea com malha fluida e respiro óptico escultural."

        # 4. Proibições Críticas
        avoid = [
            "centered hero on consecutive pages",
            "uniform cards across all items",
            "redundant decorative horizontal line below every heading",
            "monogram inside circle on every single cover",
        ]
        if "NO_CARDS" in negatives:
            avoid.append("cards and boxed containers")
        if "NO_IMAGES" in negatives:
            avoid.append("photography and editorial background images")
        if "NO_GRADIENTS" in negatives:
            avoid.append("color gradients")
        if visual_dna.symmetry < 0.4:
            avoid.append("symmetrical central axes")

        # 5. Seleção Determinística e Verificada de Fontes (FONT REGISTRY)
        serif_options = DEFAULT_FONT_REGISTRY["editorial_serif"] + DEFAULT_FONT_REGISTRY["high_contrast_serif"]
        sans_options = DEFAULT_FONT_REGISTRY["geometric_sans"] + DEFAULT_FONT_REGISTRY["neo_grotesque"]
        mono_options = DEFAULT_FONT_REGISTRY["mono"]

        if is_luxury or "serif" in typo_beh:
            display_font = rng.choice(serif_options)
            body_font = rng.choice(DEFAULT_FONT_REGISTRY["neo_grotesque"])
        elif is_tech or "mono" in typo_beh:
            display_font = rng.choice(DEFAULT_FONT_REGISTRY["condensed_display"] + sans_options)
            body_font = DEFAULT_FONT_REGISTRY["neo_grotesque"][0]
        else:
            display_font = rng.choice(sans_options)
            body_font = rng.choice(DEFAULT_FONT_REGISTRY["neo_grotesque"])

        metadata_font = rng.choice(mono_options)

        if brand_context:
            fonts = brand_context.get('typography') or {}
            safe_sans = [f for f in sans_options if not ConstraintEngine.font_forbidden(f, brand_rules)]
            if not safe_sans:
                raise ValueError('BRAND_FONT_CONFLICT')
            for role, key in [('display', 'heading_font'), ('body', 'body_font')]:
                requested = fonts.get(key)
                if requested in ALL_VERIFIED_FONTS and not ConstraintEngine.font_forbidden(requested, brand_rules):
                    if role == 'display': display_font = requested
                    else: body_font = requested
            if ConstraintEngine.font_forbidden(display_font, brand_rules): display_font = rng.choice(safe_sans)
            if ConstraintEngine.font_forbidden(body_font, brand_rules): body_font = rng.choice(safe_sans)
            if ConstraintEngine.font_forbidden(metadata_font, brand_rules): metadata_font = rng.choice(safe_sans)
            if brand_rules['required_font']:
                if ConstraintEngine.font_forbidden(brand_rules['required_font'], brand_rules):
                    raise ValueError('BRAND_FONT_CONFLICT')
                display_font = body_font = metadata_font = brand_rules['required_font']

        font_pairing = {
            "display": display_font,
            "body": body_font,
            "metadata": metadata_font,
            "displayRole": "serif" if "Serif" in display_font or "Cinzel" in display_font or "Prata" in display_font or "Playfair" in display_font else "sans",
            "bodyRole": "neo_grotesque",
            "metadataRole": "mono",
        }

        # 6. Comportamento Cromático Sem Viés Estrito Noir+Ivory
        # Deriva a temperatura cromática com base no segmento e brief
        if "NO_COLORS" in negatives or contract.design.allowed_color_space == "monochrome":
            dominant_tone = "pure_monochrome"
        elif "warm" in raw_prompt or is_luxury:
            dominant_tone = rng.choice(["warm_terracotta_cream", "noir_and_gold", "mineral_sage_linen"])
        elif is_tech:
            dominant_tone = rng.choice(["deep_slate_cyan", "monochrome_steel", "pure_graphite"])
        else:
            dominant_tone = rng.choice(["organic_stone", "editorial_alabaster", "graphite_linen"])

        if 'gold' in brand_rules['forbidden_colors'] and dominant_tone == 'noir_and_gold':
            dominant_tone = 'pure_graphite'
        if brand_context:
            avoid.extend(str(g.get('rule', ''))[:240] for g in brand_context.get('negative_constraints', [])
                         if g.get('status') in {'confirmed', 'user_supplied'})

        palette_behavior = {
            "contrast_strategy": "high_contrast_editorial" if visual_dna.contrast_ratio > 0.6 else "harmonious_soft",
            "accent_usage": "restrained_focal_points",
            "dominant_tone": dominant_tone,
        }

        return CreativeDirection(
            concept_name=concept_name,
            concept_statement=statement,
            visual_narrative=visual_narrative,
            photographic_behavior=photo_beh,
            typographic_behavior=typo_beh,
            composition_behavior="asymmetric_controlled_tension" if "asymmetric" in axis_strat else "modular_discipline",
            graphic_language=graphic_lang,
            axis_strategy=axis_strat,
            grid_strategy=grid_strat,
            scale_strategy="extreme_scale_contrast" if visual_dna.contrast_ratio > 0.6 else "harmonic_progression",
            avoid=avoid,
            font_pairing=font_pairing,
            palette_behavior=palette_behavior,
            brand_voice=brand_context.get('tone', {}) if brand_context else {},
        )
