"""
Page Budget Engine - Alocação Determinística de Pranchetas e Orçamento Espacial.
Cria exatamente N slots antes da geração quando page_count for especificado,
distribuindo o conteúdo e impedindo que o LLM determine livremente o volume de páginas.
"""
import math
import logging
from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional
from .requirement_contract import RequirementContract

logger = logging.getLogger(__name__)


@dataclass
class PageSlot:
    """Representa um slot pré-alocado de prancheta com orçamento e propósito definidos."""
    slot_index: int                       # 0-based
    page_number: int                      # 1-based
    role: str                             # one_pager, cover, manifesto, hero, duo, grid_4, spec_matrix, divider, backcover
    target_capacity: int = 0              # Quantidade pretendida de produtos
    allocated_products: List[Dict[str, Any]] = field(default_factory=list)
    whitespace_target: int = 50           # Porcentagem aproximada de respiro
    density_tier: str = "balanced"        # ultra_low, balanced, high, extreme
    character_budget: int = 600           # Orçamento aproximado de caracteres de texto
    is_cover: bool = False
    is_closing: bool = False


class PageBudgetEngine:
    """
    Motor determinístico de orçamento de páginas.
    Garante: N páginas solicitadas -> criar exatamente N slots -> distribuir conteúdo.
    """

    @classmethod
    def calculate_and_allocate_slots(
        cls,
        contract: RequirementContract,
        products: Optional[List[Dict[str, Any]]] = None,
    ) -> List[PageSlot]:
        """Calcula e instancia os slots de páginas com base no contrato de requisitos."""
        total_prods = len(products) if products else 0
        req_pages = contract.output.page_count
        mode = contract.output.page_count_mode

        # 1. Determina a contagem exata de slots a criar
        target_page_count = cls._resolve_slot_count(req_pages, mode, total_prods)

        logger.info(
            f"[PageBudgetEngine] Planejando {target_page_count} slots de página "
            f"(mode={mode}, requested={req_pages}, produtos={total_prods})"
        )

        # 2. Instancia os slots pré-configurados
        slots = cls._create_empty_slots(target_page_count, contract, total_prods=total_prods)

        # 3. Distribui os produtos entre os slots
        if products:
            cls._distribute_products_to_slots(slots, products)

        return slots

    @classmethod
    def _resolve_slot_count(cls, req_pages: Optional[int], mode: str, total_prods: int) -> int:
        """Resolve a quantidade final de páginas a serem criadas."""
        if mode == "exact" and req_pages is not None:
            return max(1, req_pages)

        if mode == "maximum" and req_pages is not None:
            # Não pode ultrapassar req_pages
            needed = cls._estimate_needed_pages(total_prods)
            return min(req_pages, max(1, needed))

        if mode == "minimum" and req_pages is not None:
            # Não pode ser menor que req_pages
            needed = cls._estimate_needed_pages(total_prods)
            return max(req_pages, needed)

        # Modo auto: calcula baseado no volume de produtos
        return cls._estimate_needed_pages(total_prods)

    @classmethod
    def _estimate_needed_pages(cls, total_prods: int) -> int:
        """Estima a quantidade ideal de páginas para um volume de produtos sem restrição explícita."""
        if total_prods == 0:
            return 6  # Estrutura padrão completa para briefing conceitual
        if total_prods == 1:
            return 3  # Capa, Hero, Contracapa
        if total_prods == 2:
            return 4  # Capa, Manifesto, Duo, Contracapa = 4 páginas
        if total_prods in [3, 4]:
            return 4  # Capa, Manifesto, Duo/Grid, Contracapa
        if total_prods in [5, 6]:
            return 5
        if total_prods in [7, 8]:
            return 5  # Capa, Manifesto, Grid_4, Grid_4, Contracapa = 5 páginas
        # Para volumes maiores: Capa + Manifesto + (N / 4) páginas internas + Contracapa
        internal = math.ceil(total_prods / 4)
        return min(32, 2 + internal + 1)

    @classmethod
    def _create_empty_slots(cls, count: int, contract: RequirementContract, total_prods: int = 0) -> List[PageSlot]:
        """Cria a sequência arquitetural de slots com base no número total de páginas."""
        slots: List[PageSlot] = []

        if count == 6 and total_prods == 0:
            # Estrutura conceitual clássica de 6 páginas
            slots.append(PageSlot(slot_index=0, page_number=1, role="cover", is_cover=True))
            slots.append(PageSlot(slot_index=1, page_number=2, role="manifesto"))
            slots.append(PageSlot(slot_index=2, page_number=3, role="hero", target_capacity=1))
            slots.append(PageSlot(slot_index=3, page_number=4, role="duo", target_capacity=2))
            slots.append(PageSlot(slot_index=4, page_number=5, role="single", target_capacity=1))
            slots.append(PageSlot(slot_index=5, page_number=6, role="backcover", is_closing=True))
            return slots

        if count == 5 and total_prods >= 7:
            # 8 produtos em 5 páginas: Capa, Manifesto, Grid_4, Grid_4, Contracapa
            slots.append(PageSlot(slot_index=0, page_number=1, role="cover", is_cover=True))
            slots.append(PageSlot(slot_index=1, page_number=2, role="manifesto"))
            slots.append(PageSlot(slot_index=2, page_number=3, role="grid_4", target_capacity=4))
            slots.append(PageSlot(slot_index=3, page_number=4, role="grid_4", target_capacity=4))
            slots.append(PageSlot(slot_index=4, page_number=5, role="backcover", is_closing=True))
            return slots

        if count == 1:
            # ONE-PAGER: Todo o conteúdo coexiste em uma única folha.
            # Proibido capa ou contracapa isoladas.
            slots.append(
                PageSlot(
                    slot_index=0,
                    page_number=1,
                    role="one_pager",
                    target_capacity=99,
                    whitespace_target=max(20, contract.design.whitespace),
                    density_tier="high" if contract.design.density > 60 else "balanced",
                    character_budget=1200,
                    is_cover=False,
                    is_closing=False,
                )
            )
            return slots

        if count == 2:
            # Dupla de páginas (Spread simples)
            slots.append(
                PageSlot(
                    slot_index=0,
                    page_number=1,
                    role="cover",
                    target_capacity=0,
                    whitespace_target=60,
                    density_tier="ultra_low",
                    character_budget=300,
                    is_cover=True,
                )
            )
            slots.append(
                PageSlot(
                    slot_index=1,
                    page_number=2,
                    role="spec_matrix" if contract.design.density > 60 else "hero",
                    target_capacity=99,
                    whitespace_target=35,
                    density_tier="balanced",
                    character_budget=800,
                    is_closing=True,
                )
            )
            return slots

        if count == 3:
            # 3 Páginas: Capa -> Conteúdo Principal -> Fechamento Comercial
            slots.append(
                PageSlot(
                    slot_index=0,
                    page_number=1,
                    role="cover",
                    target_capacity=0,
                    whitespace_target=60,
                    density_tier="ultra_low",
                    character_budget=300,
                    is_cover=True,
                )
            )
            slots.append(
                PageSlot(
                    slot_index=1,
                    page_number=2,
                    role="grid_4" if contract.design.density > 60 else "duo",
                    target_capacity=99,
                    whitespace_target=40,
                    density_tier="balanced",
                    character_budget=800,
                )
            )
            slots.append(
                PageSlot(
                    slot_index=2,
                    page_number=3,
                    role="backcover",
                    target_capacity=0,
                    whitespace_target=55,
                    density_tier="low",
                    character_budget=400,
                    is_closing=True,
                )
            )
            return slots

        # count >= 4: Sequência editorial rica
        # Página 1: Capa
        slots.append(
            PageSlot(
                slot_index=0,
                page_number=1,
                role="cover",
                target_capacity=0,
                whitespace_target=65,
                density_tier="ultra_low",
                character_budget=300,
                is_cover=True,
            )
        )

        # Página 2: Manifesto ou Abertura Conceitual
        slots.append(
            PageSlot(
                slot_index=1,
                page_number=2,
                role="manifesto",
                target_capacity=0,
                whitespace_target=50,
                density_tier="low",
                character_budget=600,
            )
        )

        # Páginas Internas: de 2 até count - 2
        internal_count = count - 3
        for i in range(internal_count):
            p_num = i + 3
            # Alterna papéis para criar ritmo
            if i % 3 == 0:
                p_role = "hero"
                cap = 1
                tier = "balanced"
            elif i % 3 == 1:
                p_role = "duo"
                cap = 2
                tier = "balanced"
            else:
                p_role = "grid_4"
                cap = 4
                tier = "high"

            slots.append(
                PageSlot(
                    slot_index=len(slots),
                    page_number=p_num,
                    role=p_role,
                    target_capacity=cap,
                    whitespace_target=35,
                    density_tier=tier,
                    character_budget=700,
                )
            )

        # Última Página: Fechamento / Contracapa
        slots.append(
            PageSlot(
                slot_index=len(slots),
                page_number=count,
                role="backcover",
                target_capacity=0,
                whitespace_target=60,
                density_tier="low",
                character_budget=400,
                is_closing=True,
            )
        )

        return slots

    @classmethod
    def _distribute_products_to_slots(cls, slots: List[PageSlot], products: List[Dict[str, Any]]):
        """Distribui os produtos disponíveis entre os slots alocados de forma uniforme e proporcional."""
        if not products or not slots:
            return

        # Identifica quais slots aceitam produtos
        content_slots = [s for s in slots if s.role not in ["cover", "backcover", "manifesto", "divider"]]

        if not content_slots:
            # Se for 1 página ou só houver capa/contracapa, atribui ao primeiro slot disponível ou único
            content_slots = slots

        # Se houver apenas 1 slot de conteúdo (ex: One-Pager ou 4 páginas com 1 miolo), ele recebe TODOS os produtos
        if len(content_slots) == 1:
            content_slots[0].allocated_products = list(products)
            content_slots[0].target_capacity = len(products)
            if len(products) == 1 and content_slots[0].role not in ["one_pager"]:
                content_slots[0].role = "hero"
            elif len(products) == 2 and content_slots[0].role not in ["one_pager"]:
                content_slots[0].role = "duo"
            elif len(products) >= 3 and content_slots[0].role not in ["one_pager"]:
                content_slots[0].role = "grid_4" if len(products) <= 4 else "spec_matrix"
            return

        # Distribuição balanceada pelos slots de conteúdo
        total_items = len(products)
        num_slots = len(content_slots)
        items_per_slot = math.ceil(total_items / num_slots)

        prod_idx = 0
        for slot in content_slots:
            slot_chunk = products[prod_idx : prod_idx + items_per_slot]
            slot.allocated_products = slot_chunk
            slot.target_capacity = len(slot_chunk)
            prod_idx += len(slot_chunk)

            # Ajusta o papel do slot de acordo com a quantidade real recebida
            if len(slot_chunk) == 1 and slot.role not in ["one_pager", "hero"]:
                slot.role = "hero"
            elif len(slot_chunk) == 2 and slot.role not in ["one_pager"]:
                slot.role = "duo"
            elif len(slot_chunk) >= 3 and slot.role not in ["one_pager"]:
                slot.role = "grid_4" if len(slot_chunk) <= 4 else "spec_matrix"
