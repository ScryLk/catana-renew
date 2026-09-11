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

SYSTEM_CATALOG_PROMPT = """
Voce e o Diretor Criativo e Editor-Chefe do Katana Studio, a plataforma mais avancada de design editorial de luxo.
Sua missao e gerar um catalogo editorial completo, 100% original e personalizado com base no briefing do usuario.
Crie nomes de produtos originais, precos realistas em Reais (R$), descricoes ricas e um manifesto editorial emocionante.
Retorne EXCLUSIVAMENTE um objeto JSON valido (sem tags markdown, apenas o JSON puro) com a seguinte estrutura:

{
  "title": "Nome da Marca ou Colecao",
  "category": "Segmento / Ramo de Atuacao",
  "summary": "Resumo sintético da visao editorial da colecao em uma frase",
  "reasoning": "Racional do conselho editorial explicando a escolha tipografica e cromatica",
  "palette": {
    "name": "Nome da Paleta Criada",
    "primary": "#HEX (cor escura de texto/capa)",
    "background": "#HEX (cor de fundo das paginas)",
    "accent": "#HEX (cor de destaque/ouro/detalhes)",
    "secondary": "#HEX (cor de apoio neutra)",
    "contrastRatio": "9.4:1"
  },
  "pages": [
    {
      "pageNumber": 1,
      "type": "cover",
      "title": "NOME DA MARCA",
      "subtitle": "SUBTITULO EDITORIAL DA COLECAO",
      "label": "ROTULO DE CAPA",
      "backgroundColor": "#HEX",
      "textColor": "#HEX",
      "accentColor": "#HEX"
    },
    {
      "pageNumber": 2,
      "type": "manifesto",
      "label": "MANIFESTO",
      "quote": "Citacao filosofica ou declaracao de intencao em destaque",
      "content": "Texto completo do manifesto editorial em prosa elegante (1 a 2 paragrafos).",
      "folio": "02 · MANIFESTO",
      "backgroundColor": "#HEX",
      "textColor": "#HEX",
      "accentColor": "#HEX"
    },
    {
      "pageNumber": 3,
      "type": "divider",
      "label": "CAPITULO I",
      "title": "TITULO DA SESSAO",
      "subtitle": "Subtitulo explicativo da sessao",
      "backgroundColor": "#HEX",
      "textColor": "#HEX",
      "accentColor": "#HEX"
    },
    {
      "pageNumber": 4,
      "type": "hero",
      "label": "DESTAQUE EXCLUSIVO",
      "folio": "04 · SELECAO",
      "backgroundColor": "#HEX",
      "textColor": "#HEX",
      "accentColor": "#HEX",
      "products": [
        {
          "name": "Nome do Produto Principal",
          "category": "Categoria da Linha",
          "index": "01",
          "sku": "ART-001",
          "price": "R$ 1.850",
          "description": "Descricao sensorial minuciosa da peca e acabamento.",
          "tag": "Destaque da Colecao"
        }
      ]
    },
    {
      "pageNumber": 5,
      "type": "duo",
      "label": "DUO EDITORIAL",
      "folio": "05 · LOOKBOOK",
      "mirrored": false,
      "backgroundColor": "#HEX",
      "textColor": "#HEX",
      "accentColor": "#HEX",
      "products": [
        {
          "name": "Primeiro Item Duo",
          "category": "Categoria da Linha",
          "index": "02",
          "sku": "ART-002",
          "price": "R$ 980",
          "description": "Descricao detalhada do produto."
        },
        {
          "name": "Segundo Item Duo",
          "category": "Categoria da Linha",
          "index": "03",
          "sku": "ART-003",
          "price": "R$ 740",
          "description": "Descricao detalhada do produto."
        }
      ]
    },
    {
      "pageNumber": 6,
      "type": "single",
      "label": "EDICAO LIMITADA",
      "folio": "06 · FECHAMENTO",
      "backgroundColor": "#HEX",
      "textColor": "#HEX",
      "accentColor": "#HEX",
      "products": [
        {
          "name": "Item Especial Fechamento",
          "category": "Categoria da Linha",
          "index": "04",
          "sku": "ART-004",
          "price": "R$ 2.400",
          "description": "Descricao do item nobre de fechamento.",
          "tag": "Serie Limitada"
        }
      ]
    },
    {
      "pageNumber": 7,
      "type": "divider",
      "label": "CAPITULO II",
      "title": "SELECAO COMPLEMENTAR",
      "subtitle": "Peças adicionais e cuidados com os materiais",
      "backgroundColor": "#HEX",
      "textColor": "#HEX",
      "accentColor": "#HEX"
    },
    {
      "pageNumber": 8,
      "type": "backcover",
      "label": "ATELIER & ENCOMENDAS",
      "content": "ATELIER CENTRAL · SAO PAULO\\nATENDIMENTO EXECUTIVO · +55 11 3000 0000\\nWWW.KATANASTUDIO.COM.BR",
      "folio": "KATANA STUDIO · 2026",
      "backgroundColor": "#HEX",
      "textColor": "#HEX",
      "accentColor": "#HEX"
    }
  ]
}
"""

