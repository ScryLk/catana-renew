import json
import logging
import re
import time
from typing import Dict, Any, Optional, List
from .provider import get_ai_provider

logger = logging.getLogger(__name__)

IMAGE_STOCK_BY_NICHE = {
    'embalagens': {
        'dividers': [
            'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=1200&q=80',
            'https://images.unsplash.com/photo-1530587191325-3db32d826c18?w=1200&q=80',
        ],
        'products': [
            '/catalogos/foodServiceSemFundo/fs-01.png',
            '/catalogos/foodServiceSemFundo/fs-02.png',
            '/catalogos/foodServiceSemFundo/fs-03.png',
            '/catalogos/foodServiceSemFundo/fs-04.png',
            '/catalogos/foodServiceSemFundo/fs-05.png',
            '/catalogos/foodServiceSemFundo/fs-06.png',
            '/catalogos/foodServiceSemFundo/fs-07.png',
            '/catalogos/foodServiceSemFundo/fs-08.png',
            '/catalogos/produtosConfeitaria/pf-08.png',
            '/catalogos/produtosConfeitaria/pf-10.png',
            '/catalogos/produtosConfeitaria/pf-13.png',
            '/catalogos/produtosConfeitaria/pf-20.png',
            '/catalogos/produtosConfeitaria/pote-pet-redondo.png',
            '/catalogos/linhaFestaSemFundo/lf-01.png',
            '/catalogos/linhaFestaSemFundo/lf-02.png',
        ],
    },
    'confeitaria': {
        'dividers': [
            'https://images.unsplash.com/photo-1486427944299-d1955d23e34d?w=1200&q=80',
            'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=1200&q=80',
        ],
        'products': [
            '/catalogos/produtosConfeitaria/pf-10.png',
            '/catalogos/produtosConfeitaria/pf-11.png',
            '/catalogos/produtosConfeitaria/pf-13.png',
            '/catalogos/produtosConfeitaria/pf-18.png',
            '/catalogos/produtosConfeitaria/pf-20.png',
            '/catalogos/linhaFestaSemFundo/lf-01.png',
            '/catalogos/linhaFestaSemFundo/lf-02.png',
            '/catalogos/linhaFestaSemFundo/lf-03.png',
        ],
    },
    'acougue': {
        'dividers': [
            'https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?w=1200&q=80',
            'https://images.unsplash.com/photo-1544025162-d76694265947?w=1200&q=80',
        ],
        'products': [
            '/catalogos/produtoAcougue/a-02.png',
            '/catalogos/produtoAcougue/a-03.png',
            '/catalogos/produtoAcougue/a-04.png',
            '/catalogos/produtoAcougue/ff-02.png',
            '/catalogos/produtoAcougue/ff-03.png',
            '/catalogos/produtoAcougue/ff-04.png',
        ],
    },
    'cutelaria': {
        'dividers': [
            'https://images.unsplash.com/photo-1593618998160-e34014e67546?w=1200&q=80',
            'https://images.unsplash.com/photo-1589792905706-e7816bb1cf2e?w=1200&q=80',
        ],
        'products': [
            'https://images.unsplash.com/photo-1593618998160-e34014e67546?w=800&q=80',
            'https://images.unsplash.com/photo-1584269600464-37b1b58a9fe7?w=800&q=80',
            'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=800&q=80',
            'https://images.unsplash.com/photo-1590794056226-79ef3a8147e1?w=800&q=80',
            'https://images.unsplash.com/photo-1589792905706-e7816bb1cf2e?w=800&q=80',
            'https://images.unsplash.com/photo-1614332284683-51bbe9033d9f?w=800&q=80',
        ],
    },
    'joias': {
        'dividers': [
            'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=1200&q=80',
        ],
        'products': [
            'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=800&q=80',
            'https://images.unsplash.com/photo-1605100804763-247f67b3557e?w=800&q=80',
            'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=800&q=80',
            'https://images.unsplash.com/photo-1602751584552-8ba73aad10e1?w=800&q=80',
        ],
    },
    'tech': {
        'dividers': [
            'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=1200&q=80',
        ],
        'products': [
            'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=800&q=80',
            'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=800&q=80',
            'https://images.unsplash.com/photo-1546868871-7041f2a55e12?w=800&q=80',
            'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&q=80',
        ],
    },
    'padrao': {
        'dividers': [
            'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=1200&q=80',
            'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=1200&q=80',
        ],
        'products': [
            'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&q=80',
            'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=800&q=80',
            'https://images.unsplash.com/photo-1524805444758-089113d48a6d?w=800&q=80',
            'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&q=80',
            'https://images.unsplash.com/photo-1572635196237-14b3f281503f?w=800&q=80',
            'https://images.unsplash.com/photo-1583394838336-acd977736f90?w=800&q=80',
            'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=800&q=80',
            'https://images.unsplash.com/photo-1601924994987-69e26d50dc26?w=800&q=80',
        ],
    },
}

