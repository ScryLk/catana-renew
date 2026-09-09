"""
ÁUREA — catálogo showcase de boutique de luxo (moda e acessórios).

Seed dedicado no padrão seed-script-por-catálogo (ver generator.py): escreve
direto em Organization/Sede/Category/Product/Media/Catalog/Page/Component/
PageComponent, no formato exato que o catalogLoader.service.ts reconstrói.
Referência visual: catálogos impressos de maisons europeias — minimalismo,
espaço negativo generoso, tipografia editorial.

Decisões travadas pela spec (não alterar sem decisão explícita):
- Paleta de EXATAMENTE 3 cores: off-black #1A1817, ivory #F5F1EA, ouro #B08D57.
  Sem cinzas, sem tints; hierarquia vem de corpo/tracking, não de cor.
- Tipografia: Cormorant Garamond (display) + Jost (apoio). Todo texto usa
  text-paragraph — o renderer de text-title IGNORA letterSpacing/lineHeight.
- Versalete baked na string (renderer não lê textTransform).
- Compensação de renderer: text-paragraph tem padding interno fixo de 8px
  (p-2); toda caixa de texto é deslocada -8px/-8px e alargada +16px para o
  glifo cair na cota da grade. Shapes/imagens não compensam.
- Motivo único: filete ouro de 1px de altura. No máximo UM por página, além
  da assinatura fixa do fólio. Nunca sobre foto, nunca vertical, nunca na
  capa/contracapa.
- Margem editorial de 96px nos 4 lados; página 794x1123 (A4 @96dpi).

Idempotente (modo replace): apaga a Organization "[PORTFÓLIO] ÁUREA" anterior
(cascata) e recria tudo. O catalog_id muda a cada geração.
"""
import json
import os

from django.conf import settings
from django.db import transaction
from PIL import Image, ImageDraw, ImageFont

from ..models import (
    User, Organization, Sede, Category, Product, ProductMedia,
    Catalog, Theme,
)
from .generator import (
    PageBuilder, el_rect, el_text, el_image,
    _criar_media, _media_de_pil, PAGE_W, PAGE_H, DEMO_USER,
)

# ---- Identidade (valores concretos, baked em todo elemento) ----
PRETO = '#1A1817'
IVORY = '#F5F1EA'
OURO = '#B08D57'

SERIF = '"Cormorant Garamond", Georgia, serif'
SANS = 'Jost, "Helvetica Neue", Arial, sans-serif'

# Escala tipográfica da spec (px / weight / letterSpacing px / lineHeight).
TIPOS = {
    'display':  dict(font=SERIF, size=54, weight='300', ls=0,   lh=1.25),
    'secao':    dict(font=SERIF, size=46, weight='400', ls=2,   lh=1.2),
    'titulo':   dict(font=SERIF, size=30, weight='400', ls=1,   lh=1.3),
    'nome':     dict(font=SERIF, size=26, weight='500', ls=0.5, lh=1.2),
    'corpo':    dict(font=SANS,  size=13, weight='300', ls=0.3, lh=1.7),
    'preco':    dict(font=SANS,  size=14, weight='300', ls=2,   lh=1.4),
    'rotulo':   dict(font=SANS,  size=10, weight='300', ls=3.5, lh=1.4),
    'folio':    dict(font=SANS,  size=10, weight='300', ls=3,   lh=1.4),
}

# ---- Grade editorial ----
M = 96                       # margem externa nos 4 lados
CONTENT_W = PAGE_W - 2 * M   # 602
PAD = 8                      # padding interno do text-paragraph (p-2) a compensar

ORG_NAME = '[PORTFÓLIO] ÁUREA'

# Allowlist estrita: qualquer tipo fora daqui é bug de programação do seed.
ELEMENTOS_PERMITIDOS = {'shape-rectangle', 'text-paragraph', 'image'}

FONTE_VAR = os.path.join(
    settings.BASE_DIR, 'demo_assets', 'aurea', 'fonts', 'CormorantGaramond[wght].ttf')