SYSTEM_CATALOG_WITH_PRODUCTS_PROMPT = """
Voce e o Diretor Criativo e Editor-Chefe do Katana Studio, a mais prestigiosa plataforma de design editorial comercial.
Sua missao e estruturar e diagramar um catalogo editorial completo utilizando OBRIGATORIAMENTE os produtos reais fornecidos pelo usuario.

DIRETRIZES FUNDAMENTAIS:
1. INVESTIGACAO DE UTILIDADE REAL DO PRODUTO:
   - Para cada produto recebido na lista, deduza o que ele realmente e, sua finalidade pratica no mundo real, onde e como e utilizado, e quais os beneficios comerciais tangiveis que ele oferece para o comprador.
   - Se os produtos forem embalagens para alimentos / descartaveis / food service, destaque a seguranca no transporte, protecao contra vazamentos, fechamento confiavel, transparencia que valoriza o conteudo e adequacao para delivery e vitrines.
   - Se forem produtos de confeitaria, gastronomia, acougue ou qualquer outro segmento, ressalte atributos sensoriais, qualidade dos materiais e experiencia do cliente.
2. FIDELIDADE AOS DADOS FORNECIDOS:
   - Mantenha com total exatidao o nome do produto (ou uma versao lapidada e nobre dele), seu preco de venda em Reais (R$) e seu codigo SKU.
   - Jamais substitua esses produtos por outros que nao constam na lista (por exemplo, nunca troque embalagens por cafe ou joias).
   - Mantenha o campo 'image' de cada produto inalterado caso ele tenha sido fornecido.
3. COPYWRITING COMERCIAL E SENSORIAL:
   - Escreva descricoes comerciais sofisticadas e precisas (1 a 2 frases) para cada produto, valorizando a utilidade descoberta e os diferenciais tecnicos.
4. ESTRUTURA EDITORIAL COMPLETA (8 PAGINAS):
   - Pagina 1: Capa (cover) com Titulo marcante e Subtitulo da Colecao representativo da linha real de produtos.
   - Pagina 2: Manifesto institucional que celebre a filosofia dessa linha de produtos.
   - Pagina 3: Divisoria de secao (divider) introduzindo a selecao principal.
   - Pagina 4: Hero (destaque para o produto principal da lista).
   - Pagina 5: Duo (dois produtos da lista dispostos lado a lado de forma harmoniosa).
   - Pagina 6: Single ou Duo (com os proximos produtos da lista).
   - Pagina 7: Divisoria de secao (divider) ou pagina institucional.
   - Pagina 8: Contracapa (backcover) com contatos institucionais.
5. PALETA CROMATICA HARMONICA:
   - Crie uma paleta cromatica exclusiva que valorize o segmento dos produtos reais informados.

Retorne EXCLUSIVAMENTE um objeto JSON valido (sem tags markdown, apenas o JSON puro) seguindo a estrutura padrao com 'title', 'category', 'summary', 'reasoning', 'palette' e 'pages'.
"""