def resolve_images_for_prompt(prompt: str):
    p_lower = prompt.lower()
    if any(k in p_lower for k in [
        'cutelaria', 'faca', 'facas', 'damasco', 'forja', 'lamina', 'lâmina',
        'chef', 'katana', 'chaira', 'tabua', 'tábua', 'afiador'
    ]):
        return IMAGE_STOCK_BY_NICHE['cutelaria']
    if any(k in p_lower for k in ['joia', 'joias', 'joalher', 'ouro', 'diamante', 'anel', 'colar', 'brinco', 'prata']):
        return IMAGE_STOCK_BY_NICHE['joias']
    if any(k in p_lower for k in ['tech', 'hardware', 'setup', 'computad', 'eletron', 'tecnolog', 'gadget']):
        return IMAGE_STOCK_BY_NICHE['tech']
    if any(k in p_lower for k in [
        'embalagem', 'embalagens', 'descartav', 'pote', 'marmita', 'isopor',
        'food service', 'vedacao', 'vedação', 'caixa', 'cúpula', 'cupula',
        'frasco', 'bandeja', 'pet redondo', 'copo', 'delivery', 'takeaway'
    ]):
        return IMAGE_STOCK_BY_NICHE['embalagens']
    if any(k in p_lower for k in ['carne', 'acougue', 'açougue', 'churrasco', 'corte', 'angus', 'bovino', 'costela', 'frango']):
        return IMAGE_STOCK_BY_NICHE['acougue']
    if any(k in p_lower for k in ['doce', 'confeit', 'bolo', 'patisserie', 'sobremesa', 'chocolate', 'brigadeiro', 'festa', 'torta']):
        return IMAGE_STOCK_BY_NICHE['confeitaria']
    return IMAGE_STOCK_BY_NICHE['padrao']

