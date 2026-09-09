"""
Placeholders on-brand do catálogo ÁUREA (rede de segurança até a curadoria real).

Gera still lifes abstratos low-key coerentes com a identidade (off-black,
ivory, ouro #B08D57): fundo escuro com gradiente vertical + vinheta, uma
composição geométrica de traço fino em ouro e o nome da peça em versalete.

Substituíveis 1:1 pelas fotos reais (mesmos nomes de arquivo em
demo_assets/aurea/images/); depois basta regerar o catálogo.

Uso (dentro do container):
    python scripts/gerar_placeholders_aurea.py
"""
import math
import os

from PIL import Image, ImageDraw, ImageFont

BASE = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                    'demo_assets', 'aurea')
IMAGES = os.path.join(BASE, 'images')
FONTE_VAR = os.path.join(BASE, 'fonts', 'CormorantGaramond[wght].ttf')

PRETO = (26, 24, 23)      # #1A1817
IVORY = (245, 241, 234)   # #F5F1EA
OURO = (176, 141, 87)     # #B08D57

SS = 2  # supersampling p/ traço fino sem serrilhado


def _fonte(tamanho, peso=300):
    f = ImageFont.truetype(FONTE_VAR, tamanho)
    try:
        f.set_variation_by_axes([peso])
    except Exception:
        pass
    return f


def _base(w, h):
    """Fundo off-black com gradiente vertical sutil + vinheta radial."""
    img = Image.new('RGB', (w, h), PRETO)
    px = img.load()
    cx, cy = w / 2, h * 0.42
    maxd = math.hypot(cx, cy) or 1
    for y in range(h):
        grad = 10 * (y / h)  # escurece levemente para baixo
        for x in range(0, w, 1):
            d = math.hypot(x - cx, y - cy) / maxd
            v = -grad - 26 * (d ** 2)  # vinheta
            px[x, y] = (max(0, PRETO[0] + int(v) + 8),
                        max(0, PRETO[1] + int(v) + 7),
                        max(0, PRETO[2] + int(v) + 7))
    return img


def _versalete(draw, cx, y, texto, tamanho, cor, tracking):
    """Texto em caixa alta com tracking manual, centrado em cx."""
    texto = texto.upper()
    fonte = _fonte(tamanho, 400)
    widths = []
    for ch in texto:
        bb = draw.textbbox((0, 0), ch, font=fonte)
        widths.append(bb[2] - bb[0])
    total = sum(widths) + tracking * (len(texto) - 1)
    x = cx - total / 2
    for ch, wch in zip(texto, widths):
        draw.text((x, y), ch, fill=cor, font=fonte)
        x += wch + tracking


def _composicao(draw, w, h, variante):
    """Traço fino em ouro: uma composição geométrica por variante."""
    esp = max(1, int(w * 0.0016)) * SS
    ouro = (*OURO, 255)
    cx, cy = w / 2, h * 0.44
    r = w * 0.22
    if variante % 4 == 0:
        # anel + filete diagonal
        draw.ellipse([cx - r, cy - r, cx + r, cy + r], outline=ouro, width=esp)
        draw.line([(cx - r * 1.5, cy + r * 1.35), (cx + r * 1.5, cy - r * 1.35)],
                  fill=ouro, width=esp)
    elif variante % 4 == 1:
        # dois arcos concêntricos abertos
        draw.arc([cx - r, cy - r, cx + r, cy + r], 200, 80, fill=ouro, width=esp)
        r2 = r * 0.72
        draw.arc([cx - r2, cy - r2, cx + r2, cy + r2], 20, 260, fill=ouro, width=esp)
    elif variante % 4 == 2:
        # retângulo áureo rotacionado (losango fino)
        pts = []
        for ang in (0, 90, 180, 270):
            a = math.radians(ang + 18)
            pts.append((cx + r * 1.1 * math.cos(a), cy + r * 0.78 * math.sin(a)))
        draw.polygon(pts, outline=ouro, width=esp)
    else:
        # três filetes horizontais em escala
        for i, frac in enumerate((0.9, 0.55, 0.3)):
            lw = w * 0.36 * frac
            yy = cy - r * 0.5 + i * r * 0.55
            draw.line([(cx - lw / 2, yy), (cx + lw / 2, yy)], fill=ouro, width=esp)


def gerar(nome_arquivo, rotulo, w, h, variante, composicao=True):
    """Placeholder abstrato. Sem texto: rótulos internos duplicariam a
    tipografia da página; divisórias (composicao=False) são textura pura
    para não vazar traços pelo véu escuro."""
    W, H = w * SS, h * SS
    img = _base(W, H).convert('RGBA')
    draw = ImageDraw.Draw(img)
    if composicao:
        _composicao(draw, W, H, variante)
    img = img.convert('RGB').resize((w, h), Image.LANCZOS)
    dest = os.path.join(IMAGES, nome_arquivo)
    img.save(dest, 'JPEG', quality=92)
    print(f'  ✓ {nome_arquivo} ({w}x{h})')


def main():
    os.makedirs(IMAGES, exist_ok=True)
    print('Gerando placeholders ÁUREA...')
    especs = [
        # (arquivo, rótulo, w, h) — produto: retrato 1200x1500; divisória: A4-like
        ('prod-bolsa.jpg', 'Bolsa Aurelia', 1200, 1500),
        ('prod-cinto.jpg', 'Cinto Fiora', 1200, 1500),
        ('prod-luvas.jpg', 'Luvas Alba', 1200, 1500),
        ('prod-camisa.jpg', 'Camisa Solene', 1200, 1500),
        ('prod-echarpe.jpg', 'Echarpe Ligure', 1200, 1500),
        ('prod-lenco.jpg', 'Lenço Ária', 1200, 1500),
        ('prod-trico.jpg', 'Tricô Bruma', 1200, 1500),
        ('div-acessorios.jpg', 'Acessórios', 1240, 1754, False),
        ('div-seda.jpg', 'Seda & Cashmere', 1240, 1754, False),
        ('det-costura.jpg', 'Atelier', 1200, 1500),
        ('det-tecido.jpg', 'Matéria', 1200, 1500),
        ('det-fio.jpg', 'Fio de Ouro', 1200, 1500),
        ('det-atelier.jpg', 'Sob Medida', 1200, 1500),
    ]
    for i, spec in enumerate(especs):
        arq, rot, w, h = spec[:4]
        comp = spec[4] if len(spec) > 4 else True
        gerar(arq, rot, w, h, i, composicao=comp)
    print('Pronto. Substitua pelos JPGs reais (mesmos nomes) quando curados.')


if __name__ == '__main__':
    main()
