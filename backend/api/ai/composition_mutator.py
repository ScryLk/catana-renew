"""
Composition Mutator - Motor de Mutação Compositiva e Exploração Espacial.
Aplica variações estruturais controladas a pranchetas para romper repetições e responder a alertas do crítico.
Garante inviolabilidade absoluta dos dados comerciais e conformidade imediata com a Safe Area via fit_block_to_safe_area.
Utiliza sementes de mutação determinísticas derivadas do creative_seed do catálogo.
"""
import copy
import random
import logging
from typing import Dict, Any, List, Optional, Tuple
from .seed_utils import derive_mutation_seed
from .design_grammar import validate_runtime_block
from .generation_validator import SAFE_AREA_EXEMPT_ROLES

logger = logging.getLogger(__name__)

DEFAULT_SAFE_AREA = {"top": 0.04, "right": 0.04, "bottom": 0.04, "left": 0.04}


def fit_block_to_safe_area(
    block: Dict[str, Any],
    safe_area: Optional[Dict[str, float]] = None,
) -> Dict[str, Any]:
    """
    Ajusta imediatamente a geometria de um bloco para respeitar as margens de corte (Safe Area).
    Elementos isentos (como folios nas margens ou imagens em sangria) são mantidos dentro da prancheta física.
    """
    safe = safe_area or DEFAULT_SAFE_AREA
    s_top = float(safe.get("top", 0.04))
    s_right = float(safe.get("right", 0.04))
    s_bottom = float(safe.get("bottom", 0.04))
    s_left = float(safe.get("left", 0.04))

    is_bleed = block.get("bleed", False)
    role = block.get("role", "element")
    is_exempt = role in SAFE_AREA_EXEMPT_ROLES or block.get("marginExempt", False)

    min_w = 0.04
    min_h = 0.02

    if is_bleed:
        # Sangria intencional: permite estender até 0 ou 1
        block["x"] = round(max(-0.02, min(0.95, float(block.get("x", 0.0)))), 3)
        block["y"] = round(max(-0.02, min(0.95, float(block.get("y", 0.0)))), 3)
        block["width"] = round(max(min_w, min(1.05 - block["x"], float(block.get("width", 0.5)))), 3)
        block["height"] = round(max(min_h, min(1.05 - block["y"], float(block.get("height", 0.2)))), 3)
        return block

    if is_exempt:
        # Folios e marcas marginais: mantidos rigorosamente dentro dos limites físicos da prancheta [0, 1]
        x = round(max(0.01, min(0.95, float(block.get("x", 0.0)))), 3)
        y = round(max(0.01, min(0.98, float(block.get("y", 0.0)))), 3)
        w = round(max(min_w, min(1.0 - x, float(block.get("width", 0.1)))), 3)
        h = round(max(min_h, min(1.0 - y, float(block.get("height", 0.03)))), 3)
        block["x"], block["y"], block["width"], block["height"] = x, y, w, h
        return block

    # Blocos de conteúdo padrão: NUNCA invadem a safe area
    x = float(block.get("x", s_left))
    y = float(block.get("y", s_top))
    w = float(block.get("width", 0.5))
    h = float(block.get("height", 0.2))

    max_right = 1.0 - s_right
    max_bottom = 1.0 - s_bottom

    # Clampa largura e altura razoáveis
    w = max(min_w, min(max_right - s_left, w))
    h = max(min_h, min(max_bottom - s_top, h))

    # Clampa coordenadas X e Y
    x = max(s_left, min(max_right - w, x))
    y = max(s_top, min(max_bottom - h, y))

    block["x"] = round(x, 3)
    block["y"] = round(y, 3)
    block["width"] = round(w, 3)
    block["height"] = round(h, 3)

    return block