SYSTEM_CREATIVE_SYNTHESIS_PROMPT = """
Voce e o Diretor Criativo e Editor-Chefe do Katana Studio, a mais prestigiosa plataforma de design editorial de luxo.
Sua missao e sintetizar a visao editorial, paleta cromatica, selo da capa, manifesto de marca e catalogo de produtos para publicacao de alto padrao.

DIRETRIZES DE CRIACAO:
1. Identidade e Cores: Escolha uma paleta cromatica refinada (3 ou 4 cores harmoniosas sob contraste WCAG AAA) condizente com a sofisticacao do segmento.
2. Capa e Selos: Crie um titulo imponente para a marca/colecao, subtitulo e um selo editorial refinado ('cover_label', ex: 'COLECAO FORJA ANCESTRAL · VOLUME I', 'CATALOGO EXCLUSIVO 2026', etc.). NUNCA invente marcas ou estacoes fora do contexto do briefing.
3. Manifesto: Crie um manifesto filosofico com uma citacao de impacto e 1 a 2 paragrafos em prosa elegante.
4. PRODUTOS:
   - Se houver produtos fornecidos na secao 'PRODUTOS CADASTRADOS' ou descritos detalhadamente no 'Briefing do Catalogo', extraia e preserve fielmente cada um deles com nome, sku, preco, categoria, descricao sensorial e tag comercial.
   - Se o usuario descreveu itens no texto do briefing (ex: itens numerados, nomes de pecas, precos em R$, dimensoes), extraia todos eles com seus precos e especificacoes no array 'products'.
   - Se o briefing for apenas conceitual sem citacao a produtos especificos (e nao houver produtos cadastrados), retorne 'products' obrigatoriamente como um array vazio [] para permitir que o Studio crie pranchetas com slots conceituais abertos para alocacao.

Retorne EXCLUSIVAMENTE um objeto JSON valido (sem tags markdown, apenas o JSON puro) com a seguinte estrutura:
{
  "title": "Nome da Marca ou Colecao",
  "category": "Segmento / Ramo de Atuacao",
  "summary": "Resumo sintético da visao editorial da colecao em uma frase persuasiva",
  "reasoning": "Racional do conselho editorial explicando a harmonia cromatica e proporcao visual",
  "cover_label": "Selo editorial para a capa (ex: COLECAO FORJA ANCESTRAL · VOLUME I)",
  "palette": {
    "name": "Nome Nobre da Paleta (ex: Noir & Aco Forjado, Terracotta & Sable, Kraft Botanical)",
    "primary": "#HEX (cor dominante escura de texto e capa)",
    "background": "#HEX (cor de fundo acolhedora das paginas)",
    "accent": "#HEX (cor de destaque/ouro/cromo)",
    "secondary": "#HEX (cor de apoio neutra)",
    "contrastRatio": "10.4:1 (AAA)"
  },
  "manifesto": {
    "title": "Titulo do Manifesto",
    "quote": "Citacao filosofica ou declaracao de intencao em destaque",
    "content": "Texto do manifesto editorial em prosa elegante (1 a 2 paragrafos)."
  },
  "products": [
    {
      "index": "01",
      "name": "Nome da peca",
      "category": "Categoria ou Linha",
      "sku": null,
      "price": null,
      "description": "Descricao sensorial e comercial minuciosa do produto (1 a 2 frases)",
      "tag": "Selo editorial (ex: Obra Prima, Destaque, Mais Vendido, Linha Pro, Essencial)"
    }
  ]
}
"""
SYSTEM_CATALOG_WITH_PRODUCTS_PROMPT = SYSTEM_CREATIVE_SYNTHESIS_PROMPT
SYSTEM_CATALOG_PROMPT = SYSTEM_CREATIVE_SYNTHESIS_PROMPT


