"""
Design Planner - Planejador de Direção de Arte e Ritmo Visual por Prancheta.
Responsável exclusivamente pelo 'HOW TO SHOW IT' (como mostrar), recebendo o Content Plan
e gerando um Design Plan detalhado para cada prancheta com cálculo de similaridade e ritmo.
"""
from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional
import logging
from .requirement_contract import RequirementContract
from .content_planner import DocumentContentPlan, PageContentPlan
from .style_interpreter import StyleInterpreter
from .constraint_engine import ConstraintEngine

logger = logging.getLogger(__name__)


@dataclass
class PageDesignPlan:
    """Plano de direção de arte para uma prancheta específica."""
    page_number: int
    purpose: str
    visual_hierarchy: str                 # ex: "Dominant Title > Single Hero Product > Spec Table"
    dominant_element: str                 # "headline", "hero_image", "data_table", "product_grid", "monogram"
    layout_strategy: str                  # "monumental_split", "swiss_columns", "spec_matrix", "white_gallery"
    density: int                          # 0-100
    typography_behavior: str              # "serif_high_contrast", "grotesque_tight", "mono_tabular"
    image_strategy: str                   # "photo_led", "typography_led", "data_led", "diagram_led"
    color_role: str                       # "primary_dark", "surface_light", "accent_callout"
    relationship_with_previous: str       # "contrast", "continuation", "rhythm_relief"


@dataclass
class DocumentDesignPlan:
    """Plano Global de Design para o Documento."""
    layout_archetype: str
    aspect_ratio: str
    grid_columns: int
    palette_spec: Dict[str, str]
    page_designs: List[PageDesignPlan]
    overall_rhythm: str


class DesignPlanner:
    """
    Planejador de Design e Direção de Arte Editorial.
    """

    @classmethod
    def plan(
        cls,
        contract: RequirementContract,
        content_plan: DocumentContentPlan,
        rag_context: Optional[Dict[str, Any]] = None,
    ) -> DocumentDesignPlan:
        """Elabora o plano de design página a página com controle de ritmo e similaridade."""
        style_info = StyleInterpreter.interpret(contract)
        orientation = contract.output.orientation
        aspect_ratio = "16:9" if orientation == "landscape" else "1:1" if orientation == "square" else "A4_portrait"

        # Define grid base por aspect ratio
        grid_columns = 12 if orientation == "landscape" else 4 if orientation == "square" else 6

        # Determina a estratégia de imagens
        has_images = contract.assets.has_product_images and "NO_IMAGES" not in contract.constraints.negative
        global_image_strategy = "photo_led" if has_images else "typography_led"

        page_designs: List[PageDesignPlan] = []
        total_pages = len(content_plan.page_maps)

        for idx, p_map in enumerate(content_plan.page_maps):
            p_num = p_map.page_number
            prods = p_map.product_items
            is_one_pager = total_pages == 1

            # 1. Determina elemento dominante e estratégia de layout
            if is_one_pager:
                dominant = "product_grid" if prods else "headline"
                strategy = "executive_one_pager" if not prods else "spec_matrix_condensed"
                hierarchy = "Header/Tese > Matriz de Conteúdo > Linha de Conversão"
                color_role = "surface_light" if "NO_DARK_BACKGROUND" in contract.constraints.negative else "primary_dark"
                rel = "standalone"

            elif p_num == 1:
                dominant = "headline" if not has_images else "hero_image"
                strategy = "monumental_headline"
                hierarchy = "Título Nobre > Selo de Capa > Resumo de Posicionamento"
                color_role = "primary_dark"
                rel = "opener"

            elif p_num == total_pages:
                dominant = "data_table"
                strategy = "closing_spec_folio"
                hierarchy = "Título de Encerramento > Contato & Atendimento > Folio"
                color_role = "primary_dark" if p_num % 2 == 1 else "surface_light"
                rel = "closing"

            elif len(prods) == 1:
                dominant = "hero_image" if has_images else "headline"
                strategy = "swiss_split_asymmetry"
                hierarchy = "Hero Product > Nome e Preço > Descrição Sensorial"
                color_role = "surface_light"
                rel = "detail"

            elif len(prods) == 2:
                dominant = "product_grid"
                strategy = "duo_balanced_spread"
                hierarchy = "Duo de Destaque > Preços Comparados > Especificações"
                color_role = "surface_light"
                rel = "comparison"

            elif len(prods) >= 3:
                dominant = "data_table" if not has_images else "product_grid"
                strategy = "modular_spec_grid"
                hierarchy = "Matriz de Produtos > Códigos SKU e Preços > Tags"
                color_role = "surface_light"
                rel = "dense_information"

            else:
                # Páginas conceituais / manifesto
                dominant = "headline"
                strategy = "editorial_manifesto"
                hierarchy = "Citação Filosofal > Prosa de Marca > Folio"
                color_role = "surface_light"
                rel = "visual_relief"

            # 2. Avalia similaridade com a página anterior e ajusta se necessário
            if page_designs:
                prev = page_designs[-1]
                similarity = cls.calculate_layout_similarity(prev.layout_strategy, strategy)
                if similarity > 0.85 and total_pages > 2 and p_num < total_pages:
                    # Se duas páginas internas seguidas são idênticas sem justificativa, introduz variação de ritmo
                    if strategy == "modular_spec_grid":
                        strategy = "asymmetric_spec_flow"
                        rel = "rhythm_variant"

            page_designs.append(
                PageDesignPlan(
                    page_number=p_num,
                    purpose=p_map.purpose,
                    visual_hierarchy=hierarchy,
                    dominant_element=dominant,
                    layout_strategy=strategy,
                    density=contract.design.density,
                    typography_behavior=style_info["typography_archetype"],
                    image_strategy=global_image_strategy,
                    color_role=color_role,
                    relationship_with_previous=rel,
                )
            )

        logger.info(f"[DesignPlanner] Plano de design gerado para {len(page_designs)} páginas.")

        # Paleta padrão de 5 tokens
        palette_spec = {
            "primary": "#141416",
            "background": "#F6F5F2",
            "surface": "#FFFFFF",
            "accent": "#C5A059" if contract.design.allowed_color_space != "monochrome" else "#141416",
            "muted": "#71717A",
        }

        palette_spec = ConstraintEngine.brand_palette(palette_spec, contract.brand_context)

        return DocumentDesignPlan(
            layout_archetype=style_info["macro_structure"],
            aspect_ratio=aspect_ratio,
            grid_columns=grid_columns,
            palette_spec=palette_spec,
            page_designs=page_designs,
            overall_rhythm="Dynamic Editorial Progression",
        )

    @classmethod
    def calculate_layout_similarity(cls, strat_a: str, strat_b: str) -> float:
        """Calcula o índice de similaridade entre duas estratégias de layout (0.0 a 1.0)."""
        if strat_a == strat_b:
            return 1.0
        # Famílias correlatas
        similar_pairs = [
            ("modular_spec_grid", "asymmetric_spec_flow"),
            ("swiss_split_asymmetry", "duo_balanced_spread"),
        ]
        for pair in similar_pairs:
            if (strat_a in pair) and (strat_b in pair):
                return 0.7
        return 0.2
