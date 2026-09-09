"""
Rasterizador de verificação — renderiza um catálogo do BANCO (Page/PageComponent/
Component + Theme) para PNG/PDF, replicando o box-model do ElementRenderer do
front. Serve para a etapa "EXPORTE E OLHE" do fluxo de autoria por JSON:
inspecionar a composição sem depender do navegador.

NÃO é o export oficial (@react-pdf/html2canvas/PDFShift, que precisam do
browser) — é uma prévia fiel para julgar grade, hierarquia, alinhamento e
sobreposição. Resolve $tokens.* contra o Theme do catálogo, igual ao editor.

Uso:
    PEXELS... irrelevante. Requer SECRET_KEY + DATABASE_URL no ambiente.
    python scripts/render_catalogo.py <catalog_id> [saida_dir]
"""
import os
import sys

import django

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BASE)
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'catana_back.settings')
django.setup()

from django.conf import settings  # noqa: E402
from api.models import Catalog, Page, PageComponent  # noqa: E402
from PIL import Image, ImageDraw, ImageFont  # noqa: E402

SCALE = 2
PW, PH = 794, 1123
F = {
    ('serif', False): '/usr/share/fonts/TTF/DejaVuSerif.ttf',
    ('serif', True): '/usr/share/fonts/TTF/DejaVuSerif-Bold.ttf',
    ('sans', False): '/usr/share/fonts/TTF/DejaVuSans.ttf',
    ('sans', True): '/usr/share/fonts/TTF/DejaVuSans-Bold.ttf',
}
_fc = {}


def font(family, size, weight):
    fam = (family or '').lower()
    serif = any(k in fam for k in ('georgia', 'times', 'cormorant')) or ('serif' in fam and 'sans' not in fam)
    bold = str(weight) in ('bold', '600', '700', '800', '900')
    key = (('serif' if serif else 'sans'), bold, int(round(size * SCALE)))
    if key not in _fc:
        _fc[key] = ImageFont.truetype(F[(key[0], key[1])], max(1, key[2]))
    return _fc[key]


def resolve(val, tokens):
    if not isinstance(val, str) or not val.startswith('$tokens.'):
        return val
    cur = tokens or {}
    for k in val[len('$tokens.'):].split('.'):
        if isinstance(cur, dict) and k in cur:
            cur = cur[k]
        else:
            return val
    if isinstance(cur, dict) and 'value' in cur:
        return cur['value']
    return cur


def color(c, tokens, default=None):
    c = resolve(c, tokens)
    if not isinstance(c, str):
        return default
    c = c.strip()
    if c.startswith('rgb'):
        nums = c[c.find('(') + 1:c.find(')')].split(',')
        r, g, b = (int(float(n)) for n in nums[:3])
        a = int(float(nums[3]) * 255) if len(nums) > 3 else 255
        return (r, g, b, a)
    if c.startswith('#'):
        h = c[1:]
        if len(h) == 3:
            h = ''.join(ch * 2 for ch in h)
        return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), 255)
    return default


def S(v):
    return int(round(v * SCALE))


def composite(base, layer):
    base.alpha_composite(layer)


def rounded(box, radius, fill=None, outline=None, width=0):
    layer = Image.new('RGBA', (PW * SCALE, PH * SCALE), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    x0, y0, x1, y1 = box
    r = max(0, S(radius))
    if r > 0:
        if fill:
            d.rounded_rectangle([x0, y0, x1 - 1, y1 - 1], radius=r, fill=fill)
        if outline and width:
            d.rounded_rectangle([x0, y0, x1 - 1, y1 - 1], radius=r, outline=outline, width=max(1, S(width)))
    else:
        if fill:
            d.rectangle([x0, y0, x1 - 1, y1 - 1], fill=fill)
        if outline and width:
            d.rectangle([x0, y0, x1 - 1, y1 - 1], outline=outline, width=max(1, S(width)))
    return layer


def media_path(src):
    if not src:
        return None
    rel = src.split('/media/', 1)[-1]
    p = os.path.join(settings.MEDIA_ROOT, rel)
    return p if os.path.exists(p) else None


def round_mask(im, radius):
    if radius <= 0:
        return im
    mask = Image.new('L', im.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, im.size[0] - 1, im.size[1] - 1], radius=S(radius), fill=255)
    im.putalpha(mask)
    return im