def _run_gemini_or_contingency_synthesis(prompt: str, clean_products: List[Dict[str, Any]], detected_industry: str) -> Dict[str, Any]:
    """Executa a síntese criativa via Gemini SDK ou fallback de contingência."""
    provider = get_ai_provider()
    synthesis_data = None

    if provider.client:
        try:
            from google.genai import types
            from api.services.template_rag import TemplateRAGService

            has_text_products = bool(
                re.search(r'(R\$|\$\s*\d|\b\d+[\.,]\d{2}\b|\bSKU\b|\bdimens|\bcm\b|\bmm\b|\bpeso\b|\bpreco\b|\bpreço\b)', prompt, re.IGNORECASE) or
                re.search(r'^\s*(\d+[\.\)-]|[-*•])\s+[A-Za-z]', prompt, re.MULTILINE)
            )

            requested_pages = TemplateRAGService.extract_requested_page_count(prompt)
            page_instruction = f"ATENÇÃO: O usuário solicitou expressamente um catálogo de {requested_pages} página(s).\n" if requested_pages else ""

            if clean_products:
                prods_summary = "\n".join([
                    f"- [{p['index']}] {p['name']} | Categoria: {p.get('category') or ''} | Preco: {p['price']} | SKU: {p['sku']} | Descricao previa: {str(p.get('description') or '')[:60]}"
                    for p in clean_products
                ])
                user_contents = (
                    f"Briefing do Catalogo: {prompt}\n"
                    f"Segmento Identificado: {detected_industry}\n"
                    f"{page_instruction}\n"
                    f"PRODUTOS CADASTRADOS:\n{prods_summary}\n\n"
                    "INSTRUCAO: Sintetize o titulo da colecao, a paleta de cores nobre com contraste AAA, "
                    "o selo de capa (cover_label) e o manifesto institucional. Nunca altere nem invente campos comerciais."
                )
            elif has_text_products:
                user_contents = (
                    f"Briefing do Catalogo: {prompt}\n"
                    f"Segmento Identificado: {detected_industry}\n"
                    f"{page_instruction}\n"
                    "INSTRUCAO: Analise minuciosamente o briefing. O usuario descreveu produtos no texto. "
                    "Extraia integralmente cada um dos produtos no array 'products' com nome, categoria, SKU, preco e especificacoes tecnicas.\n"
                    "Crie tambem o titulo da colecao, paleta cromatica refinada com contraste AAA, selo de capa (cover_label) e manifesto poetico da marca."
                )
            else:
                user_contents = (
                    f"Briefing do Catalogo: {prompt}\n"
                    f"Segmento Identificado: {detected_industry}\n"
                    f"{page_instruction}\n"
                    "INSTRUCAO: Analise o briefing conceitual. Crie a identidade da colecao (titulo, categoria, summary, reasoning), "
                    "paleta cromatica refinada com contraste AAA, selo de capa (cover_label) e manifesto poetico da marca.\n"
                    "PRODUTOS: Como este briefing e puramente conceitual e nao detalha produtos individuais, retorne 'products' obrigatoriamente como um array vazio []."
                )

            config = types.GenerateContentConfig(
                system_instruction=SYSTEM_CREATIVE_SYNTHESIS_PROMPT,
                temperature=0.6,
                response_mime_type="application/json",
            )
            candidate_models = [
                provider.default_model or "gemini-flash-latest",
                "gemini-flash-latest",
                "gemini-flash-lite-latest",
            ]
            ordered_models = []
            for m in candidate_models:
                if m and m not in ordered_models:
                    ordered_models.append(m)

            for m_candidate in ordered_models:
                try:
                    resp = provider.client.models.generate_content(
                        model=m_candidate,
                        contents=user_contents,
                        config=config,
                    )
                    raw_text = resp.text.strip()
                    if raw_text.startswith("```json"):
                        raw_text = raw_text[7:]
                    if raw_text.startswith("```"):
                        raw_text = raw_text[3:]
                    if raw_text.endswith("```"):
                        raw_text = raw_text[:-3]
                    parsed = json.loads(raw_text.strip())
                    if isinstance(parsed, dict):
                        synthesis_data = parsed
                        break
                except Exception as m_err:
                    logger.warning(f"[CatalogBuilder] Modelo '{m_candidate}' falhou ({m_err}). Tentando proximo...")
        except Exception as exc:
            logger.warning(f"[CatalogBuilder] Gemini indisponivel ou cota zerada ({exc}). Acionando sintese de contingencia.")

    if not synthesis_data or not isinstance(synthesis_data, dict):
        synthesis_data = _get_contingency_synthesis(prompt, clean_products, detected_industry)

    return synthesis_data


