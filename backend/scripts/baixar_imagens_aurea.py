"""
Baixa fotos REAIS (Pexels) para o catálogo showcase ÁUREA, substituindo os
placeholders abstratos de demo_assets/aurea/images/.

Diferente do fluxo demo genérico, aqui há um GATE DE QUALIDADE low-key:
para cada busca, baixa as prévias dos N primeiros resultados em retrato,
mede a luminância média e escolhe a foto MAIS ESCURA abaixo do teto —
coerente com a identidade (luz dramática, fundo escuro, still life).

Requer PEXELS_API_KEY no ambiente (nunca versionar). Sem key → aborta.

Uso (no container):
    docker compose -f docker-compose.local.yml exec -T \
      -e PEXELS_API_KEY=xxx web python scripts/baixar_imagens_aurea.py

Depois: python manage.py gerar_catalogo_aurea  (copia para /media/).
"""
import io
import os
import re
import sys
import time
from urllib.parse import quote

import requests
from PIL import Image, ImageStat

# Spec ÁUREA: SEM rostos reconhecíveis. O alt do Pexels denuncia gente na foto.
PESSOA_RE = re.compile(
    r'\b(woman|women|man|men|person|people|model|girl|boy|lady|guy|face|portrait|'
    r'she|he|her|his|human|male|female|wearing|holds?|holding)\b', re.I)

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMAGES = os.path.join(BASE, 'demo_assets', 'aurea', 'images')
UA = {'User-Agent': 'CatanaAurea/1.0 (portfolio catalog images)'}

PEXELS_KEY = os.environ.get('PEXELS_API_KEY', '')

# Teto de luminância (0-255): acima disso a foto é clara demais para o ÁUREA.
LUMA_MAX = 120
# Quantos candidatos avaliar por busca.
CANDIDATOS = 18

# arquivo -> (queries em ordem de preferência, largura, altura)
# Queries com viés duro de still life/flat lay/close up — objeto, nunca modelo.
CURADORIA = {
    'prod-bolsa.jpg': (['leather handbag still life dark background',
                        'leather bag product photography dark table'], 1200, 1500),
    'prod-cinto.jpg': (['leather belt rolled still life dark',
                        'leather belt close up black background object'], 1200, 1500),
    'prod-luvas.jpg': (['leather gloves on wooden table',
                        'brown leather gloves still life',
                        'pair of leather gloves closeup'], 1200, 1500),
    'prod-camisa.jpg': (['black silk shirt hanging dark studio',
                         'silk blouse elegant dark background',
                         'white dress shirt dark moody still life'], 1200, 1500),
    'prod-echarpe.jpg': (['cashmere scarf folded still life dark',
                          'wool scarf stack close up dark'], 1200, 1500),
    'prod-lenco.jpg': (['silk scarf still life dark fabric',
                        'silk fabric draped still life black'], 1200, 1500),
    'prod-trico.jpg': (['beige knit sweater folded dark background',
                        'cream wool sweater texture close up',
                        'neutral knitwear folded still life'], 1200, 1500),
    'div-acessorios.jpg': (['leather texture dark close up macro',
                            'dark leather craftsmanship moody'], 1240, 1754),
    'div-seda.jpg': (['silk fabric dark drape close up',
                      'satin fabric folds black moody'], 1240, 1754),
    'det-costura.jpg': (['hand stitching leather craftsmanship dark',
                         'leather workshop tools dark moody'], 1200, 1500),
    'det-tecido.jpg': (['linen fabric texture macro dark'], 1200, 1500),
    'det-fio.jpg': (['gold thread needle macro dark',
                     'sewing thread spool dark moody'], 1200, 1500),
    'det-atelier.jpg': (['tailor atelier dark moody tools',
                         'sewing machine dark workshop'], 1200, 1500),
}


