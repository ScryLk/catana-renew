"""
Regenera as imagens-placeholder dos catálogos de demonstração.

Sem fotos reais, cada produto recebe um placeholder LIMPO e on-brand:
gradiente suave da paleta do tema + medalhão circular com monograma +
nome do produto centralizado. Nada de texto "PLACEHOLDER" nem faixa preta.

Uso:
    python scripts/gerar_placeholders_demo.py            # todos os temas
    python scripts/gerar_placeholders_demo.py padaria    # só um tema

Lê demo_assets/<tema>/manifest.json (nomes + arquivos) e a paleta de
api/demo/themes.py. Sobrescreve os .jpg em demo_assets/<tema>/images/.
Depois, regenere o catálogo (manage.py gerar_catalogo_demo --tema <tema>)
para copiar as novas imagens para /media/.
"""
import json
import os
import sys

from PIL import Image, ImageDraw, ImageFont

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BASE)
from api.demo.themes import THEMES  # noqa: E402

W, H = 800, 600


def hex_rgb(s):
    s = s.lstrip('#')
    return tuple(int(s[i:i + 2], 16) for i in (0, 2, 4))


def mix(a, b, t):
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))


def luminance(c):
    return (0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]) / 255


def load_font(size, bold=False):
    cands = [
        '/usr/share/fonts/TTF/DejaVuSans%s.ttf',
        '/usr/share/fonts/dejavu/DejaVuSans%s.ttf',
        '/usr/share/fonts/truetype/dejavu/DejaVuSans%s.ttf',
        'DejaVuSans%s.ttf',
    ]
    suffix = '-Bold' if bold else ''
    for c in cands:
        try:
            return ImageFont.truetype(c % suffix, size)
        except OSError:
            continue
    return ImageFont.load_default()


def vertical_gradient(top, bottom):
    grad = Image.new('RGB', (1, H))
    for y in range(H):
        grad.putpixel((0, y), mix(top, bottom, y / (H - 1)))
    return grad.resize((W, H))


def wrap(draw, text, font, max_w):
    words, lines, cur = text.split(), [], ''
    for word in words:
        test = (cur + ' ' + word).strip()
        if draw.textlength(test, font=font) <= max_w:
            cur = test
        else:
            if cur:
                lines.append(cur)
            cur = word
    if cur:
        lines.append(cur)
    return lines[:3]


def monograma(nome):
    parts = [p for p in nome.split() if p[:1].isalnum()]
    if len(parts) >= 2:
        return (parts[0][0] + parts[1][0]).upper()
    return nome[:2].upper()


def gerar_imagem(nome, paleta, destino):
    primary = hex_rgb(paleta['primary'])
    surface = hex_rgb(paleta['surface'])
    background = hex_rgb(paleta['background'])
    accent = hex_rgb(paleta['accent'])
    text = hex_rgb(paleta['text'])
    on_primary = hex_rgb(paleta['textOnPrimary'])

    # Gradiente suave: surface no topo → leve tom da marca no rodapé.
    img = vertical_gradient(mix(surface, background, 0.15), mix(background, primary, 0.18))
    d = ImageDraw.Draw(img)

    # Moldura sutil
    d.rectangle([8, 8, W - 9, H - 9], outline=mix(background, primary, 0.35), width=2)

    # Medalhão circular com monograma
    r = 96
    cx, cy = W // 2, 232
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=primary)
    d.ellipse([cx - r, cy - r, cx + r, cy + r], outline=accent, width=5)
    fmono = load_font(96, bold=True)
    mono = monograma(nome)
    bb = d.textbbox((0, 0), mono, font=fmono)
    d.text((cx - (bb[2] - bb[0]) / 2, cy - (bb[3] - bb[1]) / 2 - bb[1]), mono,
           font=fmono, fill=on_primary)

    # Nome do produto, centralizado, abaixo do medalhão
    fname = load_font(40, bold=True)
    lines = wrap(d, nome, fname, W - 140)
    ty = 392
    for ln in lines:
        wln = d.textlength(ln, font=fname)
        d.text((cx - wln / 2, ty), ln, font=fname, fill=text)
        ty += 50

    # Rótulo discreto "imagem ilustrativa"
    flab = load_font(20)
    lab = 'imagem ilustrativa'
    wlab = d.textlength(lab, font=flab)
    d.text((cx - wlab / 2, H - 56), lab, font=flab, fill=mix(text, background, 0.45))

    img.save(destino, 'JPEG', quality=88)


def gerar_tema(tema):
    man_path = os.path.join(BASE, 'demo_assets', tema, 'manifest.json')
    if not os.path.exists(man_path):
        print(f'  ! manifest não encontrado: {tema}')
        return 0
    with open(man_path, encoding='utf-8') as fh:
        manifest = json.load(fh)
    paleta = THEMES[tema]['paleta']
    img_dir = os.path.join(BASE, 'demo_assets', tema, 'images')
    os.makedirs(img_dir, exist_ok=True)
    n = 0
    for prod in manifest.get('produtos', []):
        arq = prod.get('imagem')
        if not arq:
            continue
        gerar_imagem(prod['nome'], paleta, os.path.join(img_dir, arq))
        n += 1
    print(f'  {tema}: {n} imagens regeneradas')
    return n


def main():
    temas = sys.argv[1:] or [t for t in THEMES if os.path.isdir(os.path.join(BASE, 'demo_assets', t))]
    total = 0
    for tema in temas:
        if tema not in THEMES:
            print(f'  ! tema inválido: {tema}')
            continue
        total += gerar_tema(tema)
    print(f'OK — {total} imagens no total.')


if __name__ == '__main__':
    main()
