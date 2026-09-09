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
                model="text-embedding-004",
                contents=text,
            )
            if hasattr(res, 'embedding') and hasattr(res.embedding, 'values'):
                vals = list(res.embedding.values)
                # Normaliza para norma unitaria
                norm = math.sqrt(sum(v * v for v in vals))
                return [v / norm for v in vals] if norm > 0 else vals
            elif hasattr(res, 'embeddings') and len(res.embeddings) > 0:
                vals = list(res.embeddings[0].values)
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
        candidates = list(qs)
        if not candidates and category:
            candidates = list(CatalogTemplate.objects.filter(category=category))
        if not candidates:
            candidates = list(CatalogTemplate.objects.all())

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

            scored_candidates.append((sim, tpl))

        # Ordena decrescente por similaridade
        scored_candidates.sort(key=lambda item: item[0], reverse=True)

        return [tpl for _, tpl in scored_candidates[:limit]]

    @classmethod
    def format_template_for_prompt(cls, template: CatalogTemplate) -> str:
        """
        Converte o blueprint do template em uma referencia Few-Shot concisa e estruturada
        para injecao no prompt do agente de IA.
        """
        category_name = dict(CatalogTemplate.CATEGORY_CHOICES).get(template.category, template.category)
        
        blueprint_summary = template.blueprint_data
        blueprint_clean_str = json.dumps(blueprint_summary, ensure_ascii=False, indent=2)

        return (
            f"[REFERENCIA EDITORIAL DE TEMPLATE (RAG)]:\n"
            f"- Nome: {template.title}\n"
            f"- Categoria: {category_name} (Capacidade recomendada: {template.product_capacity} produto(s))\n"
            f"- Segmento Recomendado: {template.industry} | Preset: {template.style_preset}\n"
            f"- Raciocinio de Direcao de Arte:\n"
            f"  {template.editorial_reasoning}\n"
            f"- Blueprint Estrutural de Referencia (JSON):\n"
            f"```json\n"
            f"{blueprint_clean_str}\n"
            f"```\n"
            f"Utilize este blueprint como guia de composicao, adaptando os dados (textos, precos e imagens) "
            f"para o contexto especifico do usuario."
        )

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