def pexels_fotos(query):
    """Fotos do Pexels em retrato SEM pessoa no alt: [(url_preview, url_grande)]."""
    u = (f'https://api.pexels.com/v1/search?query={quote(query)}'
         f'&per_page={CANDIDATOS}&orientation=portrait')
    r = requests.get(u, timeout=15, headers={**UA, 'Authorization': PEXELS_KEY})
    if r.status_code != 200:
        return []
    out = []
    for p in (r.json() or {}).get('photos') or []:
        if PESSOA_RE.search(p.get('alt') or ''):
            continue  # spec: sem rostos/modelos
        src = p.get('src', {})
        prev, grande = src.get('medium'), (src.get('large2x') or src.get('large'))
        if prev and grande:
            out.append((prev, grande))
    return out


def baixar(url):
    try:
        r = requests.get(url, timeout=25, headers=UA)
        if r.status_code != 200 or not r.content:
            return None
        return Image.open(io.BytesIO(r.content)).convert('RGB')
    except Exception:
        return None


def luminancia(im):
    return ImageStat.Stat(im.convert('L')).mean[0]


def escore(im):
    """Menor = melhor. Luminância + penalidade de saturação (a paleta ÁUREA é
    neutra/quente: bokeh colorido e luz de neon estouram a identidade)."""
    luma = luminancia(im)
    sat = ImageStat.Stat(im.convert('HSV').getchannel('S')).mean[0]
    return luma + max(0.0, sat - 40) * 1.5, luma


def fit_cover(im, w, h):
    sw, sh = im.size
    scale = max(w / sw, h / sh)
    nw, nh = round(sw * scale), round(sh * scale)
    im = im.resize((nw, nh), Image.LANCZOS)
    left, top = (nw - w) // 2, (nh - h) // 2
    return im.crop((left, top, left + w, top + h))


def escolher_low_key(queries, posicao=0):
    """Avalia as prévias e devolve o candidato na `posicao` do ranking por
    escore (0 = melhor). Permite pular um vencedor rejeitado na revisão
    manual (ex.: logo visível) via CLI "arquivo.jpg:1"."""
    ranking = []  # [(escore, luma, url_grande, query)]
    for q in queries:
        for prev, grande in pexels_fotos(q):
            im = baixar(prev)
            if im is None:
                continue
            sc, luma = escore(im)
            ranking.append((sc, luma, grande, q))
        time.sleep(0.35)
        # se a primeira query já rendeu algo bem escuro, não gasta a próxima
        ranking.sort(key=lambda t: t[0])
        if len(ranking) > posicao and ranking[posicao][0] <= LUMA_MAX * 0.7:
            break
    ranking.sort(key=lambda t: t[0])
    return ranking[posicao] if len(ranking) > posicao else None


def main():
    if not PEXELS_KEY:
        sys.exit('PEXELS_API_KEY ausente no ambiente — abortando (nada foi alterado).')
    # Argumentos opcionais: "arquivo.jpg" ou "arquivo.jpg:N" (N-ésimo do ranking).
    alvo = {}
    for a in sys.argv[1:]:
        nome, _, pos = a.partition(':')
        alvo[nome] = int(pos) if pos else 0
    if not alvo:
        alvo = {nome: 0 for nome in CURADORIA}
    ok, escuras, claras = 0, 0, 0
    for arquivo, (queries, w, h) in CURADORIA.items():
        if arquivo not in alvo:
            continue
        melhor = escolher_low_key(queries, posicao=alvo[arquivo])
        if not melhor:
            print(f'  ✗ {arquivo}: sem candidato sem-pessoa — arquivo atual mantido')
            continue
        _, luma, url, q = melhor
        im = baixar(url)
        if im is None:
            print(f'  ✗ {arquivo}: falha no download — arquivo atual mantido')
            continue
        fit_cover(im, w, h).save(os.path.join(IMAGES, arquivo), 'JPEG', quality=90)
        flag = 'low-key' if luma <= LUMA_MAX else f'CLARA (luma {luma:.0f}) ⚠️'
        escuras += luma <= LUMA_MAX
        claras += luma > LUMA_MAX
        ok += 1
        print(f'  ✓ {arquivo}  [{flag}]  «{q}»')
    print(f'\n{ok}/{len(alvo)} fotos baixadas ({escuras} low-key, {claras} claras).')
    print('Agora: python manage.py gerar_catalogo_aurea')


if __name__ == '__main__':
    main()