class ElementoDesconhecidoError(Exception):
    """Elemento fora da allowlist do seed ÁUREA — nunca mapear silenciosamente."""


class AureaPage:
    """PageBuilder com validação de allowlist e helpers da grade ÁUREA."""

    def __init__(self, ctx, order):
        self._pb = PageBuilder(ctx['catalog'], order, ctx['org'], ctx['sede'], ctx['user'])

    def add(self, content, x, y, w, h):
        tipo = content.get('type')
        if tipo not in ELEMENTOS_PERMITIDOS:
            raise ElementoDesconhecidoError(
                f'Tipo de elemento não permitido no seed ÁUREA: {tipo!r}')
        self._pb.add(content, x, y, w, h)

    # -- fundo e filete --

    def bg(self, cor):
        self.add(el_rect(cor, name='Fundo'), 0, 0, PAGE_W, PAGE_H)

    def filete(self, x, y, w, name='Filete'):
        self.add(el_rect(OURO, name=name), x, y, w, 1)

    # -- texto com compensação do p-2 do renderer --

    def txt(self, texto, preset, cor, x, y, w, h, align='left', name='Texto'):
        t = TIPOS[preset]
        self.add(
            el_text(texto, t['size'], cor, t['font'], weight=t['weight'],
                    align=align, line_height=t['lh'], kind='text-paragraph',
                    name=name, letter_spacing=t['ls']),
            x - PAD, y - PAD, w + 2 * PAD, h + 2 * PAD,
        )

    def imagem(self, url, x, y, w, h, name='Foto'):
        self.add(el_image(url, radius=0, object_fit='cover', name=name), x, y, w, h)

    def folio(self, num):
        """Assinatura fixa do rodapé das páginas de conteúdo (ivory)."""
        self.filete(PAGE_W / 2 - 12, 1044, 24, name='FileteFolio')
        self.txt(f'ÁUREA · {num:02d}', 'folio', PRETO,
                 M, 1058, CONTENT_W, 18, align='center', name='Fólio')


# ============================================================
# Marca (Pillow, PNG transparente, Cormorant local)
# ============================================================

_SS = 4  # supersampling


def _fonte_cormorant(tamanho, peso=300):
    fonte = ImageFont.truetype(FONTE_VAR, tamanho)
    try:
        fonte.set_variation_by_axes([peso])
    except Exception:
        pass
    return fonte


def monograma_aurea(cor_texto=IVORY, tamanho=480):
    """'Á' em Cormorant Light dentro de anel de traço fino ouro. Transparente."""
    def _rgb(h):
        h = h.lstrip('#')
        return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))
    s = tamanho * _SS
    img = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    anel = max(2, int(s * 0.006))  # ~3px no tamanho final: traço fino
    d.ellipse([anel, anel, s - 1 - anel, s - 1 - anel],
              outline=(*_rgb(OURO), 255), width=anel)
    fonte = _fonte_cormorant(int(s * 0.46), peso=300)
    bb = d.textbbox((0, 0), 'Á', font=fonte)
    w, h = bb[2] - bb[0], bb[3] - bb[1]
    d.text((s / 2 - w / 2 - bb[0], s / 2 - h / 2 - bb[1]), 'Á',
           fill=(*_rgb(cor_texto), 255), font=fonte)
    return img.resize((tamanho, tamanho), Image.LANCZOS)