def generate_catalog_from_gemini(prompt: str, products: Optional[List[Dict[str, Any]]] = None, creative_seed: Optional[int] = None) -> Dict[str, Any]:
    """
    Gera um catalogo editorial desacoplado e governado por restricoes via EditorialGenerationPipeline.
    Executa o fluxo completo de 12 camadas:
    Prompt -> Intent Parser -> Contract -> Constraint Engine -> RAG -> Content Planner -> Design Planner -> Generation -> Validator -> Auto-Repair -> Output.
    Preserva total compatibilidade com o retorno esperado pelo frontend e endpoints do Catana 2.0.
    """
    from api.services.template_rag import TemplateRAGService
    from api.ai.pipeline import EditorialGenerationPipeline

    from api.ai.commercial_guard import CommercialIntegrityGuard
    # Only supplied structured product data crosses the commercial boundary.
    clean_products = [CommercialIntegrityGuard.sanitize_supplied_product(p) for p in (products or [])]
    for idx, product in enumerate(clean_products):
        product.setdefault('index', f'{idx + 1:02d}')
        if product['id'] is None:
            product['id'] = f'input-product-{idx + 1}'
    detected_industry = TemplateRAGService.detect_industry(prompt, clean_products)
    # Layout and its metadata are deterministic. Remote creative proposals cannot
    # become commercial truth or silently change the same input/seed document.

    # 3. Execucao pelo EditorialGenerationPipeline (12 etapas desacopladas)
    doc = EditorialGenerationPipeline.execute(
        prompt=prompt,
        products=clean_products,
        synthesis_generator_func=None,
        creative_seed=creative_seed,
    )

    # 4. Enriquecimento dos metadados de conselho editorial e contingencia para compatibilidade total
    is_one_pager = len(doc.get("pages", [])) == 1
    doc_title = doc.get("title", "Coleção Editorial")
    palette = doc.get("palette", {})

    doc["councilDelegations"] = [
        {
            "roleId": "orchestrator",
            "roleName": "Editor-Chefe",
            "badge": "Orquestrador",
            "action": (
                f"Estruturou catálogo dinâmico de página única (One-Pager) para '{doc_title}'."
                if is_one_pager else
                f"Estruturou catálogo dinâmico com {len(doc.get('pages', []))} lâminas via Pipeline Editorial para '{doc_title}'."
            ),
        },
        {
            "roleId": "director",
            "roleName": "Diretor de Arte",
            "badge": "Design",
            "action": f"Definiu paleta '{palette.get('name', 'Personalizada')}' e composição visual com contraste verificado.",
        },
        {
            "roleId": "copywriter",
            "roleName": "Redator Sênior",
            "badge": "Redação",
            "action": "Elaborou manifesto e chamadas persuasivas preservando dados e regras de conteúdo.",
        },
        {
            "roleId": "commercial",
            "roleName": "Diretor Comercial",
            "badge": "Comercial",
            "action": (
                f"Alocou {len(clean_products)} produtos com precificação e SKUs validados."
                if clean_products else
                "Preparou pranchetas com wireframes de diagramação aguardando alocação de produtos pelo usuário."
            ),
        },
    ]

    return doc


