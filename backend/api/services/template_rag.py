import math
import json
import logging
from typing import List, Dict, Any, Optional
from api.models import CatalogTemplate
from api.ai.provider import get_ai_provider

logger = logging.getLogger(__name__)

# Conceitos semanticos e pesos para o vetorizador de fallback
EDITORIAL_CONCEPTS = [
    # Tipos de Pagina
    ("capa cover abertura titulo monograma", 2.0),
    ("manifesto editorial historia conceito manifesto declaracao", 2.0),
    ("hero destaque individual peca unica destaque foco", 2.0),
    ("duo dupla dois par combinado conjunto", 2.0),
    ("grade grid catalogo 4 quatro matriz atacado b2b tabela", 2.2),
    ("divisor capitulo transicao secao divisao", 1.8),
    ("contracapa fechamento contato corporativo endereco verso", 1.8),
    
    # Segmentos / Industrias
    ("luxo joias alta moda couro marroquinaria sofisticado", 1.8),
    ("industrial pecas maquinas b2b fabricacao engenharia", 1.8),
    ("moveis decoracao arquitetura design interiores ambiente", 1.8),
    ("gastronomia alimentos vinhos cafeteria restaurante", 1.8),
    ("cosmeticos beleza cuidados skincare perfumes", 1.8),
    ("tecnologia hardware eletronicos software inovacao", 1.8),
    
    # Estilos Visuais
    ("minimalista clean respiro espaco em branco sobrio", 1.5),
    ("escuro noir preto ouro gold luxuoso", 1.5),
    ("claro ivory branco puro arejado natural", 1.5),
    ("tipografia serif serifada tradicional editorial classica", 1.5),
    ("moderno sans sans-serif contemporaneo corporativo", 1.5),
    
    # Elementos e Metricas
    ("preco valor sku codigo tabela condicoes pagamento", 1.6),
    ("foto imagem ambientacao galeria visual full-bleed", 1.5),
    ("especificacao medidas dimensoes ficha tecnica material", 1.6),
]


def generate_fallback_embedding(text: str, dimensions: int = 64) -> List[float]:
    """
    Gera um vetor de caracteristicas semanticas normalizado (L2 = 1.0)
    baseado em conceitos do dominio editorial e projecao deterministica de n-gramas.
    Utilizado em modo mock ou como fallback resiliente.
    """
    if not text:
        return [0.0] * dimensions

    text_lower = text.lower()
    vec = [0.0] * dimensions

    # 1. Atribuicao por conceitos semanticos editoriais
    for idx, (keywords, weight) in enumerate(EDITORIAL_CONCEPTS):
        slot = idx % dimensions
        for kw in keywords.split():
            if kw in text_lower:
                vec[slot] += weight

    # 2. Projecao deterministica por n-gramas de caracteres
    words = text_lower.split()
    for word in words:
        h = 2166136261
        for char in word:
            h = ((h ^ ord(char)) * 16777619) & 0xFFFFFFFF
        slot = h % dimensions
        vec[slot] += 0.5

    # 3. Normalizacao L2 (vetor unitario)
    norm = math.sqrt(sum(v * v for v in vec))
    if norm > 0:
        return [round(v / norm, 5) for v in vec]
    return [0.0] * dimensions


def generate_embedding(text: str) -> List[float]:
    """
    Gera o embedding do texto.
    Caso a integracao real com Gemini (GenAI SDK) esteja ativa, consome text-embedding-004;
    caso contrario, utiliza o vetorizador semantico deterministico.
    """
    provider = get_ai_provider()
    
    if not provider.is_mock and provider.client:
        try:
            res = provider.client.models.embed_content(
                model="gemini-embedding-001",
                contents=text,
            )
            vals = None
            if hasattr(res, 'embeddings') and res.embeddings and len(res.embeddings) > 0:
                vals = list(res.embeddings[0].values)
            elif hasattr(res, 'embedding') and getattr(res.embedding, 'values', None):
                vals = list(res.embedding.values)

            if vals:
                norm = math.sqrt(sum(v * v for v in vals))
                return [v / norm for v in vals] if norm > 0 else vals
        except Exception as exc:
            logger.warning(f"[TemplateRAG] Erro ao obter embedding com Gemini API: {exc}. Usando gerador fallback.")

    return generate_fallback_embedding(text)