def draw_image(base, el):
    src = (el.get('imageData') or {}).get('src') or el.get('imageUrl')
    p = media_path(src)
    x, y, w, h = el['_x'], el['_y'], el['_w'], el['_h']
    if not p:
        composite(base, rounded([S(x), S(y), S(x + w), S(y + h)], el['style'].get('borderRadius', 0),
                                fill=(230, 230, 230, 255)))
        return
    im = Image.open(p).convert('RGBA')
    tw, th = S(w), S(h)
    sw, sh = im.size
    sc = max(tw / sw, th / sh)
    im = im.resize((max(1, round(sw * sc)), max(1, round(sh * sc))), Image.LANCZOS)
    nw, nh = im.size
    im = im.crop(((nw - tw) // 2, (nh - th) // 2, (nw - tw) // 2 + tw, (nh - th) // 2 + th))
    im = round_mask(im, el['style'].get('borderRadius', 0))
    base.alpha_composite(im, (S(x), S(y)))


def wrap(draw, text, fnt, maxw):
    out = []
    for para in str(text).split('\n'):
        words = para.split(' ')
        cur = ''
        for wd in words:
            t = (cur + ' ' + wd).strip()
            if draw.textlength(t, font=fnt) <= maxw or not cur:
                cur = t
            else:
                out.append(cur)
                cur = wd
        out.append(cur)
    return out


def draw_text_line(d, x, y, line, fnt, fill, ls):
    if ls and ls > 0:
        cx = x
        for ch in line:
            d.text((cx, y), ch, font=fnt, fill=fill)
            cx += d.textlength(ch, font=fnt) + S(ls)
        return cx - x
    d.text((x, y), line, font=fnt, fill=fill)
    return d.textlength(line, font=fnt)


def line_width(d, line, fnt, ls):
    w = d.textlength(line, font=fnt)
    if ls and ls > 0:
        w += S(ls) * max(0, len(line) - 1)
    return w


def draw_text(base, el, tokens):
    st = el['style']
    x, y, w, h = el['_x'], el['_y'], el['_w'], el['_h']
    s = el.get('content', {}).get('text', '') if isinstance(el.get('content'), dict) else ''
    fnt = font(st.get('fontFamily'), st.get('fontSize', 14), st.get('fontWeight'))
    fill = color(st.get('textColor'), tokens, (31, 41, 55, 255))
    align = st.get('textAlign', 'left')
    lh = st.get('lineHeight', 1.3) or 1.3
    ls = st.get('letterSpacing', 0) or 0
    is_title = el['type'] == 'text-title'
    pad = 0 if is_title else 8
    avail = S(w) - S(pad) * 2
    line_h = int(round(st.get('fontSize', 14) * lh * SCALE))

    layer = Image.new('RGBA', (PW * SCALE, PH * SCALE), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    lines = wrap(d, s, fnt, avail)

    total = line_h * len(lines)
    if is_title:
        cy = S(y) + (S(h) - total) // 2          # items-center (vertical)
    else:
        cy = S(y) + S(pad)                        # items-start (topo)
    limit = S(y) + S(h) - (0 if is_title else S(pad))
    for ln in lines:
        if not is_title and cy + line_h > limit + 2:
            break                                  # overflow-hidden
        lw = line_width(d, ln, fnt, ls)
        if align == 'center':
            lx = S(x) + S(pad) + (avail - lw) // 2
        elif align == 'right':
            lx = S(x) + S(pad) + (avail - lw)
        else:
            lx = S(x) + S(pad)
        draw_text_line(d, lx, cy, ln, fnt, fill, ls)
        cy += line_h
    composite(base, layer)


def draw_shape(base, el, tokens):
    st = el['style']
    x, y, w, h = el['_x'], el['_y'], el['_w'], el['_h']
    # Fiel ao ElementRenderer: shape sem backgroundColor cai no default cinza
    # (#E5E7EB); 'transparent' = sem preenchimento.
    bgval = st.get('backgroundColor')
    if bgval is None:
        bg = (229, 231, 235, 255)
    elif bgval == 'transparent':
        bg = None
    else:
        bg = color(bgval, tokens)
    bc = color(st.get('borderColor'), tokens)
    bw = st.get('borderWidth', 0)
    box = [S(x), S(y), S(x + w), S(y + h)]
    if el['type'] == 'shape-circle':
        layer = Image.new('RGBA', (PW * SCALE, PH * SCALE), (0, 0, 0, 0))
        dd = ImageDraw.Draw(layer)
        dd.ellipse([box[0], box[1], box[2] - 1, box[3] - 1], fill=bg,
                   outline=bc if bw else None, width=max(1, S(bw)) if bw else 0)
        composite(base, layer)
    else:
        composite(base, rounded(box, st.get('borderRadius', 0), fill=bg, outline=bc, width=bw))


def render_page(elements, tokens):
    base = Image.new('RGBA', (PW * SCALE, PH * SCALE), (255, 255, 255, 255))
    for el in elements:
        t = el['type']
        if t in ('image', 'uploaded-image'):
            draw_image(base, el)
        elif t.startswith('text'):
            draw_text(base, el, tokens)
        else:
            draw_shape(base, el, tokens)
    return base.convert('RGB').resize((PW, PH), Image.LANCZOS)


def load_catalog(cid):
    cat = Catalog.objects.get(id=cid)
    tokens = (cat.theme.styles or {}).get('designTokens', {}) if cat.theme else {}
    tokens = tokens.get('colors') and tokens or tokens  # tolerante
    pages = []
    for pg in Page.objects.filter(catalog=cat).order_by('order'):
        els = []
        for pc in PageComponent.objects.filter(page=pg).select_related('component').order_by('layer'):
            c = pc.component.content or {}
            els.append({**c, '_x': pc.position_x, '_y': pc.position_y, '_w': pc.width, '_h': pc.height,
                        'type': c.get('type', 'text'), 'style': c.get('style', {})})
        pages.append(els)
    return cat, tokens, pages


def main():
    cid = int(sys.argv[1])
    out_dir = sys.argv[2] if len(sys.argv) > 2 else os.path.join(BASE, 'render_pro')
    os.makedirs(out_dir, exist_ok=True)
    cat, tokens, pages = load_catalog(cid)
    imgs = []
    for i, els in enumerate(pages):
        im = render_page(els, tokens)
        fp = os.path.join(out_dir, f'page-{i:02d}.png')
        im.save(fp)
        imgs.append(im)
        print(f'  página {i} -> {fp} ({len(els)} elementos)')
    if imgs:
        try:
            pdf = os.path.join(BASE, 'catalogo_preview.pdf')
            rgb_imgs = [im.convert('RGB') for im in imgs]
            rgb_imgs[0].save(pdf, save_all=True, append_images=rgb_imgs[1:], resolution=96.0)
            print(f'PDF: {pdf} ({len(imgs)} páginas)')
        except Exception as e:
            print(f'Aviso PDF: {e}')


if __name__ == '__main__':
    main()