def _get_contingency_synthesis(prompt: str, products: List[Dict[str, Any]], industry: str) -> Dict[str, Any]:
    """
    Gera a sintese criativa de contingencia quando a API remota de IA estiver indisponivel.
    """
    has_text_products = bool(
        re.search(r'(R\$|\$\s*\d|\b\d+[\.,]\d{2}\b|\bSKU\b|\bdimens|\bcm\b|\bmm\b|\bpeso\b|\bpreco\b|\bpreço\b)', prompt, re.IGNORECASE) or
        re.search(r'^\s*(\d+[\.\)-]|[-*•])\s+[A-Za-z]', prompt, re.MULTILINE)
    )
    should_include_products = bool(products or has_text_products)

    if industry == "cutlery_craftsmanship":
        contingency_prods = products if products else ([
            {
                "index": "01",
                "name": "Faca do Chef Damasco 240mm — Edição Shiro",
                "category": "Alta Cutelaria",
                "sku": "KT-DAM-240",
                "price": "R$ 2.850,00",
                "description": "67 camadas de aço damasco japonês VG-10, dureza 61 HRC e cabo octogonal em jacarandá.",
                "tag": "Obra Prima",
            },
            {
                "index": "02",
                "name": "Santoku Artesanal 180mm — Linha Kaze",
                "category": "Alta Cutelaria",
                "sku": "KT-SAN-180",
                "price": "R$ 1.980,00",
                "description": "Lâmina alveolada com acabamento Kurouchi fosco e cabo em ébano maciço.",
                "tag": "Alta Gastronomia",
            },
            {
                "index": "03",
                "name": "Petty Knife de Desossa 120mm",
                "category": "Alta Cutelaria",
                "sku": "KT-PET-120",
                "price": "R$ 1.240,00",
                "description": "Geometria fina para tornear e desossas delicadas com equilíbrio milimétrico.",
                "tag": "Precisão Cirúrgica",
            },
            {
                "index": "04",
                "name": "Tábua Magnética em Nogueira Maciça 45cm",
                "category": "Utensílios & Suportes",
                "sku": "KT-MAG-45",
                "price": "R$ 890,00",
                "description": "Madeira de lei com ímãs de neodímio embutidos para fixação segura de facas.",
                "tag": "Essencial",
            },
            {
                "index": "05",
                "name": "Pedra de Amolar Combinada 1000/6000 com Suporte",
                "category": "Afiação & Cuidados",
                "sku": "KT-STON-01",
                "price": "R$ 680,00",
                "description": "Grãos finos para afiação precisa e polimento espelhado do fio de corte.",
                "tag": "Cuidados Pro",
            },
            {
                "index": "06",
                "name": "Chaira de Cerâmica Premium 30cm",
                "category": "Afiação & Cuidados",
                "sku": "KT-STEL-30",
                "price": "R$ 520,00",
                "description": "Cerâmica de alta dureza para alinhamento diário do fio sem desgastar a lâmina.",
                "tag": "Acabamento",
            },
            {
                "index": "07",
                "name": "Estojo de Transporte em Couro Bovino Envelhecido",
                "category": "Acessórios",
                "sku": "KT-ROLL-06",
                "price": "R$ 1.150,00",
                "description": "Compartimentos acolchoados para 6 facas com fivelas em latão envelhecido.",
                "tag": "Exclusivo",
            },
        ] if should_include_products else [])
        return {
            "title": "Katana Atelier — Forja & Tradição",
            "category": "Alta Cutelaria Artesanal",
            "summary": "Facas de chef e peças gastronômicas forjadas à mão com aço damasco e geometria precisa.",
            "reasoning": "Paleta sóbria grafite mineral e ouro envelhecido refletindo o fogo da forja e o brilho do aço polido.",
            "cover_label": "COLEÇÃO FORJA ANCESTRAL · VOLUME I",
            "palette": {
                "name": "Noir & Aço Forjado",
                "primary": "#141416",
                "background": "#F6F5F2",
                "accent": "#C5A059",
                "secondary": "#52525B",
                "contrastRatio": "14.2:1 (AAA)",
                "locked": False,
            },
            "manifesto": {
                "title": "A Alma do Aço",
                "quote": "O corte não é apenas uma divisão física: é a extensão silenciosa do próprio pensamento.",
                "content": "Cada lâmina nasce da têmpera ao fogo e do martelar meticuloso sobre a bigorna. Unimos a tradição milenar da cutelaria japonesa à ergonomia contemporânea.",
            },
            "products": contingency_prods,
        }
    elif industry == "packaging_food_service":
        contingency_prods = products if products else ([
            {"index": "01", "name": "Pote Redondo Hermético 500ml", "category": "Food Service", "sku": "FS-POT-500", "price": "R$ 48,00 /pct", "description": "Vedação perimetral estanque livre de BPA.", "tag": "Mais Vendido"},
            {"index": "02", "name": "Marmita Térmica Kraft 750ml", "category": "Food Service", "sku": "FS-KRF-750", "price": "R$ 62,00 /pct", "description": "Papel kraft virgem impermeabilizado para refeições quentes.", "tag": "Sustentável"},
            {"index": "03", "name": "Copo Cristal PET com Tampa Bolha 400ml", "category": "Food Service", "sku": "FS-COP-400", "price": "R$ 39,00 /pct", "description": "Transparência cristalina e travamento firme para sobremesas.", "tag": "Linha Festa"},
            {"index": "04", "name": "Sacola Delivery Fundo Largo Reforçada", "category": "Transporte", "sku": "FS-SAC-LAR", "price": "R$ 55,00 /pct", "description": "Capacidade para 3 marmitas empilhadas sem tombar.", "tag": "Essencial"},
        ] if should_include_products else [])
        return {
            "title": "Colecao EcoPack Pro",
            "category": "Embalagens & Food Service",
            "summary": "Solucoes avancadas em vedacao, transporte seguro e protecao termica para delivery de alto padrao.",
            "reasoning": "Paleta azul profundo e ciano refletindo tecnologia de vedacao e integridade sanitaria.",
            "cover_label": "CATÁLOGO TÉCNICO & FOOD SERVICE 2026",
            "palette": {
                "name": "Slate & Ocean Pro",
                "primary": "#0F172A",
                "background": "#F8FAFC",
                "accent": "#0284C7",
                "secondary": "#64748B",
                "contrastRatio": "10.1:1 (AAA)",
                "locked": False,
            },
            "manifesto": {
                "title": "A Integridade em Cada Entrega",
                "quote": "A confianca do consumidor comeca na integridade e pureza da embalagem recebida.",
                "content": "Nossas embalagens sao desenvolvidas com polimeros de alta densidade e travas perimetrais estanques, garantindo protecao confiavel contra vazamentos e retencao de frescor.",
            },
            "products": contingency_prods,
        }
    elif industry == "gastronomy_sweets":
        contingency_prods = products if products else ([
            {"index": "01", "name": "Torta Mousse Chocolat Noir 70%", "category": "Patisserie", "sku": "DOC-TRT-01", "price": "R$ 145,00", "description": "Glaçagem espelhada de cacau de origem com base crocante praliné.", "tag": "Assinatura"},
            {"index": "02", "name": "Pote Redondo Velvet Silvestre", "category": "Potes Gourmet", "sku": "DOC-POT-02", "price": "R$ 28,00", "description": "Camadas de bolo red velvet com compota de frutas vermelhas.", "tag": "Mais Vendido"},
            {"index": "03", "name": "Caixa Degustação Macarons Parisienses", "category": "Presenteáveis", "sku": "DOC-MAC-06", "price": "R$ 64,00", "description": "Seleção com 6 macarons de pistache, fava de baunilha e maracujá.", "tag": "Artesanal"},
            {"index": "04", "name": "Mini Domo Cristal Fondant", "category": "Linha Festa", "sku": "DOC-DOM-04", "price": "R$ 36,00", "description": "Domo individual para doces finos de recepção executiva.", "tag": "Eventos"},
        ] if should_include_products else [])
        return {
            "title": "Atelier Gourmet",
            "category": "Confeitaria & Padaria Fina",
            "summary": "Sobremesas autorais elaboradas com tecnicas artesanais e ingredientes de origem nobre.",
            "reasoning": "Paleta terracota e ambar valorizando o calor sensorial e a feitura manual.",
            "cover_label": "COLEÇÃO GOURMET & ENCOMENDAS 2026",
            "palette": {
                "name": "Terracotta & Warm Ivory",
                "primary": "#291819",
                "background": "#FFFDF9",
                "accent": "#D97706",
                "secondary": "#78350F",
                "contrastRatio": "9.5:1 (AAA)",
                "locked": False,
            },
            "manifesto": {
                "title": "A Arte da Paciencia",
                "quote": "O doce perfeito e aquele que harmoniza textura, aroma e memoria.",
                "content": "Cada receita nasce do respeito ao tempo dos ingredientes e a precisao da tecnica classica francesa, entregando uma experiencia sensorial memoravel.",
            },
            "products": contingency_prods,
        }
    else:
        contingency_prods = products if products else ([
            {"index": "01", "name": "Peça de Assinatura Edição Limitada", "category": "Coleção Principal", "sku": "EDT-001", "price": "R$ 480,00", "description": "Design contemporâneo com acabamento de precisão e materiais nobres.", "tag": "Destaque"},
            {"index": "02", "name": "Item Harmônico Série A", "category": "Complementos", "sku": "EDT-002", "price": "R$ 290,00", "description": "Equilíbrio funcional para integrar à rotina ou compor kits.", "tag": "Mais Vendido"},
            {"index": "03", "name": "Item Harmônico Série B", "category": "Complementos", "sku": "EDT-003", "price": "R$ 340,00", "description": "Geometria minimalista com proporção harmônica e alta durabilidade.", "tag": "Novo"},
            {"index": "04", "name": "Suporte Técnico de Mesa", "category": "Acessórios", "sku": "EDT-004", "price": "R$ 180,00", "description": "Estrutura estável usinada com proteção de superfície.", "tag": "Essencial"},
        ] if should_include_products else [])
        return {
            "title": "Colecao Editorial 2026",
            "category": "Design & Produtos",
            "summary": "Catalogo comercial moderno estruturado para apresentacao de alto impacto e conversao.",
            "reasoning": "Harmonia sobria monocromatica com acento dourado clássico.",
            "cover_label": "CATÁLOGO EXCLUSIVO · EDIÇÃO 2026",
            "palette": {
                "name": "Noir & Ivory",
                "primary": "#1A1817",
                "background": "#F5F1EA",
                "accent": "#B08D57",
                "secondary": "#4A4846",
                "contrastRatio": "9.2:1 (AAA)",
                "locked": False,
            },
            "manifesto": {
                "title": "Design com Proposito",
                "quote": "O essencial, executado sem concessões e com rigor técnico.",
                "content": "Desenvolvido para atender aos mais elevados padroes de exigencia, combinando estetica atemporal e utilidade confiavel.",
            },
            "products": contingency_prods,
        }