class CompositionMutator:
    """
    Mutador Geométrico de Layouts Editoriais.
    Garante integridade absoluta de dados comerciais do usuário enquanto explora variações espaciais.
    """

    VISUAL_MUTABLE_FIELDS = frozenset({
        'x', 'y', 'width', 'height', 'rotation', 'alignment', 'fontSize', 'fontWeight',
        'letterSpacing', 'lineHeight', 'cropMode', 'zIndex', 'opacity',
    })

    AVAILABLE_MUTATIONS = [
        "increase_asymmetry",
        "break_grid",
        "increase_image_scale",
        "reduce_image_scale",
        "move_focal_point",
        "rotate_visual_axis",
        "increase_typographic_scale",
        "switch_alignment",
    ]

    @classmethod
    def mutate(
        cls,
        page_dict: Dict[str, Any],
        mutation_type: Optional[str] = None,
        strength: float = 0.5,
        creative_seed: int = 42,
        attempt: int = 1,
    ) -> Tuple[Dict[str, Any], str]:
        """
        Aplica mutação geométrica segura aos blocos da prancheta.
        Garante determinismo via creative_seed do documento e conformidade imediata com Safe Area.
        """
        mutated_page = copy.deepcopy(page_dict)
        blocks = mutated_page.get("blocks", [])
        page_num = mutated_page.get("pageNumber", 1)
        safe_area = mutated_page.get("safeArea") or DEFAULT_SAFE_AREA

        if not blocks:
            return mutated_page, "NO_OP: Prancheta sem blocos generativos."

        # Deriva semente estável a partir do seed criativo do catálogo
        mut_seed = derive_mutation_seed(creative_seed, page_num, attempt, mutation_type or "auto")
        rng = random.Random(mut_seed)

        no_diagonals = 'NO_DIAGONALS' in mutated_page.get('negativeConstraints', [])
        allowed = [m for m in cls.AVAILABLE_MUTATIONS if not (no_diagonals and m == 'rotate_visual_axis')]
        chosen_mutation = mutation_type or rng.choice(allowed)
        if no_diagonals and chosen_mutation == 'rotate_visual_axis':
            chosen_mutation = 'switch_alignment'
        if chosen_mutation not in cls.AVAILABLE_MUTATIONS:
            raise ValueError('UNKNOWN_MUTATION')

        logger.info(f"[CompositionMutator] Pág {page_num}: Aplicando mutação '{chosen_mutation}' (seed={mut_seed}, strength={strength})...")

        if chosen_mutation == "increase_asymmetry":
            desc = cls._mutate_increase_asymmetry(blocks, strength, rng)
        elif chosen_mutation == "move_focal_point":
            desc = cls._mutate_move_focal_point(blocks, rng)
        elif chosen_mutation == "increase_image_scale":
            desc = cls._mutate_image_scale(blocks, scale_factor=1.0 + (strength * 0.25))
        elif chosen_mutation == "reduce_image_scale":
            desc = cls._mutate_image_scale(blocks, scale_factor=1.0 - (strength * 0.20))
        elif chosen_mutation == "increase_typographic_scale":
            desc = cls._mutate_typography_scale(blocks, scale_factor=1.0 + (strength * 0.30))
        elif chosen_mutation == "switch_alignment":
            desc = cls._mutate_switch_alignment(blocks)
        elif chosen_mutation == "break_grid":
            desc = cls._mutate_break_grid(blocks, strength, rng)
        else:
            desc = cls._mutate_rotate_axis(mutated_page, blocks, rng)

        # Regra de Ouro (Item 38): Todo bloco mutado passa imediatamente pelo ajuste de Safe Area
        for b in blocks:
            fit_block_to_safe_area(b, safe_area)

        if no_diagonals:
            for block in blocks:
                block['rotation'] = 0
        for before, after in zip(page_dict.get('blocks', []), blocks):
            for key in set(before) | set(after):
                if key not in cls.VISUAL_MUTABLE_FIELDS and before.get(key) != after.get(key):
                    raise ValueError('MUTATION_COMMERCIAL_FIELD_VIOLATION: ' + key)
        if len(blocks) != len(page_dict.get('blocks', [])) or mutated_page.get('products') != page_dict.get('products'):
            raise ValueError('MUTATION_COMMERCIAL_FIELD_VIOLATION')

        # Atualiza metadata da composição
        comp = mutated_page.get("composition", {})
        if no_diagonals and 'diagonal' in str(comp.get('axis','')).lower():
            comp['axis'] = 'asymmetric_left'
        for block in blocks:
            valid, errors = validate_runtime_block(block)
            if not valid:
                raise ValueError('INVALID_RUNTIME_BLOCK: ' + ';'.join(errors))
        comp["balance"] = "asymmetric"
        comp["lastMutation"] = chosen_mutation
        comp["mutationSeed"] = mut_seed
        mutated_page["composition"] = comp

        return mutated_page, desc

    @classmethod
    def _mutate_increase_asymmetry(cls, blocks: List[Dict[str, Any]], strength: float, rng: random.Random) -> str:
        """Desloca elementos centrais para o eixo periférico esquerdo."""
        count = 0
        for b in blocks:
            if b.get("alignment") == "center" and b.get("role") != "folio":
                b["alignment"] = "left"
                b["x"] = round(max(0.06, min(0.35, float(b.get("x", 0.1)) - 0.15)), 3)
                count += 1
            elif b.get("role") == "headline":
                delta = rng.uniform(-0.06, 0.06) * strength
                b["x"] = round(max(0.04, min(0.30, float(b.get("x", 0.06)) + delta)), 3)
                count += 1

        return f"Aumento de assimetria aplicado em {count} blocos."

    @classmethod
    def _mutate_move_focal_point(cls, blocks: List[Dict[str, Any]], rng: random.Random) -> str:
        """Alterna o quadrante da foto e dos blocos textuais."""
        photo_blocks = [b for b in blocks if "image" in b.get("type", "") or b.get("role") in ["hero_image", "primary_photo"]]
        text_blocks = [b for b in blocks if b.get("type") in ["text", "price", "metadata", "quote"] and b.get("role") != "folio"]

        if photo_blocks and text_blocks:
            for pb in photo_blocks:
                curr_x = float(pb.get("x", 0.0))
                new_x = 0.06 if curr_x > 0.35 else 0.46
                pb["x"] = new_x

            for tb in text_blocks:
                curr_tx = float(tb.get("x", 0.0))
                new_tx = 0.52 if curr_tx < 0.40 else 0.06
                tb["x"] = new_tx

            return "Inversão de ponto focal: fotografia e massas de texto alternadas de quadrante."

        return "Variação de ponto focal executada."

    @classmethod
    def _mutate_image_scale(cls, blocks: List[Dict[str, Any]], scale_factor: float) -> str:
        """Ajusta proporcionalmente a escala de fotografias."""
        count = 0
        for b in blocks:
            if "image" in b.get("type", "") or b.get("role") in ["hero_image", "primary_photo"]:
                w = float(b.get("width", 0.5))
                h = float(b.get("height", 0.5))
                b["width"] = round(w * scale_factor, 3)
                b["height"] = round(h * scale_factor, 3)
                count += 1

        return f"Escala fotográfica ajustada por fator {scale_factor:.2f} em {count} bloco(s)."

    @classmethod
    def _mutate_typography_scale(cls, blocks: List[Dict[str, Any]], scale_factor: float) -> str:
        """Aumenta o contraste tipográfico do headline."""
        count = 0
        for b in blocks:
            if b.get("role") == "headline":
                curr_size = float(b.get("fontSize", 24))
                b["fontSize"] = round(min(64.0, curr_size * scale_factor), 1)
                b["height"] = round(min(0.30, float(b.get("height", 0.15)) * 1.15), 3)
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
        """Quebra a rigidez da malha introduzindo micro-deslocamentos controlados."""
        for b in blocks:
            if b.get("role") not in ["folio", "price_tag", "sku_tag"]:
                b["rotation"] = round(rng.uniform(-2.0, 2.0) * strength, 1)
                delta_y = rng.uniform(-0.02, 0.02) * strength
                b["y"] = round(float(b.get("y", 0.1)) + delta_y, 3)

        return "Quebra de malha paramétrica aplicada com micro-rotação e tensão controlada."

    @classmethod
    def _mutate_rotate_axis(cls, page_dict: Dict[str, Any], blocks: List[Dict[str, Any]], rng: random.Random) -> str:
        """Alterna o eixo visual da prancheta."""
        comp = page_dict.get("composition", {})
        curr_axis = comp.get("axis", "diagonal")
        new_axis = "asymmetric_right" if curr_axis == "asymmetric_left" else "asymmetric_left"
        comp["axis"] = new_axis

        return f"Eixo visual rotacionado de '{curr_axis}' para '{new_axis}'."
