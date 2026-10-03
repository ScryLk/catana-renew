"""
Composition Mutator - Motor de Mutação Compositiva e Exploração Espacial.
Aplica variações estruturais controladas a pranchetas para romper repetições,
aumentar assimetria ou responder a comandos do usuário no chat (ex: 'quebre a grade', 'deixe mais assimétrico').
NUNCA altera dados comerciais (SKU, preço, nome, descrição).
"""
import copy
import random
import logging
from typing import Dict, Any, List, Optional, Tuple

logger = logging.getLogger(__name__)


class CompositionMutator:
    """
    Mutador Geométrico de Layouts Editoriais.
    Garante integridade absoluta de dados comerciais do usuário enquanto explora variações espaciais.
    """

    AVAILABLE_MUTATIONS = [
        "increase_asymmetry",
        "break_grid",
        "increase_image_scale",
        "reduce_image_scale",
        "move_focal_point",
        "rotate_visual_axis",
        "increase_typographic_scale",
        "increase_whitespace",
        "switch_alignment",
    ]

    @classmethod
    def mutate(
        cls,
        page_dict: Dict[str, Any],
        mutation_type: Optional[str] = None,
        strength: float = 0.5,
        creative_seed: int = 42,
    ) -> Tuple[Dict[str, Any], str]:
        """
        Aplica mutação geométrica segura aos blocos da prancheta.
        Retorna (mutated_page, mutation_description).
        """
        mutated_page = copy.deepcopy(page_dict)
        blocks = mutated_page.get("blocks", [])

        if not blocks:
            # Não há blocos generativos para mutar
            return mutated_page, "NO_OP: Prancheta sem blocos generativos."

        rng = random.Random(creative_seed)
        chosen_mutation = mutation_type or rng.choice(cls.AVAILABLE_MUTATIONS)

        logger.info(f"[CompositionMutator] Aplicando mutação '{chosen_mutation}' (strength={strength})...")

        if chosen_mutation == "increase_asymmetry":
            desc = cls._mutate_increase_asymmetry(blocks, strength, rng)
        elif chosen_mutation == "move_focal_point":
            desc = cls._mutate_move_focal_point(blocks, rng)
        elif chosen_mutation == "increase_image_scale":
            desc = cls._mutate_image_scale(blocks, scale_factor=1.0 + (strength * 0.35))
        elif chosen_mutation == "reduce_image_scale":
            desc = cls._mutate_image_scale(blocks, scale_factor=1.0 - (strength * 0.30))
        elif chosen_mutation == "increase_typographic_scale":
            desc = cls._mutate_typography_scale(blocks, scale_factor=1.0 + (strength * 0.40))
        elif chosen_mutation == "switch_alignment":
            desc = cls._mutate_switch_alignment(blocks)
        elif chosen_mutation == "break_grid":
            desc = cls._mutate_break_grid(blocks, strength, rng)
        else:
            desc = cls._mutate_rotate_axis(mutated_page, blocks, rng)

        # Atualiza metadata da composição
        comp = mutated_page.get("composition", {})
        comp["balance"] = "asymmetric"
        comp["lastMutation"] = chosen_mutation
        mutated_page["composition"] = comp

        return mutated_page, desc

    @classmethod
    def _mutate_increase_asymmetry(cls, blocks: List[Dict[str, Any]], strength: float, rng: random.Random) -> str:
        """Desloca elementos centrais para o eixo periférico esquerdo com respiro ampliado."""
        count = 0
        for b in blocks:
            if b.get("alignment") == "center":
                b["alignment"] = "left"
                b["x"] = round(max(0.06, min(0.35, float(b.get("x", 0.1)) - 0.15)), 3)
                count += 1
            elif b.get("role") == "headline":
                # Deslocamento sutil no eixo X
                delta = rng.uniform(-0.08, 0.08) * strength
                b["x"] = round(max(0.04, min(0.30, float(b.get("x", 0.06)) + delta)), 3)
                count += 1

        return f"Aumento de assimetria aplicado em {count} blocos (alinhamentos e eixos descentralizados)."

    @classmethod
    def _mutate_move_focal_point(cls, blocks: List[Dict[str, Any]], rng: random.Random) -> str:
        """Inverte o foco espacial (ex: foto da direita vai para a esquerda e texto vai para a direita)."""
        photo_blocks = [b for b in blocks if "image" in b.get("type", "") or b.get("role") in ["hero_image", "primary_photo"]]
        text_blocks = [b for b in blocks if b.get("type") in ["text", "price", "metadata", "quote"] and b.get("role") != "folio"]

        if photo_blocks and text_blocks:
            for pb in photo_blocks:
                curr_x = float(pb.get("x", 0.0))
                # Se estava na direita (>0.4), vai para a esquerda (0.06); se estava na esquerda, vai para 0.44
                new_x = 0.06 if curr_x > 0.35 else 0.44
                pb["x"] = new_x

            for tb in text_blocks:
                curr_tx = float(tb.get("x", 0.0))
                new_tx = 0.52 if curr_tx < 0.40 else 0.06
                tb["x"] = new_tx

            return "Inversão de ponto focal: fotografia e massas de texto alternadas de quadrante."

        return "Variação de ponto focal executada com sucesso."

    @classmethod
    def _mutate_image_scale(cls, blocks: List[Dict[str, Any]], scale_factor: float) -> str:
        """Ajusta proporcionalmente a escala de fotografias sem vazar os limites seguros."""
        count = 0
        for b in blocks:
            if "image" in b.get("type", "") or b.get("role") in ["hero_image", "primary_photo"]:
                w = float(b.get("width", 0.5))
                h = float(b.get("height", 0.5))
                new_w = round(max(0.20, min(0.92, w * scale_factor)), 3)
                new_h = round(max(0.15, min(0.85, h * scale_factor)), 3)
                b["width"] = new_w
                b["height"] = new_h
                count += 1

        return f"Escala fotográfica ajustada por fator {scale_factor:.2f} em {count} bloco(s)."

    @classmethod
    def _mutate_typography_scale(cls, blocks: List[Dict[str, Any]], scale_factor: float) -> str:
        """Aumenta a escala do título e o contraste tipográfico."""
        count = 0
        for b in blocks:
            if b.get("role") == "headline":
                curr_size = float(b.get("fontSize", 24))
                b["fontSize"] = round(min(72.0, curr_size * scale_factor), 1)
                b["height"] = round(min(0.35, float(b.get("height", 0.2)) * 1.2), 3)
                count += 1

        return f"Contraste tipográfico ampliado em {count} headline(s)."

    @classmethod
    def _mutate_switch_alignment(cls, blocks: List[Dict[str, Any]]) -> str:
        """Alterna a orientação de alinhamento entre esquerda e direita."""
        for b in blocks:
            if b.get("role") in ["headline", "body", "quote"]:
                curr = b.get("alignment", "left")
                b["alignment"] = "right" if curr == "left" else "left"

        return "Alinhamento textual alternado para criar nova cadência."

    @classmethod
    def _mutate_break_grid(cls, blocks: List[Dict[str, Any]], strength: float, rng: random.Random) -> str:
        """Quebra a rigidez da malha introduzindo micro-deslocamentos e pequenas rotações controladas."""
        for b in blocks:
            if b.get("role") != "folio":
                # Pequena rotação angular de tensão (-2 a +2 graus)
                b["rotation"] = round(rng.uniform(-2.5, 2.5) * strength, 1)
                delta_y = rng.uniform(-0.03, 0.03) * strength
                b["y"] = round(max(0.04, min(0.88, float(b.get("y", 0.1)) + delta_y)), 3)

        return "Quebra de malha paramétrica aplicada com micro-rotação e tensão diagonal."

    @classmethod
    def _mutate_rotate_axis(cls, page_dict: Dict[str, Any], blocks: List[Dict[str, Any]], rng: random.Random) -> str:
        """Alterna o eixo visual da prancheta."""
        comp = page_dict.get("composition", {})
        curr_axis = comp.get("axis", "diagonal")
        new_axis = "asymmetric_right" if curr_axis == "asymmetric_left" else "asymmetric_left"
        comp["axis"] = new_axis

        return f"Eixo visual rotacionado de '{curr_axis}' para '{new_axis}'."
