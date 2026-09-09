"""
Baixa fotos REAIS para os produtos dos catálogos demo, substituindo os
placeholders. Fonte primária: Pexels (sem key neste ambiente); fallback:
Wikimedia Commons (keyless). Se ambos falharem, mantém o placeholder atual.

Cada query tenta: nome do produto → categoria → termo genérico do tema.
A imagem é recortada em "cover" para 800x600 e salva sobre o .jpg do produto.

Uso:
    python scripts/baixar_imagens_demo.py            # todos os temas
    python scripts/baixar_imagens_demo.py padaria    # só um tema

Depois: manage.py gerar_catalogo_demo --tema <tema> para copiar p/ /media/.
"""
import io
import json
import os
import sys
import time
from urllib.parse import quote

import requests
from PIL import Image

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BASE)
from api.demo.themes import THEMES  # noqa: E402

W, H = 800, 600
UA = {'User-Agent': 'CatanaDemo/1.0 (demo catalog images)'}
GENERICO = {
    'padaria': 'bakery bread', 'acougue': 'raw meat butcher', 'mercado': 'fresh vegetables',
    'restaurante': 'gourmet plated dish', 'festas': 'party decoration', 'boutique': 'fashion clothing store',
}

# Fallback por categoria em INGLÊS — termos PT de categoria ("Pães", "Doces")
# casam com arquivos irrelevantes no Wikimedia; termos em inglês são confiáveis.
CATEGORIA_EN = {
    'Pães': 'bread', 'Bolos e Tortas': 'cake', 'Salgados': 'savory pastry snack',
    'Doces': 'dessert sweets', 'Bebidas': 'drink beverage',
    'Bovinos': 'beef meat', 'Suínos': 'pork meat', 'Aves': 'chicken poultry',
    'Linguiças': 'sausage', 'Temperos': 'spices seasoning',
    'Frutas': 'fruit', 'Legumes': 'vegetables', 'Verduras': 'leafy greens vegetables',
    'Orgânicos': 'organic vegetables', 'Mercearia': 'groceries pantry food',
    'Entradas': 'appetizer starter food', 'Principais': 'main course dish',
    'Massas': 'pasta dish', 'Sobremesas': 'dessert', 'Vinhos': 'wine bottle',
    'Decoração': 'party decoration', 'Lembrancinhas': 'party favor gift',
    'Descartáveis': 'disposable tableware party', 'Balões': 'party balloons',
    'Camisas': 'shirt clothing', 'Calças': 'trousers clothing', 'Vestidos': 'dress fashion',
    'Alfaiataria': 'suit tailoring menswear', 'Acessórios': 'fashion accessories',
}


def fit_cover(im):
    sw, sh = im.size
    scale = max(W / sw, H / sh)
    nw, nh = round(sw * scale), round(sh * scale)
    im = im.resize((nw, nh), Image.LANCZOS)
    left, top = (nw - W) // 2, (nh - H) // 2
    return im.crop((left, top, left + W, top + H))


def baixar(url):
    try:
        r = requests.get(url, timeout=20, headers=UA)
        if r.status_code != 200 or not r.content:
            return None
        return Image.open(io.BytesIO(r.content)).convert('RGB')
    except Exception:
        return None


PEXELS_KEY = os.environ.get('PEXELS_API_KEY', '')
_pex_cache = {}  # query -> [urls]  (evita repetir busca da mesma categoria)


def pexels_urls(query, per_page=15):
    """Lista de URLs de fotos do Pexels (curado/relevante). Requer PEXELS_API_KEY."""
    if not PEXELS_KEY or not query:
        return []
    if query in _pex_cache:
        return _pex_cache[query]
    out = []
    try:
        u = f'https://api.pexels.com/v1/search?query={quote(query)}&per_page={per_page}&orientation=landscape'
        r = requests.get(u, timeout=12, headers={**UA, 'Authorization': PEXELS_KEY})
        if r.status_code == 200:
            for p in (r.json() or {}).get('photos') or []:
                src = p.get('src', {})
                url = src.get('landscape') or src.get('large')
                if url:
                    out.append(url)
    except Exception:
        pass
    _pex_cache[query] = out
    return out


def wikimedia_url(query):
    try:
        params = dict(action='query', generator='search', gsrsearch=query, gsrnamespace=6,
                      gsrlimit=4, prop='imageinfo', iiprop='url|mime', iiurlwidth=1000, format='json')
        r = requests.get('https://commons.wikimedia.org/w/api.php', params=params, timeout=12, headers=UA)
        if r.status_code != 200:
            return None
        pages = ((r.json() or {}).get('query', {}) or {}).get('pages') or {}
        for p in pages.values():
            ii = (p.get('imageinfo') or [{}])[0]
            mime = ii.get('mime', '')
            if mime.startswith('image/') and mime not in ('image/svg+xml', 'image/gif'):
                return ii.get('thumburl') or ii.get('url')
    except Exception:
        return None
    return None


def escolher(pexels_qs, wiki_qs, pick):
    """Pexels primário (termos em inglês, curado/relevante); Wikimedia fallback
    (usa o nome PT exato, que costuma ter artigo no Commons).

    `pick` roda o índice dentro da lista do Pexels para que produtos da MESMA
    categoria recebam fotos DIFERENTES (variedade).
    """
    for q in pexels_qs:
        urls = pexels_urls(q)
        if urls:
            im = baixar(urls[pick % len(urls)])
            if im:
                return im, 'pexels', q
        time.sleep(0.3)
    for q in wiki_qs:
        if not q:
            continue
        url = wikimedia_url(q)
        if url:
            im = baixar(url)
            if im:
                return im, 'wikimedia', q
        time.sleep(0.6)
    return None, None, None


def processar_tema(tema):
    man_path = os.path.join(BASE, 'demo_assets', tema, 'manifest.json')
    if not os.path.exists(man_path):
        print(f'  ! manifest não encontrado: {tema}')
        return
    with open(man_path, encoding='utf-8') as fh:
        manifest = json.load(fh)
    img_dir = os.path.join(BASE, 'demo_assets', tema, 'images')
    generico = GENERICO.get(tema, 'product')
    contador = {}  # categoria -> índice (variedade dentro da categoria)
    print(f'== {tema} ==')
    for prod in manifest.get('produtos', []):
        arq = prod.get('imagem')
        if not arq:
            continue
        cat = prod.get('categoria', '')
        pick = contador.get(cat, 0)
        contador[cat] = pick + 1
        cat_en = CATEGORIA_EN.get(cat, generico)
        # Pexels: termos em inglês (relevância). Wikimedia: nome PT exato.
        pexels_qs = [cat_en, generico]
        wiki_qs = [prod['nome'], cat_en, generico]
        im, fonte, q = escolher(pexels_qs, wiki_qs, pick)
        if im is None:
            print(f'  - {prod["nome"]:32s} -> sem foto (mantém placeholder)')
            continue
        fit_cover(im).save(os.path.join(img_dir, arq), 'JPEG', quality=85)
        print(f'  ✓ {prod["nome"]:32s} -> {fonte} ("{q}")')
        time.sleep(0.3)


def main():
    temas = sys.argv[1:] or [t for t in THEMES if os.path.isdir(os.path.join(BASE, 'demo_assets', t))]
    for tema in temas:
        if tema not in THEMES:
            print(f'  ! tema inválido: {tema}')
            continue
        processar_tema(tema)


if __name__ == '__main__':
    main()