def wordmark_aurea(cor_texto=IVORY, altura=240):
    """'Á U R E A' com tracking manual em Cormorant Regular. Transparente."""
    def _rgb(h):
        h = h.lstrip('#')
        return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))
    s = _SS
    H = altura * s
    fonte = _fonte_cormorant(int(H * 0.78), peso=400)
    texto = 'ÁUREA'
    tracking = int(H * 0.42)  # respiro largo entre glifos, marca de maison
    tmp = ImageDraw.Draw(Image.new('RGBA', (8, 8)))
    widths = [tmp.textbbox((0, 0), ch, font=fonte) for ch in texto]
    total = sum(bb[2] - bb[0] for bb in widths) + tracking * (len(texto) - 1)
    img = Image.new('RGBA', (total + H, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    x = 0
    for ch, bb in zip(texto, widths):
        d.text((x - bb[0], 0), ch, fill=(*_rgb(cor_texto), 255), font=fonte)
        x += (bb[2] - bb[0]) + tracking
    rec = img.getbbox()
    if rec:
        img = img.crop(rec)
    return img.resize((max(1, img.width // s), max(1, img.height // s)), Image.LANCZOS)


# ============================================================
# Páginas
# ============================================================

def _pag_capa(ctx, order):
    page = AureaPage(ctx, order)
    page.bg(PRETO)
    # Monograma centrado no terço superior.
    mono_url, _, _ = ctx['logos']['mono']
    page.imagem(mono_url, (PAGE_W - 120) / 2, 300, 120, 120, name='Monograma')
    # Wordmark logo abaixo.
    wurl, ww, wh = ctx['logos']['word_ivory']
    lw = int(56 * (ww / wh))
    page.add(el_image(wurl, object_fit='contain', name='Wordmark'),
             (PAGE_W - lw) / 2, 452, lw, 56)
    # Uma linha, em versalete ouro.
    page.txt(ctx['manifest']['colecao'].upper(), 'rotulo', OURO,
             M, 548, CONTENT_W, 18, align='center', name='Coleção')
    # Rótulo mínimo no pé.
    page.txt('MODA & ACESSÓRIOS · SÃO PAULO', 'rotulo', IVORY,
             M, 952, CONTENT_W, 18, align='center', name='Rótulo')
    return order + 1


def _pag_manifesto(ctx, order):
    page = AureaPage(ctx, order)
    page.bg(IVORY)
    page.txt('MANIFESTO', 'rotulo', OURO, M, 312, 300, 18, name='Rótulo')
    page.filete(M, 340, 40)
    page.txt('O essencial,\nexecutado sem pressa.', 'display', PRETO,
             M, 380, 520, 180, name='Manifesto')
    page.folio(2)
    return order + 1


def _pag_divisoria(ctx, order, img_key, rotulo, titulo):
    page = AureaPage(ctx, order)
    page.bg(PRETO)
    url = ctx['editoriais'].get(img_key)
    if url:
        page.imagem(url, 0, 0, PAGE_W, PAGE_H, name='FotoDivisória')
    # Véu do próprio off-black para garantir contraste do título sobre a foto.
    page.add({'type': 'shape-rectangle', 'name': 'Véu',
              'style': {'backgroundColor': 'rgba(26,24,23,0.62)', 'borderRadius': 0}},
             0, 0, PAGE_W, PAGE_H)
    page.txt(rotulo.upper(), 'rotulo', OURO, M, 452, CONTENT_W, 18,
             align='center', name='Rótulo')
    page.txt(titulo.upper(), 'secao', IVORY, M, 490, CONTENT_W, 66,
             align='center', name='Título')
    page.filete(PAGE_W / 2 - 28, 596, 56)
    return order + 1


def _bloco_produto(page, prod, x, y, w, num, com_filete, largura_nome=None):
    """Rótulo (+filete opcional), nome, descrição e preço de uma peça."""
    page.txt(f'{prod["categoria"].upper()} · {num:02d}', 'rotulo', OURO,
             x, y, w, 16, name='Rótulo')
    if com_filete:
        page.filete(x, y + 24, 40)
    page.txt(prod['nome'], 'nome', PRETO, x, y + 40, largura_nome or w, 36, name='Nome')
    page.txt(prod['descricao'], 'corpo', PRETO, x, y + 78, w, 48, name='Descrição')


def _preco(page, prod, x_fim, y, w=176):
    """Preço alinhado à direita, terminando exatamente em x_fim."""
    page.txt(f'R$ {prod["preco"]}', 'preco', PRETO,
             x_fim - w, y, w, 22, align='right', name='Preço')


# Deslocamento para alinhar a linha de base do preço (14px/1.4) com a do nome
# (26px/1.2) quando dividem a mesma linha (páginas hero/single).
BASELINE_PRECO = 9


def _pag_hero(ctx, order, prod, num, folio_num):
    """1 produto por página: foto grande + linha única de informação."""
    page = AureaPage(ctx, order)
    page.bg(IVORY)
    page.imagem(prod['_url'], M, M, CONTENT_W, 740)
    _bloco_produto(page, prod, M, 868, 506, num, com_filete=True, largura_nome=380)
    _preco(page, prod, M + CONTENT_W, 908 + BASELINE_PRECO)
    page.folio(folio_num)
    return order + 1


def _pag_duo(ctx, order, prod_a, prod_b, num_a, num_b, folio_num, espelhada=False):
    """2 produtos, colunas assimétricas defasadas. espelhada=True inverte."""
    page = AureaPage(ctx, order)
    page.bg(IVORY)
    col_w, gap = 285, 32
    x_alta = M if not espelhada else M + col_w + gap        # coluna que começa no topo
    x_baixa = M + col_w + gap if not espelhada else M       # coluna defasada
    # Peça A: foto no topo da página.
    page.imagem(prod_a['_url'], x_alta, M, col_w, 380)
    _bloco_produto(page, prod_a, x_alta, 508, col_w, num_a, com_filete=True)
    _preco(page, prod_a, x_alta + col_w, 634, w=col_w)
    # Peça B: foto defasada verticalmente (ritmo editorial).
    page.imagem(prod_b['_url'], x_baixa, 336, col_w, 380)
    _bloco_produto(page, prod_b, x_baixa, 748, col_w, num_b, com_filete=False)
    _preco(page, prod_b, x_baixa + col_w, 874, w=col_w)
    page.folio(folio_num)
    return order + 1


def _pag_single(ctx, order, prod, num, folio_num):
    """Fechamento de coleção: foto média deslocada, máximo de respiro."""
    page = AureaPage(ctx, order)
    page.bg(IVORY)
    page.imagem(prod['_url'], M, 140, 440, 560)
    _bloco_produto(page, prod, M, 732, 460, num, com_filete=True, largura_nome=300)
    _preco(page, prod, M + 440, 772 + BASELINE_PRECO)
    page.folio(folio_num)
    return order + 1


def _pag_sob_medida(ctx, order):
    page = AureaPage(ctx, order)
    page.bg(IVORY)
    page.txt('SOB MEDIDA', 'rotulo', OURO, M, 176, 300, 18, name='Rótulo')
    page.filete(M, 204, 40)
    page.txt('O atelier ao seu tempo.', 'titulo', PRETO, M, 236, 440, 44, name='Título')
    page.txt('Cada peça ÁUREA pode ser executada sob encomenda — na sua medida, '
             'no seu couro, na sua seda.', 'corpo', PRETO, M, 296, 340, 48, name='Intro')
    passos = [
        ('CONSULTA', 'Recebemos por agendamento, no atelier ou por vídeo. '
                     'Uma conversa sobre uso, medidas e matéria.'),
        ('PROVA', 'Entre quatro e seis semanas, a peça em prova. '
                  'Ajustes são parte do processo, não exceção.'),
        ('ENTREGA', 'A peça final, numerada e assinada, acompanhada do '
                    'certificado de origem das matérias.'),
    ]
    y = 396
    for rotulo, texto in passos:
        page.txt(rotulo, 'rotulo', PRETO, M, y, 320, 16, name=rotulo)
        page.txt(texto, 'corpo', PRETO, M, y + 26, 320, 66, name=f'{rotulo}Texto')
        y += 120
    det = ctx['editoriais'].get('det_costura')
    if det:
        page.imagem(det, 458, 396, 240, 320, name='Detalhe')
    page.folio(10)
    return order + 1


def _pag_contracapa(ctx, order):
    page = AureaPage(ctx, order)
    page.bg(PRETO)
    mono_url, _, _ = ctx['logos']['mono']
    page.imagem(mono_url, (PAGE_W - 96) / 2, 380, 96, 96, name='Monograma')
    page.txt('SOB CONVITE E AGENDAMENTO', 'rotulo', OURO,
             M, 700, CONTENT_W, 18, align='center', name='Convite')
    contato = ctx['manifest']['empresa']['contato']
    linhas = [
        contato['endereco'].upper(),
        f"{contato['email'].upper()} · {contato['telefone']}",
        contato['instagram'].upper(),
    ]
    y = 744
    for ln in linhas:
        page.txt(ln, 'folio', IVORY, M, y, CONTENT_W, 18, align='center', name='Contato')
        y += 28
    return order + 1


# ============================================================
# Theme (designTokens completos — E tudo baked nos contents acima)
# ============================================================

def _design_tokens():
    def cor(v, desc, contraste):
        return {'value': v, 'description': desc, 'contrast': contraste}

    def tipo(familia, size, weight, lh, ls=0, transform='none'):
        return {'fontFamily': familia, 'fontSize': size, 'fontWeight': str(weight),
                'lineHeight': lh, 'letterSpacing': ls, 'textTransform': transform}

    return {
        'colors': {
            'primary': cor(PRETO, 'Off-black — fundos de capa e todo texto sobre ivory', IVORY),
            'secondary': cor(IVORY, 'Ivory — fundo editorial e texto sobre off-black', PRETO),
            'accent': cor(OURO, 'Ouro envelhecido — filete, rótulos, marca', PRETO),
            'background': cor(IVORY, 'Fundo das páginas de conteúdo', PRETO),
            'surface': cor(IVORY, 'Sem superfícies elevadas: mesma cor do fundo', PRETO),
            'border': cor(OURO, 'Única "borda" do sistema é o filete ouro', PRETO),
            'text': {
                'primary': cor(PRETO, 'Texto sobre ivory', IVORY),
                'secondary': cor(PRETO, 'Sem cinzas: hierarquia por corpo/tracking', IVORY),
                'disabled': cor(OURO, 'Uso raro', PRETO),
            },
        },
        'typography': {
            'h1': tipo(SERIF, 54, 300, 1.25),
            'h2': tipo(SERIF, 46, 400, 1.2, 2),
            'h3': tipo(SERIF, 30, 400, 1.3, 1),
            'h4': tipo(SERIF, 26, 500, 1.2, 0.5),
            'h5': tipo(SANS, 14, 300, 1.4, 2),
            'h6': tipo(SANS, 10, 300, 1.4, 3.5, 'uppercase'),
            'body': tipo(SANS, 13, 300, 1.7, 0.3),
            'bodySmall': tipo(SANS, 10, 300, 1.4, 3),
            'bodyLarge': tipo(SANS, 15, 300, 1.7, 0.3),
            'caption': tipo(SANS, 10, 300, 1.4, 3.5, 'uppercase'),
            'button': tipo(SANS, 13, 400, 1.4, 1),
        },
        'spacing': {'base': 8, 'xxs': 2, 'xs': 4, 'sm': 8, 'md': 16,
                    'lg': 24, 'xl': 32, 'xxl': 48, 'xxxl': 96},
        'borderRadius': {'none': 0, 'sm': 0, 'md': 0, 'lg': 0, 'xl': 0, 'full': 0},
        'shadows': {'none': 'none', 'sm': 'none', 'md': 'none',
                    'lg': 'none', 'xl': 'none'},
    }


# ============================================================
# Entry point
# ============================================================

@transaction.atomic
def gerar_catalogo_aurea():
    """Gera (modo replace) o catálogo ÁUREA. Retorna o Catalog criado."""
    base_dir = os.path.join(settings.BASE_DIR, 'demo_assets', 'aurea')
    with open(os.path.join(base_dir, 'manifest.json'), encoding='utf-8') as fh:
        manifest = json.load(fh)
    empresa = manifest['empresa']

    user, _ = User.objects.get_or_create(
        username=DEMO_USER,
        defaults={'email': 'demo@catana.local', 'role': 'admin'},
    )

    # Replace explícito: cascata limpa páginas/componentes/mídia da geração anterior.
    Organization.objects.filter(name=ORG_NAME, owner=user).delete()

    org = Organization.objects.create(name=ORG_NAME, owner=user)
    sede = Sede.objects.create(name='Atelier', organization=org, responsible_user=user)
    org.default_sede = sede
    org.save(update_fields=['default_sede'])
    user.organizations.add(org)
    user.sedes.add(sede)

    categorias = {
        nome: Category.objects.create(name=nome, organization=org, sede=sede,
                                      created_by=user)
        for nome in manifest['categorias']
    }

    # Produtos + fotos (Media com URL relativa /media/...).
    produtos = {}
    for idx, p in enumerate(manifest['produtos']):
        img_path = os.path.join(base_dir, 'images', p['imagem'])
        media, url = _criar_media(img_path, p['nome'], org, sede, user)
        # Preço no manifest em formato pt-BR ("4.900" = quatro mil e novecentos).
        preco_decimal = p['preco'].replace('.', '').replace(',', '.')
        produto = Product.objects.create(
            name=p['nome'], description=p['descricao'], price=preco_decimal,
            sku=f'AUREA-{idx:03d}', stock=1, currency='BRL',
            category=categorias[p['categoria']], specs=[],
            cover_image=media, organization=org, sede=sede, created_by=user,
        )
        if media:
            ProductMedia.objects.create(product=produto, media=media, order=0)
        produtos[p['imagem'].replace('prod-', '').replace('.jpg', '')] = {
            **p, '_url': url, '_obj': produto,
        }

    # Imagens editoriais (divisórias, detalhe do atelier).
    editoriais = {}
    for chave, arquivo in manifest.get('imagens_editoriais', {}).items():
        _, url = _criar_media(os.path.join(base_dir, 'images', arquivo),
                              chave, org, sede, user)
        editoriais[chave] = url

    # Marca (Pillow + Cormorant local).
    logos = {
        'mono': _media_de_pil(monograma_aurea(IVORY), 'aurea-monograma', org, sede, user),
        'mono_preto': _media_de_pil(monograma_aurea(PRETO), 'aurea-monograma-preto',
                                    org, sede, user),
        'word_ivory': _media_de_pil(wordmark_aurea(IVORY), 'aurea-wordmark-ivory',
                                    org, sede, user),
        'word_preto': _media_de_pil(wordmark_aurea(PRETO), 'aurea-wordmark-preto',
                                    org, sede, user),
    }

    theme = Theme.objects.create(
        name='ÁUREA', styles={'designTokens': _design_tokens()},
        organization=org, sede=sede, created_by=user,
    )

    catalog = Catalog.objects.create(
        title=f"ÁUREA — {manifest['colecao']}",
        description=empresa['slogan'],
        theme=theme, organization=org, sede=sede, created_by=user,
        is_public=True, is_demo=True,
    )

    ctx = dict(catalog=catalog, org=org, sede=sede, user=user,
               manifest=manifest, editoriais=editoriais, logos=logos)

    # 11 páginas. Espelhamentos: 4↔7 (hero) e 5↔8 (duo, refletida).
    order = 0
    order = _pag_capa(ctx, order)                                        # 01
    order = _pag_manifesto(ctx, order)                                   # 02
    order = _pag_divisoria(ctx, order, 'div_acessorios',
                           'Coleção I', 'Acessórios')                    # 03
    order = _pag_hero(ctx, order, produtos['bolsa'], 1, 4)               # 04
    order = _pag_duo(ctx, order, produtos['cinto'], produtos['luvas'],
                     2, 3, 5)                                            # 05
    order = _pag_divisoria(ctx, order, 'div_seda',
                           'Coleção II', 'Seda & Cashmere')              # 06
    order = _pag_hero(ctx, order, produtos['camisa'], 4, 7)              # 07
    order = _pag_duo(ctx, order, produtos['echarpe'], produtos['lenco'],
                     5, 6, 8, espelhada=True)                            # 08
    order = _pag_single(ctx, order, produtos['trico'], 7, 9)             # 09
    order = _pag_sob_medida(ctx, order)                                  # 10
    order = _pag_contracapa(ctx, order)                                  # 11

    return catalog
