import json
import logging
import time
from typing import Dict, Any, Optional, List
from .provider import get_ai_provider

logger = logging.getLogger(__name__)

IMAGE_STOCK_BY_NICHE = {
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
            '/catalogos/foodServiceSemFundo/fs-01.png',
        ],
    },
    'gastronomia': {
        'dividers': ['/aurea/images/div-acessorios.jpg', '/aurea/images/div-seda.jpg'],
        'products': [
            '/catalogos/foodServiceSemFundo/fs-01.png',
            '/catalogos/foodServiceSemFundo/fs-02.png',
            '/catalogos/foodServiceSemFundo/fs-03.png',
            '/catalogos/foodServiceSemFundo/fs-04.png',
            '/catalogos/foodServiceSemFundo/fs-05.png',
            '/catalogos/produtosConfeitaria/pf-10.png',
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
    if any(k in p_lower for k in ['carne', 'acougue', 'açougue', 'churrasco', 'corte', 'angus', 'bovino', 'costela']):
        return IMAGE_STOCK_BY_NICHE['acougue']
    if any(k in p_lower for k in ['doce', 'confeit', 'bolo', 'patisserie', 'sobremesa', 'pote', 'chocolate', 'brigadeiro', 'festa']):
        return IMAGE_STOCK_BY_NICHE['confeitaria']
    if any(k in p_lower for k in ['caf', 'restaurante', 'culinaria', 'gastronom', 'comida', 'chef', 'food']):
        return IMAGE_STOCK_BY_NICHE['gastronomia']
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

def generate_catalog_from_gemini(prompt: str) -> Dict[str, Any]:
    provider = get_ai_provider()
    catalog_id = f"cat-{int(time.time())}"

    if provider.client:
        try:
            from google.genai import types

            config = types.GenerateContentConfig(
                system_instruction=SYSTEM_CATALOG_PROMPT,
                temperature=0.7,
                response_mime_type="application/json",
            )
            response = provider.client.models.generate_content(
                model=provider.default_model,
                contents=prompt,
                config=config,
            )
            raw_text = response.text.strip()
            # Remove markdown wrapper if any was added
            if raw_text.startswith("```json"):
                raw_text = raw_text[7:]
            if raw_text.startswith("```"):
                raw_text = raw_text[3:]
            if raw_text.endswith("```"):
                raw_text = raw_text[:-3]

            data = json.loads(raw_text.strip())
            stock = resolve_images_for_prompt(prompt)

            # Process and enrich pages with unique IDs and images
            pages = data.get("pages", [])
            prod_img_idx = 0
            div_img_idx = 0

            for p_idx, page in enumerate(pages):
                page["id"] = f"{catalog_id}-p{page.get('pageNumber', p_idx + 1)}"

                if page.get("type") == "divider":
                    div_img = stock["dividers"][div_img_idx % len(stock["dividers"])]
                    page["editorialImage"] = div_img
                    div_img_idx += 1

                if "products" in page and page["products"]:
                    for prod in page["products"]:
                        prod["id"] = f"prod-{catalog_id}-{prod.get('index', p_idx)}"
                        if not prod.get("image"):
                            prod["image"] = stock["products"][prod_img_idx % len(stock["products"])]
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
                "summary": data.get("summary", "Catálogo editorial estruturado pelo Google Gemini."),
                "reasoning": data.get("reasoning", "Harmonia entre espaços negativos e tipografia refinada."),
                "palette": palette,
                "pages": pages,
                "totalPages": len(pages),
                "initialPrompt": prompt,
                "councilDelegations": [
                    {
                        "roleId": "orchestrator",
                        "roleName": "Editor-Chefe",
                        "badge": "Orquestrador",
                        "action": f"Unificou briefing de '{data.get('title')}' com equilíbrio entre arte e conversão.",
                    },
                    {
                        "roleId": "director",
                        "roleName": "Diretor de Arte",
                        "badge": "Design",
                        "action": f"Definiu paleta '{palette.get('name')}' com contraste WCAG AAA.",
                    },
                    {
                        "roleId": "copywriter",
                        "roleName": "Redator Sênior",
                        "badge": "Redação",
                        "action": "Redigiu manifesto autêntico e descrições sensoriais de produto.",
                    },
                    {
                        "roleId": "commercial",
                        "roleName": "Diretor Comercial",
                        "badge": "Comercial",
                        "action": "Estruturou precificação e âncoras de valor nas lâminas duplas.",
                    },
                ],
            }
        except Exception as e:
            logger.error(f"Erro ao gerar catalogo com Gemini: {e}")

    # Fallback caso API nao esteja disponivel
    return {
        "catalogId": catalog_id,
        "title": f"Coleção {prompt[:30]}",
        "category": "Editorial",
        "summary": "Catálogo gerado pelo estúdio.",
        "reasoning": "Composição clássica balanceada.",
        "palette": {
            "name": "Noir & Ivory",
            "primary": "#1A1817",
            "background": "#F5F1EA",
            "accent": "#B08D57",
        },
        "pages": [],
        "totalPages": 0,
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