def generate_catalog_from_gemini(prompt: str, products: Optional[List[Dict[str, Any]]] = None) -> Dict[str, Any]:
    provider = get_ai_provider()
    catalog_id = f"cat-{int(time.time())}"
    has_real_products = products is not None and len(products) > 0

    if provider.client:
        try:
            from google.genai import types

            if has_real_products:
                system_instruction = SYSTEM_CATALOG_WITH_PRODUCTS_PROMPT
                clean_products_list = []
                for idx, p in enumerate(products[:12]):
                    clean_products_list.append({
                        "index": f"{idx + 1:02d}",
                        "name": p.get("name", "").strip(),
                        "price": p.get("price", "R$ 0,00").strip(),
                        "sku": p.get("sku", "").strip() or f"SKU-{idx + 1:03d}",
                        "category": p.get("category", "").strip(),
                        "description": p.get("description", "").strip(),
                        "image": p.get("image", "").strip(),
                        "tag": p.get("tag", "").strip(),
                    })

                products_json = json.dumps(clean_products_list, ensure_ascii=False, indent=2)
                user_contents = (
                    f"Briefing / Contexto: {prompt}\n\n"
                    f"PRODUTOS REAIS FORNECIDOS PARA O CATÁLOGO:\n{products_json}\n\n"
                    "INSTRUCAO: Analise cada um desses produtos, investigue sua real utilidade e funcao pratica, "
                    "e estruture o catalogo alocando-os com fidelidade nas paginas Hero, Duo e Single."
                )
            else:
                system_instruction = SYSTEM_CATALOG_PROMPT
                user_contents = prompt

            config = types.GenerateContentConfig(
                system_instruction=system_instruction,
                temperature=0.6,
                response_mime_type="application/json",
            )
            response = provider.client.models.generate_content(
                model=provider.default_model,
                contents=user_contents,
                config=config,
            )
            raw_text = response.text.strip()
            if raw_text.startswith("```json"):
                raw_text = raw_text[7:]
            if raw_text.startswith("```"):
                raw_text = raw_text[3:]
            if raw_text.endswith("```"):
                raw_text = raw_text[:-3]

            data = json.loads(raw_text.strip())
            if isinstance(data, list):
                data = {
                    "pages": data,
                    "title": f"Coleção {products[0].get('category', 'Editorial') if has_real_products else 'Editorial'}",
                    "category": products[0].get('category', 'Geral') if has_real_products else "Geral",
                    "summary": "Catálogo editorial estruturado pelo Google Gemini com análise semântica de produtos.",
                    "reasoning": "Harmonia entre identidade de produto, utilidade e tipografia refinada.",
                    "palette": {}
                }

            stock = resolve_images_for_prompt(prompt if not has_real_products else f"{prompt} {products[0].get('name', '')} {products[0].get('category', '')}")

            pages = data.get("pages", [])
            prod_img_idx = 0
            div_img_idx = 0

            # Indexacao dos produtos reais originais para casamento estrito de dados
            user_prods_by_name = {}
            if has_real_products:
                for p in products:
                    name_key = p.get("name", "").strip().lower()
                    if name_key:
                        user_prods_by_name[name_key] = p

            for p_idx, page in enumerate(pages):
                if "page_number" in page and "pageNumber" not in page:
                    page["pageNumber"] = page["page_number"]

                if "product" in page and isinstance(page["product"], dict):
                    if "products" not in page or not page["products"]:
                        page["products"] = [page["product"]]

                page["id"] = f"{catalog_id}-p{page.get('pageNumber', p_idx + 1)}"

                if page.get("type") == "divider":
                    div_img = stock["dividers"][div_img_idx % len(stock["dividers"])]
                    page["editorialImage"] = div_img
                    div_img_idx += 1

                if "products" in page and page["products"]:
                    for prod in page["products"]:
                        prod["id"] = f"prod-{catalog_id}-{prod.get('index', p_idx)}"

                        # Se tiver produto correspondente na lista do usuario, assegura fidelidade
                        matched_user_prod = None
                        prod_name_lower = prod.get("name", "").strip().lower()
                        for k, v in user_prods_by_name.items():
                            if k in prod_name_lower or prod_name_lower in k:
                                matched_user_prod = v
                                break

                        if matched_user_prod:
                            if matched_user_prod.get("image") and matched_user_prod["image"].strip():
                                prod["image"] = matched_user_prod["image"].strip()
                            if matched_user_prod.get("price"):
                                prod["price"] = matched_user_prod["price"]
                            if matched_user_prod.get("sku"):
                                prod["sku"] = matched_user_prod["sku"]

                        # Se ainda nao tiver imagem, resolve por nicho especifico do produto
                        if not prod.get("image") or prod.get("image") == "":
                            item_stock = resolve_images_for_prompt(f"{prod.get('name', '')} {prod.get('category', '')}")
                            item_products = item_stock.get("products", stock["products"])
                            prod["image"] = item_products[prod_img_idx % len(item_products)]
                            prod_img_idx += 1

            raw_palette = data.get("palette", {})
            palette = {
                "name": raw_palette.get("name", "Editorial Noir"),
                "primary": raw_palette.get("primary", "#1A1817"),
                "background": raw_palette.get("background", "#F5F1EA"),
                "accent": raw_palette.get("accent", "#B08D57"),
                "secondary": raw_palette.get("secondary", "#4A4846"),
                "surface": raw_palette.get("surface", "#FDFBF7"),
                "contrastRatio": raw_palette.get("contrastRatio", "9.2:1 (AAA)"),
                "locked": False,
            }

            return {
                "catalogId": catalog_id,
                "title": data.get("title", "Coleção Editorial"),
                "category": data.get("category", "Geral"),
                "summary": data.get("summary", "Catálogo editorial estruturado pelo Google Gemini com análise semântica de produtos."),
                "reasoning": data.get("reasoning", "Harmonia entre identidade de produto, utilidade e tipografia refinada."),
                "palette": palette,
                "pages": pages,
                "totalPages": len(pages),
                "initialPrompt": prompt,
                "councilDelegations": [
                    {
                        "roleId": "orchestrator",
                        "roleName": "Editor-Chefe",
                        "badge": "Orquestrador",
                        "action": f"Unificou os dados de '{data.get('title')}' com foco na utilidade comercial dos itens.",
                    },
                    {
                        "roleId": "director",
                        "roleName": "Diretor de Arte",
                        "badge": "Design",
                        "action": f"Definiu paleta '{palette.get('name')}' com contraste certificado WCAG AAA.",
                    },
                    {
                        "roleId": "copywriter",
                        "roleName": "Redator Sênior",
                        "badge": "Redação",
                        "action": "Investigou utilidade e elaborou descrições técnicas e sensoriais coerentes.",
                    },
                    {
                        "roleId": "commercial",
                        "roleName": "Diretor Comercial",
                        "badge": "Comercial",
                        "action": "Preservou precificação exata da planilha e organizou hierarquia de valor.",
                    },
                ],
            }
        except Exception as e:
            logger.error(f"Erro ao gerar catalogo com Gemini: {e}")

    # Fallback estruturado caso a API nao responda
    stock = resolve_images_for_prompt(prompt if not has_real_products else f"{prompt} {products[0].get('name', '')}")
    fallback_palette = {
        "name": "Noir & Ivory",
        "primary": "#1A1817",
        "background": "#F5F1EA",
        "accent": "#B08D57",
        "secondary": "#4A4846",
        "surface": "#FDFBF7",
        "contrastRatio": "9.2:1 (AAA)",
        "locked": False,
    }

    fallback_pages = []
    if has_real_products:
        p1 = products[0]
        p2 = products[1] if len(products) > 1 else products[0]
        p3 = products[2] if len(products) > 2 else products[0]
        p4 = products[3] if len(products) > 3 else products[0]

        fallback_pages = [
            {
                "id": f"{catalog_id}-p1",
                "pageNumber": 1,
                "type": "cover",
                "title": p1.get("category", "COLEÇÃO EXCLUSIVA").upper(),
                "subtitle": "CATÁLOGO TÉCNICO & COMERCIAL 2026",
                "label": "LINHA PROFISSIONAL",
                "backgroundColor": fallback_palette["primary"],
                "textColor": fallback_palette["background"],
                "accentColor": fallback_palette["accent"],
            },
            {
                "id": f"{catalog_id}-p2",
                "pageNumber": 2,
                "type": "manifesto",
                "label": "MANIFESTO",
                "quote": "Soluções projetadas para máxima eficiência, conservação e apresentação impecável.",
                "content": "Nossa linha foi desenvolvida para atender aos mais rigorosos padrões de exigência do mercado. Cada item combina resistência estrutural com acabamento cristalino, agregando valor real ao produto final e confiabilidade absoluta na operação diária.",
                "folio": "02 · MANIFESTO",
                "backgroundColor": fallback_palette["background"],
                "textColor": fallback_palette["primary"],
                "accentColor": fallback_palette["accent"],
            },
            {
                "id": f"{catalog_id}-p3",
                "pageNumber": 3,
                "type": "divider",
                "label": "CAPÍTULO I",
                "title": "SELEÇÃO PRINCIPAL",
                "subtitle": "Itens essenciais com alto desempenho comercial",
                "editorialImage": stock["dividers"][0],
                "backgroundColor": fallback_palette["background"],
                "textColor": fallback_palette["primary"],
                "accentColor": fallback_palette["accent"],
            },
            {
                "id": f"{catalog_id}-p4",
                "pageNumber": 4,
                "type": "hero",
                "label": "DESTAQUE DA LINHA",
                "folio": "04 · PRODUTO HERO",
                "backgroundColor": fallback_palette["background"],
                "textColor": fallback_palette["primary"],
                "accentColor": fallback_palette["accent"],
                "products": [
                    {
                        "id": f"prod-{catalog_id}-01",
                        "name": p1.get("name", "Produto Principal"),
                        "category": p1.get("category", "Linha"),
                        "index": "01",
                        "sku": p1.get("sku", "SKU-001"),
                        "price": p1.get("price", "R$ 0,00"),
                        "description": p1.get("description") or "Item indispensável com excelente acabamento e alta praticidade operacional.",
                        "image": p1.get("image") or stock["products"][0],
                        "tag": p1.get("tag") or "Mais Vendido",
                    }
                ],
            },
            {
                "id": f"{catalog_id}-p5",
                "pageNumber": 5,
                "type": "duo",
                "label": "DUO COMERCIAL",
                "folio": "05 · LOOKBOOK",
                "mirrored": False,
                "backgroundColor": fallback_palette["background"],
                "textColor": fallback_palette["primary"],
                "accentColor": fallback_palette["accent"],
                "products": [
                    {
                        "id": f"prod-{catalog_id}-02",
                        "name": p2.get("name", "Segundo Item"),
                        "category": p2.get("category", "Linha"),
                        "index": "02",
                        "sku": p2.get("sku", "SKU-002"),
                        "price": p2.get("price", "R$ 0,00"),
                        "description": p2.get("description") or "Desenhado para acomodação segura e apresentação destacada.",
                        "image": p2.get("image") or (stock["products"][1] if len(stock["products"]) > 1 else stock["products"][0]),
                    },
                    {
                        "id": f"prod-{catalog_id}-03",
                        "name": p3.get("name", "Terceiro Item"),
                        "category": p3.get("category", "Linha"),
                        "index": "03",
                        "sku": p3.get("sku", "SKU-003"),
                        "price": p3.get("price", "R$ 0,00"),
                        "description": p3.get("description") or "Formato versátil e fechamento hermético de alta durabilidade.",
                        "image": p3.get("image") or (stock["products"][2] if len(stock["products"]) > 2 else stock["products"][0]),
                    },
                ],
            },
            {
                "id": f"{catalog_id}-p6",
                "pageNumber": 6,
                "type": "single",
                "label": "APLICAÇÃO ESPECIAL",
                "folio": "06 · FECHAMENTO",
                "backgroundColor": fallback_palette["background"],
                "textColor": fallback_palette["primary"],
                "accentColor": fallback_palette["accent"],
                "products": [
                    {
                        "id": f"prod-{catalog_id}-04",
                        "name": p4.get("name", "Quarto Item"),
                        "category": p4.get("category", "Linha"),
                        "index": "04",
                        "sku": p4.get("sku", "SKU-004"),
                        "price": p4.get("price", "R$ 0,00"),
                        "description": p4.get("description") or "Construção reforçada garantindo proteção total no manuseio diário.",
                        "image": p4.get("image") or (stock["products"][3] if len(stock["products"]) > 3 else stock["products"][0]),
                        "tag": p4.get("tag") or "Recomendado",
                    }
                ],
            },
            {
                "id": f"{catalog_id}-p7",
                "pageNumber": 7,
                "type": "divider",
                "label": "CAPÍTULO II",
                "title": "GARANTIA & QUALIDADE",
                "subtitle": "Conformidade e segurança técnica garantida",
                "editorialImage": stock["dividers"][1] if len(stock["dividers"]) > 1 else stock["dividers"][0],
                "backgroundColor": fallback_palette["background"],
                "textColor": fallback_palette["primary"],
                "accentColor": fallback_palette["accent"],
            },
            {
                "id": f"{catalog_id}-p8",
                "pageNumber": 8,
                "type": "backcover",
                "label": "ATENDIMENTO & PEDIDOS",
                "content": "CENTRAL DE DISTRIBUIÇÃO · SÃO PAULO\\nATENDIMENTO COMERCIAL · +55 11 3000 0000\\nWWW.KATANASTUDIO.COM.BR",
                "folio": "KATANA STUDIO · 2026",
                "backgroundColor": fallback_palette["primary"],
                "textColor": fallback_palette["background"],
                "accentColor": fallback_palette["accent"],
            },
        ]

    return {
        "catalogId": catalog_id,
        "title": f"Coleção {products[0].get('category', prompt[:30])}" if has_real_products else f"Coleção {prompt[:30]}",
        "category": products[0].get("category", "Editorial") if has_real_products else "Editorial",
        "summary": "Catálogo estruturado com produtos reais cadastrados no estúdio.",
        "reasoning": "Composição clássica balanceada com foco na utilidade comercial.",
        "palette": fallback_palette,
        "pages": fallback_pages,
        "totalPages": len(fallback_pages),
        "initialPrompt": prompt,
        "councilDelegations": [],
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

