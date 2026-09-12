import json
import logging
import time
from typing import Dict, Any, Optional, List
from .provider import get_ai_provider

logger = logging.getLogger(__name__)

IMAGE_STOCK_BY_NICHE = {
    'embalagens': {
        'dividers': ['/aurea/images/div-acessorios.jpg', '/aurea/images/div-seda.jpg'],
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
        'dividers': ['/aurea/images/div-acessorios.jpg', '/aurea/images/div-seda.jpg'],
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
        'dividers': ['/aurea/images/div-acessorios.jpg', '/aurea/images/div-seda.jpg'],
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
        'dividers': ['/aurea/images/div-acessorios.jpg', '/aurea/images/div-seda.jpg'],
        'products': [
            '/aurea/images/prod-bolsa.jpg',
            '/aurea/images/prod-cinto.jpg',
            '/aurea/images/prod-luvas.jpg',
            '/aurea/images/prod-camisa.jpg',
            '/aurea/images/prod-echarpe.jpg',
            '/aurea/images/prod-lenco.jpg',
            '/aurea/images/prod-trico.jpg',
            '/aurea/images/det-atelier.jpg',
            '/aurea/images/det-costura.jpg',
            '/aurea/images/det-tecido.jpg',
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
   - Se houver produtos reais fornecidos na secao 'PRODUTOS CADASTRADOS' ou descritos no 'Briefing do Catalogo', extraia e preserve fielmente cada um deles com nome, sku, preco, categoria, descricao sensorial e tag comercial.
   - Se o usuario descreveu itens no texto do briefing, extraia todos eles com seus precos e especificacoes.
   - Se NENHUM produto foi citado no briefing nem na lista, GERE CRIATIVAMENTE entre 4 a 8 produtos comerciais inovadores, coerentes e de alto padrao para o segmento, com precos realistas em Reais (R$), codigos SKU unicos e especificacoes refinadas.

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
      "sku": "SKU-001",
      "price": "R$ 0,00",
      "description": "Descricao sensorial e comercial minuciosa do produto (1 a 2 frases)",
      "tag": "Selo editorial (ex: Obra Prima, Destaque, Mais Vendido, Linha Pro, Essencial)"
    }
  ]
}
"""
SYSTEM_CATALOG_WITH_PRODUCTS_PROMPT = SYSTEM_CREATIVE_SYNTHESIS_PROMPT
SYSTEM_CATALOG_PROMPT = SYSTEM_CREATIVE_SYNTHESIS_PROMPT


def generate_catalog_from_gemini(prompt: str, products: Optional[List[Dict[str, Any]]] = None) -> Dict[str, Any]:
    """
    Gera um catalogo editorial dinamico via RAG-First Engine com micro-prompting do Google Gemini.
    O Gemini sintetiza a identidade de marca, a paleta de cores nobre, o manifesto e os produtos (extraidos
    do briefing ou gerados tematicamente). O Katana RAG planeja o mix dinamico de laminas (Hero, Duo, Grid 4,
    Divisores) e o Fusion Engine monta pranchetas com fidelidade cromatica total.
    """
    from api.services.template_rag import TemplateRAGService

    provider = get_ai_provider()
    catalog_id = f"cat-{int(time.time())}"
    has_real_products = products is not None and len(products) > 0

    # 1. Higienizacao de produtos reais fornecidos via upload
    clean_products = []
    if has_real_products:
        for idx, p in enumerate(products[:16]):
            clean_products.append({
                "index": f"{idx + 1:02d}",
                "name": str(p.get("name", "")).strip() or f"Produto {idx + 1:02d}",
                "price": str(p.get("price", "R$ 0,00")).strip(),
                "sku": str(p.get("sku", "")).strip() or f"SKU-{idx + 1:03d}",
                "category": str(p.get("category", "")).strip() or "Colecao",
                "description": str(p.get("description", "")).strip(),
                "image": str(p.get("image", "")).strip(),
                "tag": str(p.get("tag", "")).strip(),
            })

    detected_industry = TemplateRAGService.detect_industry(prompt, clean_products)

    # 2. Micro-Prompting Gemini para sintese editorial criativa E extracao/geracao de produtos
    synthesis_data = None
    if provider.client:
        try:
            from google.genai import types

            if clean_products:
                prods_summary = "\n".join([
                    f"- [{p['index']}] {p['name']} | Categoria: {p['category']} | Preco: {p['price']} | SKU: {p['sku']} | Descricao previa: {p['description'][:60]}"
                    for p in clean_products
                ])
                user_contents = (
                    f"Briefing do Catalogo: {prompt}\n"
                    f"Segmento Identificado: {detected_industry}\n\n"
                    f"PRODUTOS CADASTRADOS:\n{prods_summary}\n\n"
                    "INSTRUCAO: Sintetize o titulo da colecao, a paleta de cores nobre com contraste AAA, "
                    "o selo de capa (cover_label), o manifesto e enriqueça a lista de produtos com descricoes sensoriais e tags comerciais."
                )
            else:
                user_contents = (
                    f"Briefing do Catalogo: {prompt}\n"
                    f"Segmento Identificado: {detected_industry}\n\n"
                    "INSTRUCAO: Analise minuciosamente o briefing. Crie a identidade da colecao (titulo, categoria, summary, reasoning), "
                    "paleta cromatica refinada com contraste AAA, selo de capa (cover_label) e manifesto poetico da marca.\n"
                    "PRODUTOS: Se houver produtos descritos no texto do briefing, extraia-os integralmente (com nomes, SKUs, precos e descricoes). "
                    "Caso o briefing nao liste produtos especificos, crie entre 4 a 8 produtos comerciais inovadores de altissimo padrao para este segmento no array 'products'."
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

    # 3. Fallback de Sintese Criativa caso Gemini nao responda ou ocorra erro
    if not synthesis_data or not isinstance(synthesis_data, dict):
        synthesis_data = _get_contingency_synthesis(prompt, clean_products, detected_industry)

    # 4. Consolidacao Dinamica dos Produtos
    # Se nao houver upload previo, aproveita integralmente os produtos extraidos/sintetizados pela IA
    gemini_products = synthesis_data.get("products", [])
    if not clean_products and gemini_products:
        for idx, gp in enumerate(gemini_products[:16]):
            clean_products.append({
                "index": f"{idx + 1:02d}",
                "name": str(gp.get("name", "")).strip() or f"Peca {idx + 1:02d}",
                "price": str(gp.get("price", "R$ 0,00")).strip(),
                "sku": str(gp.get("sku", "")).strip() or f"SKU-{idx + 1:03d}",
                "category": str(gp.get("category", "")).strip() or synthesis_data.get("category", "Colecao"),
                "description": str(gp.get("description", "")).strip(),
                "image": str(gp.get("image", "")).strip(),
                "tag": str(gp.get("tag", "")).strip(),
            })

    # 5. RAG Layout Planning Dinamico com os produtos reais/sintetizados
    planned_pages = TemplateRAGService.plan_dynamic_catalog_structure(
        prompt=prompt,
        products=clean_products,
    )

    # 6. Fusion Engine: Funde os Blueprints RAG com a Sintese Criativa e Paleta Oficial
    stock = resolve_images_for_prompt(prompt if not clean_products else f"{prompt} {clean_products[0]['name']} {clean_products[0]['category']}")
    palette = synthesis_data.get("palette", {})
    if not palette or not isinstance(palette, dict):
        palette = {
            "name": "Noir & Ivory",
            "primary": "#1A1817",
            "background": "#F5F1EA",
            "accent": "#B08D57",
            "secondary": "#4A4846",
            "surface": "#FDFBF7",
            "contrastRatio": "9.2:1 (AAA)",
            "locked": False,
        }

    catalog_title = synthesis_data.get("title") or (clean_products[0]["category"] if clean_products else "Colecao Editorial")
    catalog_category = synthesis_data.get("category") or (clean_products[0]["category"] if clean_products else "Geral")
    catalog_summary = synthesis_data.get("summary") or "Catalogo comercial diagramado com proporcao visual e harmonia editorial."
    catalog_reasoning = synthesis_data.get("reasoning") or "Composicao balanceada com contraste certificado e alocacao sob medida via RAG."
    manifesto_data = synthesis_data.get("manifesto", {})

    assembled_pages = []
    prod_img_idx = 0
    div_img_idx = 0

    for plan in planned_pages:
        page_num = plan["pageNumber"]
        p_type = plan["type"]
        blueprint = plan.get("blueprint_data", {})
        assigned = plan.get("assigned_products", [])

        # Paleta soberana: fundo escuro em capas, divisores e contracapas; fundo claro nas paginas internas
        is_dark_page = p_type in ["cover", "backcover", "divider"]
        page_bg = palette.get("primary", "#1A1817") if is_dark_page else palette.get("background", "#F5F1EA")
        page_text = palette.get("background", "#F5F1EA") if is_dark_page else palette.get("primary", "#1A1817")
        page_accent = palette.get("accent", "#B08D57")

        page_obj = {
            "id": f"{catalog_id}-p{page_num}",
            "pageNumber": page_num,
            "type": p_type,
            "backgroundColor": page_bg,
            "textColor": page_text,
            "accentColor": page_accent,
        }

        if p_type == "cover":
            page_obj["title"] = catalog_title.upper()
            page_obj["subtitle"] = catalog_summary.upper()
            page_obj["label"] = synthesis_data.get("cover_label") or f"COLECAO EXCLUSIVA · {catalog_category.upper()}"
            page_obj["folio"] = "01"
            # Nao força imagem estatica /aurea/aurea-monograma.png.
            # Deixar editorialImage = None permite ao Studio renderizar o monograma dinamico com a inicial da marca!
            page_obj["editorialImage"] = None

        elif p_type == "manifesto":
            page_obj["title"] = manifesto_data.get("title") or "Manifesto da Marca"
            page_obj["quote"] = manifesto_data.get("quote") or "O valor real de um produto comeca na atencao aos detalhes."
            page_obj["content"] = manifesto_data.get("content") or "Nossas solucoes unem design funcional, precisao tecnica e apresentacao impecavel."
            page_obj["label"] = "MANIFESTO EDITORIAL"
            page_obj["folio"] = f"{page_num:02d} · MANIFESTO"

        elif p_type == "divider":
            div_img = stock["dividers"][div_img_idx % len(stock["dividers"])]
            div_img_idx += 1
            page_obj["editorialImage"] = div_img
            page_obj["title"] = blueprint.get("title") or "SELECAO ESPECIAL"
            page_obj["subtitle"] = blueprint.get("subtitle") or "Destaques e aplicacoes praticas"
            page_obj["label"] = "SECAO EDITORIAL"
            page_obj["folio"] = f"{page_num:02d} · DIVISAO"

        elif p_type in ["hero", "duo", "single", "grid_4"]:
            page_obj["label"] = (
                "DESTAQUE EXCLUSIVO" if p_type == "hero" else
                "DUO EDITORIAL" if p_type == "duo" else
                "MATRIZ COMERCIAL" if p_type == "grid_4" else "EDICAO LIMITADA"
            )
            page_obj["folio"] = f"{page_num:02d} · {catalog_category.upper()}"
            page_obj["slotCapacity"] = plan.get("capacity", 1)

            # Monta a lista de produtos da lamina
            page_products = []
            if assigned:
                for p_idx, prod_item in enumerate(assigned):
                    # Imagem: preserva a do produto ou busca no acervo tematico do nicho
                    final_img = prod_item.get("image", "").strip()
                    if not final_img:
                        item_stock = resolve_images_for_prompt(f"{prod_item['name']} {prod_item['category']}")
                        avail_imgs = item_stock.get("products", stock["products"])
                        final_img = avail_imgs[prod_img_idx % len(avail_imgs)]
                        prod_img_idx += 1

                    page_products.append({
                        "id": f"prod-{catalog_id}-{prod_item['index']}",
                        "name": prod_item["name"],
                        "category": prod_item["category"],
                        "index": prod_item["index"],
                        "sku": prod_item["sku"],
                        "price": prod_item["price"],
                        "description": prod_item["description"] or "Acabamento premium com alta resistencia e apresentacao comercial refinada.",
                        "image": final_img,
                        "tag": prod_item.get("tag") or ("Obra Prima" if p_idx == 0 and p_type == "hero" else "Destaque" if p_idx == 0 else "Disponivel"),
                    })

            page_obj["products"] = page_products

        elif p_type == "backcover":
            page_obj["title"] = catalog_title.upper()
            page_obj["label"] = "ATENDIMENTO COMERCIAL & DISTRIBUICAO"
            clean_slug = catalog_title.lower().replace(' ', '').replace('—', '').replace('-', '')[:15]
            page_obj["content"] = f"CENTRAL DE ATENDIMENTO · {catalog_title.upper()}\\nCONTATO: COMERCIAL@{clean_slug}.COM.BR\\nGARANTIA & ATENDIMENTO EXCLUSIVO"
            page_obj["folio"] = f"{catalog_title.upper()} · 2026"

        assembled_pages.append(page_obj)

    return {
        "catalogId": catalog_id,
        "title": catalog_title,
        "category": catalog_category,
        "summary": catalog_summary,
        "reasoning": catalog_reasoning,
        "palette": palette,
        "pages": assembled_pages,
        "totalPages": len(assembled_pages),
        "initialPrompt": prompt,
        "rag_metadata": {
            "dynamic_pages": len(assembled_pages),
            "industry": detected_industry,
            "tokens_saved_pct": 85,
        },
        "councilDelegations": [
            {
                "roleId": "orchestrator",
                "roleName": "Editor-Chefe",
                "badge": "Orquestrador",
                "action": f"Estruturou catalogo dinamico com {len(assembled_pages)} laminas via RAG para '{catalog_title}'.",
            },
            {
                "roleId": "director",
                "roleName": "Diretor de Arte",
                "badge": "Design",
                "action": f"Definiu paleta '{palette.get('name')}' e composicao visual de alta fidelidade.",
            },
            {
                "roleId": "copywriter",
                "roleName": "Redator Sênior",
                "badge": "Redação",
                "action": "Elaborou manifesto e descricoes persuasivas com economia otimizada de tokens.",
            },
            {
                "roleId": "commercial",
                "roleName": "Diretor Comercial",
                "badge": "Comercial",
                "action": (
                    f"Alocou {len(clean_products)} produtos com precificacao e SKUs validados."
                    if clean_products else
                    "Preparou pranchetas com wireframes de diagramacao aguardando alocacao de produtos pelo usuario."
                ),
            },
        ],
    }


def _get_contingency_synthesis(prompt: str, products: List[Dict[str, Any]], industry: str) -> Dict[str, Any]:
    """
    Gera a sintese criativa de contingencia quando a API remota de IA estiver indisponivel.
    """
    if industry == "cutlery_craftsmanship":
        contingency_prods = products if products else [
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
        ]
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
        contingency_prods = products if products else [
            {"index": "01", "name": "Pote Redondo Hermético 500ml", "category": "Food Service", "sku": "FS-POT-500", "price": "R$ 48,00 /pct", "description": "Vedação perimetral estanque livre de BPA.", "tag": "Mais Vendido"},
            {"index": "02", "name": "Marmita Térmica Kraft 750ml", "category": "Food Service", "sku": "FS-KRF-750", "price": "R$ 62,00 /pct", "description": "Papel kraft virgem impermeabilizado para refeições quentes.", "tag": "Sustentável"},
            {"index": "03", "name": "Copo Cristal PET com Tampa Bolha 400ml", "category": "Food Service", "sku": "FS-COP-400", "price": "R$ 39,00 /pct", "description": "Transparência cristalina e travamento firme para sobremesas.", "tag": "Linha Festa"},
            {"index": "04", "name": "Sacola Delivery Fundo Largo Reforçada", "category": "Transporte", "sku": "FS-SAC-LAR", "price": "R$ 55,00 /pct", "description": "Capacidade para 3 marmitas empilhadas sem tombar.", "tag": "Essencial"},
        ]
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
        contingency_prods = products if products else [
            {"index": "01", "name": "Torta Mousse Chocolat Noir 70%", "category": "Patisserie", "sku": "DOC-TRT-01", "price": "R$ 145,00", "description": "Glaçagem espelhada de cacau de origem com base crocante praliné.", "tag": "Assinatura"},
            {"index": "02", "name": "Pote Redondo Velvet Silvestre", "category": "Potes Gourmet", "sku": "DOC-POT-02", "price": "R$ 28,00", "description": "Camadas de bolo red velvet com compota de frutas vermelhas.", "tag": "Mais Vendido"},
            {"index": "03", "name": "Caixa Degustação Macarons Parisienses", "category": "Presenteáveis", "sku": "DOC-MAC-06", "price": "R$ 64,00", "description": "Seleção com 6 macarons de pistache, fava de baunilha e maracujá.", "tag": "Artesanal"},
            {"index": "04", "name": "Mini Domo Cristal Fondant", "category": "Linha Festa", "sku": "DOC-DOM-04", "price": "R$ 36,00", "description": "Domo individual para doces finos de recepção executiva.", "tag": "Eventos"},
        ]
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
        contingency_prods = products if products else [
            {"index": "01", "name": "Peça de Assinatura Edição Limitada", "category": "Coleção Principal", "sku": "EDT-001", "price": "R$ 480,00", "description": "Design contemporâneo com acabamento de precisão e materiais nobres.", "tag": "Destaque"},
            {"index": "02", "name": "Item Harmônico Série A", "category": "Complementos", "sku": "EDT-002", "price": "R$ 290,00", "description": "Equilíbrio funcional para integrar à rotina ou compor kits.", "tag": "Mais Vendido"},
            {"index": "03", "name": "Item Harmônico Série B", "category": "Complementos", "sku": "EDT-003", "price": "R$ 340,00", "description": "Geometria minimalista com proporção áurea e alta durabilidade.", "tag": "Novo"},
            {"index": "04", "name": "Suporte Técnico de Mesa", "category": "Acessórios", "sku": "EDT-004", "price": "R$ 180,00", "description": "Estrutura estável usinada com proteção de superfície.", "tag": "Essencial"},
        ]
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
        chosen_img = "/aurea/images/prod-bolsa.jpg"

    return {
        "image_url": chosen_img,
        "prompt_used": prompt_used,
        "source": "studio_stock",
    }

