"""
Geração local de marca para os catálogos premium (sem asset externo).

Tudo em PNG transparente via Pillow (mesma pipeline das fotos de produto →
renderiza no editor e exporta no PDF). Supersampling para antialiasing.
"""
import math
import re
import unicodedata

from PIL import Image, ImageDraw, ImageFont

from .identidade import _rgb

_FONT_DIR = '/usr/share/fonts/truetype/dejavu'
SS = 4  # fator de supersampling


def _fonte(serif, tamanho, bold=True):
    nome = 'DejaVuSerif' if serif else 'DejaVuSans'
    if bold:
        nome += '-Bold'
    try:
        return ImageFont.truetype(f'{_FONT_DIR}/{nome}.ttf', tamanho)
    except Exception:
        return ImageFont.load_default()


def _serif_do(ident):
    return 'serif' in ident['tipografia']['display']['familia'].lower()


def iniciais(nome):
    limpo = unicodedata.normalize('NFKD', nome).encode('ascii', 'ignore').decode()
    palavras = [w for w in re.split(r'\s+', limpo) if w and w[0].isalnum()]
    palavras = [w for w in palavras if w.lower() not in ('de', 'da', 'do', 'e', '&', 'co')]
    if not palavras:
        return 'C'
    if len(palavras) == 1:
        return palavras[0][:2].upper()
    return (palavras[0][0] + palavras[1][0]).upper()


def _texto_centralizado(draw, cx, cy, texto, fonte, cor):
    bb = draw.textbbox((0, 0), texto, font=fonte)
    w, h = bb[2] - bb[0], bb[3] - bb[1]
    draw.text((cx - w / 2 - bb[0], cy - h / 2 - bb[1]), texto, fill=cor, font=fonte)


def monograma(ident, nome, tamanho=240, cor_fundo=None, cor_texto=None):
    """Badge circular com as iniciais. Retorna PIL Image RGBA."""
    pal = ident['paleta']
    cor_fundo = cor_fundo or pal['primaria']
    cor_texto = cor_texto or pal['texto_sobre_primaria']
    s = tamanho * SS
    img = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.ellipse([0, 0, s - 1, s - 1], fill=(*_rgb(cor_fundo), 255))
    # anel de acento
    anel = max(2, int(s * 0.02))
    d.ellipse([anel * 2, anel * 2, s - 1 - anel * 2, s - 1 - anel * 2],
              outline=(*_rgb(pal['acento']), 255), width=anel)
    fonte = _fonte(_serif_do(ident), int(s * 0.42))
    _texto_centralizado(d, s / 2, s / 2, iniciais(nome), fonte, (*_rgb(cor_texto), 255))
    return img.resize((tamanho, tamanho), Image.LANCZOS)


def wordmark(ident, nome, cor_texto=None, largura=1200, altura=320):
    """Lockup: monograma + nome em fonte display. PNG transparente."""
    pal = ident['paleta']
    cor_texto = cor_texto or pal['texto_sobre_primaria']
    s = SS
    W, H = largura * s, altura * s
    img = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    # monograma à esquerda
    mono_tam = int(H * 0.82)
    mono = monograma(ident, nome, tamanho=mono_tam, cor_texto=pal['texto_sobre_primaria'])
    my = (H - mono_tam) // 2
    img.paste(mono, (0, my), mono)
    # nome ao lado, com fonte ajustada para caber na largura disponível
    tx = mono_tam + int(H * 0.18)
    disp = W - tx - int(H * 0.1)
    serif = _serif_do(ident)
    tamanho = int(H * 0.5)
    while tamanho > 12:
        fonte = _fonte(serif, tamanho)
        bb = d.textbbox((0, 0), nome, font=fonte)
        if (bb[2] - bb[0]) <= disp:
            break
        tamanho -= int(H * 0.02) or 1
    d.text((tx, (H - (bb[3] - bb[1])) / 2 - bb[1]), nome, fill=(*_rgb(cor_texto), 255), font=fonte)
    # corta para o conteúdo (sem espaço morto) e reduz pelo supersampling
    rec = img.getbbox()
    if rec:
        img = img.crop(rec)
    nova_largura = max(1, img.width // s)
    nova_altura = max(1, img.height // s)
    return img.resize((nova_largura, nova_altura), Image.LANCZOS)


def motivo_faixa(ident, tipo, largura=1600, altura=120, cor=None):
    """Faixa decorativa com o motivo gráfico do tema. PNG transparente."""
    pal = ident['paleta']
    cor = cor or pal['acento']
    rgb = _rgb(cor)
    s = SS
    W, H = largura * s, altura * s
    img = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    a = 230

    if tipo == 'onda':  # padaria
        passo = W // 14
        amp = H * 0.30
        meio = H / 2
        esp = max(2, int(H * 0.07))
        pts = []
        for x in range(0, W + 1, max(1, W // 200)):
            y = meio + amp * math.sin(2 * math.pi * x / passo)
            pts.append((x, y))
        d.line(pts, fill=(*rgb, a), width=esp, joint='curve')
    elif tipo == 'traco':  # açougue
        esp = max(2, int(H * 0.10))
        for i in range(0, W, W // 18):
            d.line([(i, H * 0.2), (i + H * 0.5, H * 0.8)], fill=(*rgb, a), width=esp)
    elif tipo == 'folha':  # mercado
        rw, rh = int(H * 0.6), int(H * 0.42)
        for i in range(0, W, W // 16):
            d.ellipse([i, H * 0.3, i + rw, H * 0.3 + rh], fill=(*rgb, a))
    elif tipo == 'filete':  # restaurante
        esp = max(2, int(H * 0.10))
        d.line([(0, H / 2), (W, H / 2)], fill=(*rgb, a), width=esp)
        d.line([(0, H * 0.18), (W, H * 0.18)], fill=(*rgb, int(a * 0.5)), width=max(1, esp // 2))
    elif tipo == 'confete':  # festas
        cores = [pal['primaria'], pal['secundaria'], pal['acento']]
        import hashlib
        for i in range(0, W, W // 40):
            h = hashlib.md5(str(i).encode()).hexdigest()
            cr = _rgb(cores[int(h[0], 16) % 3])
            yy = (int(h[1:3], 16) % int(H * 0.7))
            r = int(H * 0.10)
            if int(h[3], 16) % 2:
                d.ellipse([i, yy, i + r, yy + r], fill=(*cr, a))
            else:
                d.rectangle([i, yy, i + r, yy + r], fill=(*cr, a))
    elif tipo == 'linha':  # boutique
        esp = max(1, int(H * 0.04))
        d.line([(0, H / 2), (W, H / 2)], fill=(*rgb, a), width=esp)
    else:  # barra
        d.rectangle([0, H * 0.35, W, H * 0.65], fill=(*rgb, a))

    return img.resize((largura, altura), Image.LANCZOS)
