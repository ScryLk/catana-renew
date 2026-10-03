"""
Narrative Planner - Planejamento Sequencial e Ritmo Editorial do Catálogo.
Trata o catálogo como uma partitura contínua de páginas (espalhadas e individuais),
alternando impacto, desaceleração, densidade e eixos visuais.
"""
from dataclasses import dataclass, asdict
from typing import List, Dict, Any, Optional
import random
import logging
from .requirement_contract import RequirementContract
from .content_planner import DocumentContentPlan
from .visual_dna import VisualDNA
from .creative_director import CreativeDirection

logger = logging.getLogger(__name__)


@dataclass
class PageNarrativePlan:
    """Planejamento narrativo de uma prancheta individual no fluxo sequencial."""
    page_number: int
    content_role: str                     # "opening", "manifesto", "product_reveal", "product_system", "spec_matrix", "closing"
    narrative_impact: float               # 0.0 a 1.0
    density_target: float                 # 0.0 a 1.0
    whitespace_target: float              # 0.0 a 1.0
    rhythm: str                           # "statement", "slow", "impact", "dense_information", "pause", "conclusion"
    dominant_primitive: str               # "headline", "image", "product_grid", "data_table", "quote"
    layout_axis: str                      # "asymmetric_left", "asymmetric_right", "diagonal", "stark_horizontal", "off_axis"
    scale_contrast: float                 # 0.0 a 1.0

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


class NarrativePlanner:
    """
    Planejador de Ritmo e Cadência Editorial.
    Garante que páginas adjacentes não repitam o mesmo ritmo ou o mesmo eixo compositivo.
    """

    @classmethod
    def plan_sequence(
        cls,
        contract: RequirementContract,
        content_plan: DocumentContentPlan,
        visual_dna: VisualDNA,
        direction: CreativeDirection,
        creative_seed: int = 42,
    ) -> List[PageNarrativePlan]:
        """Gera o plano narrativo e rítmico para todas as páginas do documento."""
        rng = random.Random(creative_seed)
        total_pages = len(content_plan.page_maps)
        has_images = contract.assets.has_product_images and "NO_IMAGES" not in contract.constraints.negative
        negatives = set(contract.constraints.negative)

        narrative_pages: List[PageNarrativePlan] = []

        # Possíveis eixos compositivos alternados
        AXIS_OPTIONS = ["asymmetric_left", "asymmetric_right", "diagonal", "stark_horizontal", "off_axis"]
        if "NO_DIAGONALS" in negatives:
            AXIS_OPTIONS = ["asymmetric_left", "asymmetric_right", "stark_horizontal"]

        for idx, p_map in enumerate(content_plan.page_maps):
            p_num = p_map.page_number
            prods = p_map.product_items
            num_prods = len(prods)
            is_first = p_num == 1
            is_last = p_num == total_pages
            is_single_page = total_pages == 1

            # 1. Determina content_role semântico
            if is_single_page:
                role = "one_pager"
                impact = 1.0
                density = visual_dna.density * 1.2
                whitespace = visual_dna.whitespace * 0.8
                rhythm = "statement"
                dom_primitive = "product_grid" if num_prods > 0 else "headline"

            elif is_first:
                role = "opening"
                impact = 1.0
                density = min(0.35, visual_dna.density * 0.7)
                whitespace = max(0.65, visual_dna.whitespace * 1.3)
                rhythm = "statement"
                dom_primitive = "headline" if (not has_images or visual_dna.typographic_drama > 0.75) else "image"

            elif is_last:
                role = "closing"
                impact = 0.65
                density = visual_dna.density * 0.9
                whitespace = visual_dna.whitespace * 1.1
                rhythm = "conclusion"
                dom_primitive = "data_table" if num_prods > 0 else "headline"

            elif num_prods == 0:
                # Páginas conceituais sem produtos carregados: alternância rítmica deliberada
                conceptual_roles = ["manifesto", "product_reveal", "product_dialogue", "manifesto"]
                role = conceptual_roles[(idx - 1) % len(conceptual_roles)]

                if role == "manifesto":
                    impact = 0.55
                    density = max(0.20, visual_dna.density * 0.6)
                    whitespace = max(0.60, visual_dna.whitespace * 1.2)
                    rhythm = "slow"
                    dom_primitive = "quote" if (idx % 2 == 1) else "headline"
                elif role == "product_reveal":
                    impact = 0.85
                    density = visual_dna.density * 0.75
                    whitespace = visual_dna.whitespace * 1.15
                    rhythm = "impact"
                    dom_primitive = "image" if has_images else "headline"
                else: # product_dialogue
                    impact = 0.70
                    density = visual_dna.density
                    whitespace = visual_dna.whitespace
                    rhythm = "balanced_comparison"
                    dom_primitive = "product_grid" if has_images else "quote"

            elif num_prods == 1:
                # Foco singular heroico
                role = "product_reveal"
                impact = 0.90
                density = visual_dna.density * 0.75
                whitespace = visual_dna.whitespace * 1.15
                rhythm = "impact"
                dom_primitive = "image" if has_images else "headline"

            elif num_prods == 2:
                # Dupla comparativa / diálogo
                role = "product_dialogue"
                impact = 0.75
                density = visual_dna.density
                whitespace = visual_dna.whitespace
                rhythm = "balanced_comparison"
                dom_primitive = "product_grid"

            else:
                # Grade / sistema técnico
                role = "product_system"
                impact = 0.60
                density = min(0.95, visual_dna.density * 1.3)
                whitespace = max(0.20, visual_dna.whitespace * 0.7)
                rhythm = "dense_information"
                dom_primitive = "product_grid" if has_images else "data_table"

            # 2. Alternância de eixo visual em relação à página anterior (Ritmo editorial)
            if narrative_pages:
                prev_axis = narrative_pages[-1].layout_axis
                candidate_axes = [ax for ax in AXIS_OPTIONS if ax != prev_axis]
                chosen_axis = rng.choice(candidate_axes) if candidate_axes else AXIS_OPTIONS[0]
            else:
                # Primeira página: eixo influenciado por symmetry
                chosen_axis = "stark_horizontal" if visual_dna.symmetry > 0.6 else rng.choice(["asymmetric_left", "asymmetric_right", "off_axis"])

            # 3. Escala tipográfica calculada
            scale_contrast = round(visual_dna.scale_contrast * (1.2 if is_first else 0.9), 3)

            narrative_pages.append(
                PageNarrativePlan(
                    page_number=p_num,
                    content_role=role,
                    narrative_impact=round(impact, 3),
                    density_target=round(min(1.0, max(0.05, density)), 3),
                    whitespace_target=round(min(1.0, max(0.05, whitespace)), 3),
                    rhythm=rhythm,
                    dominant_primitive=dom_primitive,
                    layout_axis=chosen_axis,
                    scale_contrast=scale_contrast,
                )
            )

        logger.info(f"[NarrativePlanner] Sequência de {len(narrative_pages)} páginas planejada com sucesso.")
        return narrative_pages