def cosine_similarity(vec_a: List[float], vec_b: List[float]) -> float:
    """
    Calcula a similaridade por cosseno entre dois vetores.
    Se ambos forem unitarios, equivale ao produto escalar sum(a_i * b_i).
    """
    if not vec_a or not vec_b or len(vec_a) != len(vec_b):
        return 0.0

    dot = sum(a * b for a, b in zip(vec_a, vec_b))
    norm_a = math.sqrt(sum(a * a for a in vec_a))
    norm_b = math.sqrt(sum(b * b for b in vec_b))

    if norm_a == 0.0 or norm_b == 0.0:
        return 0.0

    return dot / (norm_a * norm_b)


class TemplateRAGService:
    """
    Servico de Recuperacao Hibrida (Filtros Deterministicos + Busca Vetorial)
    para o acervo de templates do Catana 2.0.
    """

    @classmethod
    def search_templates(
        cls,
        query: str,
        category: Optional[str] = None,
        industry: Optional[str] = None,
        product_capacity: Optional[int] = None,
        organization_id: Optional[int] = None,
        limit: int = 2,
    ) -> List[CatalogTemplate]:
        """
        Busca os templates mais aderentes com pre-filtragem relacional e ordenacao por cosseno.
        """
        # 1. Pre-filtragem deterministica no banco
        qs = CatalogTemplate.objects.all()

        if organization_id:
            qs = qs.filter(organization_id=organization_id) | qs.filter(is_system=True)
        else:
            qs = qs.filter(is_system=True)

        if category:
            qs = qs.filter(category=category)

        if industry:
            qs = qs.filter(industry=industry)

        # Se apos filtros rigorosos o conjunto estiver vazio, relaxa os filtros para manter robustez
        try:
            candidates = list(qs)
            if not candidates and category:
                candidates = list(CatalogTemplate.objects.filter(category=category))
            if not candidates:
                candidates = list(CatalogTemplate.objects.all())
        except Exception as e:
            logger.warning(f"[TemplateRAGService] Falha ao consultar templates no banco ({e}). Utilizando fallback semântico.")
            return []

        if not candidates:
            return []

        # 2. Vetorizacao da query do usuario
        query_vec = generate_embedding(query)

        # 3. Ranqueamento por similaridade cosseno
        scored_candidates = []
        for tpl in candidates:
            tpl_vec = tpl.embedding
            if not tpl_vec or len(tpl_vec) != len(query_vec):
                # Se nao tiver embedding salvo com dimensao equivalente, gera a partir dos metadados
                enrich_text = f"{tpl.title} {tpl.category} {tpl.industry} {tpl.description} {tpl.editorial_reasoning}"
                tpl_vec = generate_embedding(enrich_text)

            sim = cosine_similarity(query_vec, tpl_vec)

            # Bonus sutil se a capacidade de produtos bater exatamente
            if product_capacity is not None and tpl.product_capacity == product_capacity:
                sim += 0.15

            if any(word in query.lower() for word in ['atacado', 'b2b', 'industrial']) and tpl.industry == 'industrial_b2b':
                sim += 0.30
            scored_candidates.append((sim, tpl))

        # Ordena decrescente por similaridade
        scored_candidates.sort(key=lambda item: (-item[0], item[1].slug))

        return [tpl for _, tpl in scored_candidates[:limit]]

    @classmethod
    def format_template_for_prompt(cls, template: CatalogTemplate) -> str:
        """
        Converte o blueprint do template em uma referencia de conhecimento (RAG)
        declarada explicitamente como NAO-VINCULANTE (NON-BINDING).
        """
        category_name = dict(CatalogTemplate.CATEGORY_CHOICES).get(template.category, template.category)
        
        blueprint_summary = template.blueprint_data
        blueprint_clean_str = json.dumps(blueprint_summary, ensure_ascii=False, indent=2)

        return (
            f"[CONHECIMENTO EDITORIAL E REFERENCIA (RAG - NON-BINDING)]:\n"
            f"- Tipo de Chunk: EXAMPLE (NON-BINDING)\n"
            f"- Nome: {template.title}\n"
            f"- Categoria: {category_name} (Capacidade sugerida: {template.product_capacity} produto(s))\n"
            f"- Segmento Sugerido: {template.industry} | Preset: {template.style_preset}\n"
            f"- Raciocinio de Direcao de Arte:\n"
            f"  {template.editorial_reasoning}\n"
            f"- Blueprint Estrutural de Referencia (JSON):\n"
            f"```json\n"
            f"{blueprint_clean_str}\n"
            f"```\n"
            f"NOTA NORMATIVA: EXAMPLES ARE NON-BINDING. Um exemplo recuperado NUNCA define "
            f"page_count, estrutura, paleta, quantidade de elementos, ordem ou layout final. "
            f"As restrições do briefing do usuário (Hard Constraints) têm precedência absoluta."
        )

    @classmethod
    def retrieve_context_for_contract(cls, contract: Any) -> Dict[str, Any]:
        """
        Executa retrieval consciente de restrições para alimentar o Content e Design Planner.
        Filtra candidatos incompatíveis com restrições negativas (ex: NO_CARDS).
        """
        from api.ai.constraint_engine import ConstraintEngine

        prompt = contract.raw_prompt
        industry = contract.detected_industry
        negatives = set(contract.constraints.negative)

        # Busca referências de templates
        raw_templates = cls.search_templates(
            query=f"{prompt} {industry}",
            industry=industry,
            limit=4,
        )

        template_dicts = []
        for t in raw_templates:
            template_dicts.append({
                "slug": t.slug,
                "title": t.title,
                "category": t.category,
                "description": t.description,
                "blueprint_data": t.blueprint_data,
                "product_capacity": t.product_capacity,
                "is_one_pager_compatible": t.product_capacity <= 4,
            })

        # Filtra pelo ConstraintEngine
        valid_templates = ConstraintEngine.filter_retrieved_knowledge(contract, template_dicts)

        return {
            "retrieved_templates": valid_templates,
            "industry": industry,
            "non_binding": True,
            "rag_rules": [
                "EXAMPLES_ARE_NON_BINDING",
                "PRESERVE_USER_HARD_CONSTRAINTS",
            ],
        }

    @classmethod
    def retrieve_best_template_prompt(
        cls,
        query: str,
        category: Optional[str] = None,
        industry: Optional[str] = None,
        product_capacity: Optional[int] = None,
        organization_id: Optional[int] = None,
    ) -> Optional[str]:
        """
        Metodo utilitario que busca o Top-1 template e devolve a string formatada para o prompt,
        ou None se nenhum template for localizado.
        """
        matches = cls.search_templates(
            query=query,
            category=category,
            industry=industry,
            product_capacity=product_capacity,
            organization_id=organization_id,
            limit=1,
        )
        if matches:
            return cls.format_template_for_prompt(matches[0])
        return None

    @classmethod
    def detect_industry(cls, prompt: str, products: Optional[List[Dict[str, Any]]] = None) -> str:
        """
        Detecta o segmento industrial/comercial a partir do prompt e dos produtos.
        """
        text_corpus = prompt.lower()
        if products:
            for p in products[:6]:
                text_corpus += " " + (" ".join(str(p.get(k) or "") for k in ["name", "category", "description"])).lower()

        if any(k in text_corpus for k in ["cutelaria", "faca", "facas", "forja", "damasco", "chef", "lamina", "lâmina", "artesanal", "cutelo", "afiador", "katana"]):
            return "cutlery_craftsmanship"
        if any(k in text_corpus for k in ["embalag", "descartav", "pote", "marmita", "food service", "vedacao", "vedação", "pet redondo", "sacola", "copo", "delivery"]):
            return "packaging_food_service"
        if any(k in text_corpus for k in ["doce", "confeit", "bolo", "patisserie", "sobremesa", "chocolate", "brigadeiro", "festa", "torta", "padaria", "cafe"]):
            return "gastronomy_sweets"
        if any(k in text_corpus for k in ["carne", "acougue", "açougue", "churrasco", "corte", "angus", "bovino", "costela", "frango"]):
            return "butcher_meat"
        if any(k in text_corpus for k in ["tech", "tecnolog", "hardware", "setup", "computad", "software", "periferic", "eletron"]):
            return "tech_hardware"
        if any(k in text_corpus for k in ["joia", "joalher", "luxo", "ouro", "prata", "couro", "bolsa", "moda", "lookbook", "alfaiat"]):
            return "luxury_fashion"
        if any(k in text_corpus for k in ["valvula", "industrial", "b2b", "tubo", "usinagem", "ferramenta", "maquina"]):
            return "industrial_b2b"
        return "general_retail"

    @classmethod
    def extract_requested_page_count(cls, prompt: str) -> Optional[int]:
        """
        Extrai a quantidade de páginas solicitada expressamente pelo usuário no prompt.
        Suporta termos como 'uma página', '1 página', 'single page', 'one page',
        '2 páginas', '4 páginas', 'duas páginas', etc.
        """
        if not prompt:
            return None
        import re
        p_lower = prompt.lower()

        # 1 página (expressões comuns em português e inglês)
        if re.search(r'\b(?:1|uma|um|single|one)\s*(?:p[aá]gina|pag\b|p[aá]g\b|folha|l[aâ]mina|prancheta|spread|one[- ]?page|onepager|single[- ]?page)\b', p_lower):
            return 1
        if re.search(r'\b(?:one[- ]?page|onepager|single[- ]?page|folha\s*[uú]nica|l[aâ]mina\s*[uú]nica|p[aá]gina\s*[uú]nica)\b', p_lower):
            return 1

        word_to_num = {
            'duas': 2, 'dois': 2, 'two': 2,
            'tres': 3, 'três': 3, 'three': 3,
            'quatro': 4, 'four': 4,
            'cinco': 5, 'five': 5,
            'seis': 6, 'six': 6,
            'sete': 7, 'seven': 7,
            'oito': 8, 'eight': 8,
            'nove': 9, 'nine': 9,
            'dez': 10, 'ten': 10,
            'doze': 12, 'twelve': 12,
            'dezesseis': 16, 'sixteen': 16,
        }

        # Dígitos numéricos (ex: 1 a 32 páginas)
        match_digit = re.search(r'\b(\d+)\s*(?:p[aá]ginas?|pags?\b|p[aá]gs?\b|folhas?|l[aâ]minas?|pranchetas?)\b', p_lower)
        if match_digit:
            val = int(match_digit.group(1))
            if 1 <= val <= 32:
                return val

        # Palavras por extenso
        for word, num in word_to_num.items():
            if re.search(rf'\b{word}\s*(?:p[aá]ginas?|pags?\b|p[aá]gs?\b|folhas?|l[aâ]minas?|pranchetas?)\b', p_lower):
                return num

        return None

    @classmethod
    def plan_dynamic_catalog_structure(
        cls,
        prompt: str,
        products: Optional[List[Dict[str, Any]]] = None,
        organization_id: Optional[int] = None,
    ) -> List[Dict[str, Any]]:
        """
        Calcula dinamicamente a estrutura de paginas do catalogo integrando o
        RequirementParser e o PageBudgetEngine, respeitando rigorosamente hard constraints
        (como contagem exata, máxima e mínima de páginas).
        """
        from api.ai.requirement_parser import RequirementParser
        from api.ai.page_budget import PageBudgetEngine

        contract = RequirementParser.parse(prompt=prompt, products=products)
        slots = PageBudgetEngine.calculate_and_allocate_slots(contract=contract, products=products)
        industry = contract.detected_industry

        planned_pages = []
        for slot in slots:
            p_type = "single" if slot.role == "one_pager" else slot.role
            cap = slot.target_capacity

            # Busca no RAG o template mais relevante como referencia consultiva
            matches = cls.search_templates(
                query=f"{prompt} {p_type} {industry}",
                category=p_type if p_type in ["cover", "manifesto", "hero", "duo", "grid_4", "divider", "backcover"] else None,
                industry=industry,
                limit=1,
                organization_id=organization_id,
            )
            matched_tpl = matches[0] if matches else None

            planned_pages.append({
                "pageNumber": slot.page_number,
                "type": p_type,
                "capacity": cap,
                "template_slug": matched_tpl.slug if matched_tpl else f"generic-{p_type}",
                "template_title": matched_tpl.title if matched_tpl else f"Lamina {p_type.capitalize()}",
                "blueprint_data": matched_tpl.blueprint_data if matched_tpl else {},
                "assigned_products": slot.allocated_products,
            })

        return planned_pages

