"""
Style Interpreter & Anti-Generic Design Engine.
Interpreta termos estéticos em dimensões contínuas (0-100), decompõe combinações dialéticas
(ex: 'brutalista porém delicado') e detecta/substitui clichês visuais de IA.
"""
import re
import logging
from typing import Dict, Any, List, Optional
from .requirement_contract import RequirementContract

logger = logging.getLogger(__name__)


class StyleInterpreter:
    """
    Interpretador de Estilos Editoriais e Motor Anti-Clichê Generativo.
    """

    @classmethod
    def interpret(cls, contract: RequirementContract) -> Dict[str, Any]:
        """
        Decompõe as preferências estéticas em uma estratégia de direção de arte
        com estrutura macro, detalhes micro e parâmetros contínuos.
        """
        keywords = [k.lower() for k in contract.design.style_keywords]
        prompt = contract.raw_prompt.lower()

        macro_structure = "modular_grid"
        micro_details = "refined_editorial"
        typography_archetype = "sans_grotesque"
        palette_archetype = "editorial_neutral"

        # 1. Decomposição de Estilos Dialéticos / Conflitantes
        if "brutalist" in keywords and any(k in prompt for k in ["delicado", "delicate", "leve", "sutil"]):
            # Macro Brutalista (grid rígido, tipografia de grande escala) + Micro Delicado (linhas finas de 0.5pt, serif refinada para corpo, respiro)
            macro_structure = "brutalist_exposed_grid"
            micro_details = "delicate_hairlines_and_subtle_margins"
            typography_archetype = "contrast_bold_headline_delicate_body"
            palette_archetype = "stark_monochrome_with_soft_ivory"

        elif "luxury" in keywords and "brutalist" in keywords:
            macro_structure = "monumental_asymmetry"
            micro_details = "noble_materials_and_sharp_edges"
            typography_archetype = "didone_display_with_heavy_grotesque"
            palette_archetype = "noir_and_gold_raw"

        elif "corporate" in keywords and "dynamic" in keywords:
            macro_structure = "asymmetric_swiss_grid"
            micro_details = "active_white_space_and_directional_lines"
            typography_archetype = "neo_grotesque_with_scale_jumps"
            palette_archetype = "slate_and_high_contrast_accent"

        elif "technical" in keywords and "editorial" in keywords:
            macro_structure = "spec_sheet_with_editorial_hero"
            micro_details = "tabular_numbers_and_clear_rules"
            typography_archetype = "condensed_sans_and_mono_metadata"
            palette_archetype = "industrial_clean"

        elif "minimalist" in keywords and contract.design.density > 65:
            # Minimalismo denso (estilo Suíço / Unimark): muita informação organizada com extrema disciplina e sem ruído visual
            macro_structure = "swiss_information_matrix"
            micro_details = "tight_gutters_clean_typography_zero_decoration"
            typography_archetype = "grotesque_disciplined"
            palette_archetype = "monochrome_pure"

        elif "minimalist" in keywords:
            macro_structure = "white_gallery"
            micro_details = "generous_whitespace_and_whisper_captions"
            typography_archetype = "modern_serif_or_geometric_sans"
            palette_archetype = "ivory_and_graphite"

        elif "dynamic" in keywords:
            macro_structure = "asymmetric_tension_grid"
            micro_details = "dramatic_scale_shifts_and_cutouts"
            typography_archetype = "expressive_display"
            palette_archetype = "vibrant_controlled"

        return {
            "macro_structure": macro_structure,
            "micro_details": micro_details,
            "typography_archetype": typography_archetype,
            "palette_archetype": palette_archetype,
            "visual_dimensions": {
                "visual_energy": contract.design.visual_energy,
                "density": contract.design.density,
                "whitespace": contract.design.whitespace,
                "symmetry": contract.design.symmetry,
                "typographic_contrast": contract.design.typographic_contrast,
                "image_dominance": contract.design.image_dominance,
                "decorative_intensity": contract.design.decorative_intensity,
                "grid_rigidity": contract.design.grid_rigidity,
            },
        }

    @classmethod
    def sanitize_and_de_cliche(
        cls,
        page_dict: Dict[str, Any],
        contract: RequirementContract,
    ) -> Dict[str, Any]:
        """
        Inspeciona a prancheta gerada e remove ativamente clichês generativos de IA:
        - Cards uniformes repetitivos
        - Gradientes roxo/azul padrão
        - Cantos excessivamente arredondados
        - Sombras difusas exageradas
        - Títulos centralizados em todas as páginas
        """
        clean_page = dict(page_dict)
        negatives = set(contract.constraints.negative)

        # 1. Eliminação de Cards Injustificados
        if "NO_CARDS" in negatives or "no_cards" in contract.design.layout_behavior:
            clean_page["containerStyle"] = "none"
            clean_page["useCards"] = False
            clean_page["dividerStyle"] = "hairline_rule"

        # 2. Eliminação de Gradientes
        if "NO_GRADIENTS" in negatives or "flat_colors_only" in contract.design.layout_behavior:
            if "gradient" in str(clean_page.get("backgroundColor", "")).lower():
                clean_page["backgroundColor"] = "#FFFFFF"

        # 3. Eliminação de Cantos Arredondados Exagerados
        if "NO_ROUNDED_CORNERS" in negatives or contract.design.style_keywords in [["brutalist"], ["swiss"], ["technical"]]:
            clean_page["borderRadius"] = 0

        # 4. Eliminação de Sombras Excessivas
        if "NO_SHADOWS" in negatives or "brutalist" in contract.design.style_keywords:
            clean_page["boxShadow"] = "none"

        # 5. Tratamento de Monocromia
        if contract.design.allowed_color_space == "monochrome":
            clean_page["accentColor"] = "#000000" if clean_page.get("backgroundColor") != "#000000" else "#FFFFFF"

        return clean_page
