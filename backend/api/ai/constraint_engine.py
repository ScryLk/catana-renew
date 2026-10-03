"""
Constraint Engine - Motor de Arbitragem e Hierarquia de Prioridades (P0 - P8).
Garante que restrições rígidas (P1) e proibições (P3) nunca sejam sobrescritas
por conhecimento recuperado do RAG (P7) ou padrões do sistema (P8).
"""
import logging
from typing import Dict, Any, List, Optional, Tuple
from .requirement_contract import RequirementContract

logger = logging.getLogger(__name__)


class ConstraintPriority:
    P0_SECURITY = 0             # Limitações técnicas reais e segurança
    P1_HARD_CONSTRAINTS = 1     # Restrições cardinais do usuário (páginas exatas, etc.)
    P2_MANDATORY_CONTENT = 2    # Conteúdo/produtos obrigatórios fornecidos pelo usuário
    P3_NEGATIVE_CONSTRAINTS = 3 # Itens e estilos expressamente proibidos
    P4_FORMAT_MEDIA = 4         # Dimensões e orientação de mídia
    P5_OBJECTIVE = 5            # Objetivo comunicacional
    P6_SOFT_PREFERENCES = 6     # Preferências estéticas explícitas
    P7_RAG_KNOWLEDGE = 7        # Conhecimento e referências recuperadas pelo RAG
    P8_DEFAULTS = 8             # Padrões do sistema


class ConstraintEngine:
    """
    Motor de resolução e validação de restrições por precedência formal.
    """

    # Limite físico aproximado de palavras legíveis por página A4 (corpo 8pt mínimo)
    MAX_WORDS_PER_A4_PAGE = 1200
    # Limite de produtos legíveis por página única (formato tabela/matriz)
    MAX_PRODUCTS_PER_ONE_PAGER = 50

    @classmethod
    def evaluate_feasibility(
        cls,
        contract: RequirementContract,
        product_count: int,
        word_count: int = 0,
    ) -> Tuple[bool, Optional[str]]:
        """
        Verifica a viabilidade física e consistência lógica do briefing.
        Retorna (is_feasible, conflict_reason).
        """
        page_count = contract.output.page_count
        mode = contract.output.page_count_mode

        # 1. Checagem de Impossibilidade Física de Texto
        if mode == "exact" and page_count:
            max_capacity = page_count * cls.MAX_WORDS_PER_A4_PAGE
            if word_count > max_capacity * 2:
                msg = (
                    f"PHYSICAL_IMPOSSIBILITY: Solicitação de {word_count} palavras em "
                    f"{page_count} página(s). Limite físico editorial para legibilidade é de "
                    f"aproximadamente {max_capacity} palavras."
                )
                logger.warning(f"[ConstraintEngine] {msg}")
                return False, msg

        # 2. Checagem de Impossibilidade Física de Produtos em Página Única
        if page_count == 1 and mode == "exact" and product_count > cls.MAX_PRODUCTS_PER_ONE_PAGER:
            msg = (
                f"PHYSICAL_IMPOSSIBILITY: Inclusão de {product_count} produtos em página única "
                f"ultrapassa o limite de renderização legível ({cls.MAX_PRODUCTS_PER_ONE_PAGER} itens)."
            )
            logger.warning(f"[ConstraintEngine] {msg}")
            return False, msg

        return True, None

    @classmethod
    def arbitrate_style_vs_constraints(
        cls,
        contract: RequirementContract,
        product_count: int,
    ) -> RequirementContract:
        """
        Arbitra conflitos entre preferências estéticas (P6) e restrições rígidas (P1/P2/P3).
        Se houver contradição, a restrição superior anula a inferior.
        """
        output = contract.output
        design = contract.design

        # Conflito: Usuário pediu 1 página com muitos produtos (>= 8) E estilo minimalista com muito whitespace
        if output.page_count == 1 and output.page_count_mode == "exact" and product_count >= 8:
            if design.whitespace > 40:
                logger.info(
                    "[ConstraintEngine] Arbitragem P1 x P6: Reduzindo whitespace de "
                    f"{design.whitespace}% para 25% para acomodar {product_count} produtos no One-Pager sem violar P1."
                )
                design.whitespace = 25
                design.density = max(design.density, 75)
                design.layout_behavior.append("dense_spec_matrix")

        # Conflito: Proibição de cards (P3) presente, mas estilo técnico solicitado
        if "NO_CARDS" in contract.constraints.negative:
            if "no_cards" not in design.layout_behavior:
                design.layout_behavior.append("no_cards")
            design.layout_behavior.append("ruled_lines_layout")

        # Conflito: Proibição de gradientes (P3)
        if "NO_GRADIENTS" in contract.constraints.negative:
            design.layout_behavior.append("flat_colors_only")

        # Conflito: Proibição de cores (P3) ou pedido de monocromia
        if "NO_COLORS" in contract.constraints.negative or design.allowed_color_space == "monochrome":
            design.allowed_color_space = "monochrome"
            design.color_preferences = ["#000000", "#FFFFFF", "#1A1A1A", "#F5F5F5"]

        return contract

    @classmethod
    def filter_retrieved_knowledge(
        cls,
        contract: RequirementContract,
        rag_templates: List[Dict[str, Any]],
    ) -> List[Dict[str, Any]]:
        """
        Filtra candidatos de conhecimento do RAG (P7) removendo itens que violem
        restrições negativas (P3) ou hard constraints (P1).
        Regra: P7 NUNCA pode sobrescrever P1-P6.
        """
        filtered = []
        negatives = set(contract.constraints.negative)

        for item in rag_templates:
            blueprint = item.get("blueprint_data", {})
            slug = item.get("slug", "").lower()
            category = item.get("category", "").lower()
            description = item.get("description", "").lower()

            # 1. Se o usuário proibiu cards e o template é puramente baseado em cards
            if "NO_CARDS" in negatives:
                if "card" in slug or "card" in description or blueprint.get("containerStyle") == "card":
                    logger.debug(f"[ConstraintEngine] Descartando template '{slug}' por violar NO_CARDS (P3).")
                    continue

            # 2. Se o usuário proibiu gradientes e o template força gradiente
            if "NO_GRADIENTS" in negatives:
                if "gradient" in slug or "gradient" in description or "gradient" in str(blueprint):
                    logger.debug(f"[ConstraintEngine] Descartando template '{slug}' por violar NO_GRADIENTS (P3).")
                    continue

            # 3. Se o usuário solicitou exatamente 1 página, descarta templates de capa/contracapa ceremoniais isolados
            if contract.output.page_count == 1 and contract.output.page_count_mode == "exact":
                if category in ["backcover", "divider"] and not item.get("is_one_pager_compatible", False):
                    continue

            filtered.append(item)

        return filtered
