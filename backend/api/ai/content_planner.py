"""
Content Planner - Planejador Semântico de Conteúdo Editorial.
Responsável exclusivamente pelo 'WHAT TO SAY' (o que comunicar), totalmente desacoplado do design visual.
Gera o Page Content Map garantindo que dados mandatórios (SKUs, preços, nomes) e textos verbatim
permaneçam intactos e distribuídos com hierarquia.
"""
from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional
import logging
from .requirement_contract import RequirementContract
from .page_budget import PageSlot

logger = logging.getLogger(__name__)


@dataclass
class ContentItem:
    """Representa uma unidade atômica de conteúdo a ser alocada."""
    id: str
    content_type: str  # "USER_VERBATIM", "USER_DATA", "GENERATED_COPY", "SUMMARIZABLE_CONTENT"
    title: str
    body: str
    metadata: Dict[str, Any] = field(default_factory=dict)
    is_verbatim: bool = False
    priority: int = 1  # 1 (máxima), 2 (média), 3 (secundária)


@dataclass
class PageContentPlan:
    """Mapa de conteúdo planejado para uma prancheta específica."""
    page_number: int
    slot_index: int
    purpose: str                          # Tese/objetivo da página
    required_content: List[str]           # Nomes ou itens obrigatórios
    supporting_content: List[str]         # Conteúdo secundário de apoio
    verbatim_blocks: List[str]            # Textos intocáveis do usuário
    product_items: List[Dict[str, Any]]   # Produtos estruturados
    character_budget: int = 800           # Teto de caracteres recomendado


@dataclass
class DocumentContentPlan:
    """Plano de Conteúdo Global do Documento."""
    title: str
    category: str
    summary: str
    page_maps: List[PageContentPlan]
    verbatim_rules: List[str]
    total_products_allocated: int


class ContentPlanner:
    """
    Planejador de Conteúdo Editorial.
    Determina o que deve ser dito, o que é prioritário e como o conteúdo
    é mapeado nas páginas antes do início da direção de arte.
    """

    @classmethod
    def plan(
        cls,
        contract: RequirementContract,
        slots: List[PageSlot],
        products: Optional[List[Dict[str, Any]]] = None,
        synthesis_data: Optional[Dict[str, Any]] = None,
    ) -> DocumentContentPlan:
        """Elabora o plano global de conteúdo e o mapa por prancheta."""
        synthesis = synthesis_data or {}
        doc_title = synthesis.get("title") or (products[0].get("category") if products else "Coleção Editorial")
        doc_category = synthesis.get("category") or contract.detected_industry.replace("_", " ").title()
        doc_summary = synthesis.get("summary") or "Apresentação comercial diagramada com clareza e hierarquia de valor."

        page_maps: List[PageContentPlan] = []
        total_prods_allocated = 0

        for slot in slots:
            p_num = slot.page_number
            p_role = slot.role
            prods = slot.allocated_products
            total_prods_allocated += len(prods)

            # Define o propósito comunicacional do slot
            purpose, req_items, supp_items = cls._define_page_purpose(
                role=p_role,
                page_number=p_num,
                total_pages=len(slots),
                prods=prods,
                contract=contract,
                synthesis=synthesis,
            )

            # Identifica se há texto verbatim alocado para esta prancheta
            verbatim_for_page: List[str] = []
            if contract.content.preserve_verbatim:
                if p_num == 1 or len(slots) == 1 or p_role in ["manifesto", "one_pager"]:
                    verbatim_for_page = contract.content.preserve_verbatim.copy()

            page_maps.append(
                PageContentPlan(
                    page_number=p_num,
                    slot_index=slot.slot_index,
                    purpose=purpose,
                    required_content=req_items,
                    supporting_content=supp_items,
                    verbatim_blocks=verbatim_for_page,
                    product_items=prods,
                    character_budget=slot.character_budget,
                )
            )

        logger.info(
            f"[ContentPlanner] Plano de conteúdo elaborado com sucesso para {len(page_maps)} páginas "
            f"({total_prods_allocated} produtos alocados)."
        )

        return DocumentContentPlan(
            title=doc_title,
            category=doc_category,
            summary=doc_summary,
            page_maps=page_maps,
            verbatim_rules=contract.content.preserve_verbatim,
            total_products_allocated=total_prods_allocated,
        )

    @classmethod
    def _define_page_purpose(
        cls,
        role: str,
        page_number: int,
        total_pages: int,
        prods: List[Dict[str, Any]],
        contract: RequirementContract,
        synthesis: Dict[str, Any],
    ) -> tuple[str, List[str], List[str]]:
        """Define o objetivo comunicacional e divide entre prioritário e secundário."""
        req: List[str] = []
        supp: List[str] = []

        if role == "one_pager":
            purpose = "Síntese holística completa: posicionamento, dados mandatórios e conversão em superfície única."
            for p in prods:
                req.append(f"{p.get('name')} ({p.get('price', '')})")
            supp.append("Chamada de encerramento e dados de contato.")
            return purpose, req, supp

        if role == "cover":
            purpose = "Abertura monumental e impacto de marca: título da coleção e selo editorial."
            req.append("Título da Coleção")
            req.append("Selo Editorial")
            supp.append("Subtítulo de Posicionamento")
            return purpose, req, supp

        if role == "manifesto":
            purpose = "Narrativa de marca e declaração de princípios (filosofia e autoridade)."
            req.append("Título do Manifesto")
            req.append("Citação de Impacto")
            supp.append("Prosa editorial de apoio")
            return purpose, req, supp

        if role in ["hero", "duo", "grid_4", "spec_matrix"]:
            purpose = f"Apresentação comercial e técnica de {len(prods)} produto(s) com precificação e SKUs."
            for p in prods:
                req.append(f"{p.get('name')} | Preço: {p.get('price')} | SKU: {p.get('sku')}")
                if p.get("description"):
                    supp.append(f"Descrição: {p.get('description')[:60]}")
            return purpose, req, supp

        if role == "backcover":
            purpose = "Fechamento institucional, canais de atendimento, dados fiscais e conversão."
            req.append("Canais Oficiais de Contato")
            supp.append("Termos de Garantia / Folio de Encerramento")
            return purpose, req, supp

        purpose = f"Exposição editorial de apoio ({role})."
        return purpose, req, supp