def generate_product_image_with_ai(name: str, category: str = "", description: str = "") -> Dict[str, Any]:
    """
    Sintetiza prompt fotografico comercial e resolve uma imagem de alta resolucao
    para produtos importados de planilhas.
    """
    name_clean = name.strip()
    cat_clean = category.strip()
    desc_clean = description.strip()

    prompt_used = (
        f"Fotografia comercial de estudio em alta resolucao, fundo neutro infinito suave, "
        f"iluminacao difusa editorial de luxo: {name_clean}"
    )
    if cat_clean:
        prompt_used += f", categoria: {cat_clean}"
    if desc_clean:
        prompt_used += f", acabamento: {desc_clean[:60]}"
    prompt_used += ", acabamento impecavel, sem ruido."

    # Tenta usar o provider para obter geracao real caso suportado
    provider = get_ai_provider()
    if provider.client:
        try:
            from google.genai import types
            # Tentativa de geracao direta
            res = provider.client.models.generate_content(
                model="gemini-2.5-flash-image",
                contents=f"Generate a professional product photo: {prompt_used}"
            )
            if res.candidates and res.candidates[0].content and res.candidates[0].content.parts:
                for part in res.candidates[0].content.parts:
                    if getattr(part, 'inline_data', None):
                        import base64
                        b64_data = base64.b64encode(part.inline_data.data).decode('utf-8')
                        mime = part.inline_data.mime_type or "image/png"
                        return {
                            "image_url": f"data:{mime};base64,{b64_data}",
                            "prompt_used": prompt_used,
                            "source": "ai_generated",
                        }
        except Exception as ai_err:
            logger.info(f"[ProductImageAI] API generativa indisponivel ou cota zerada, aplicando acervo de estudio: {ai_err}")

    # Fallback contextual inteligente por nicho do produto
    search_text = f"{name_clean} {cat_clean} {desc_clean}"
    stock = resolve_images_for_prompt(search_text)
    prod_images = stock.get("products", [])

    if prod_images:
        # Selecao deterministica baseada no hash do nome do produto
        idx = abs(hash(name_clean)) % len(prod_images)
        chosen_img = prod_images[idx]
    else:
        chosen_img = "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&q=80"

    return {
        "image_url": chosen_img,
        "prompt_used": prompt_used,
        "source": "studio_stock",
    }

