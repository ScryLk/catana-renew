"""
Autoria de um catálogo Catana de qualidade de portfólio (setor: confeitaria /
food service — embalagens & utensílios), seguindo docs/CATALOG_JSON_SPEC.md.

Produz UM envelope catalogIO v1.0 (JSON) usando SÓ tipos round-trip-safe
(shape-*, text-*, image), com produtos compostos por primitivas (sem
product-card placeholder). Grade rígida e paleta via designTokens.

Saída: catana-back/catalogo_cristallo.json
Persistir: POST /api/catalogs/import-json/  (o "tradutor" do spec, §1).

Imagens: arquivos estáticos em /media/catalog_pro/* (curados do Pexels num passo
de prep separado — NÃO há chamada de API em runtime de geração/render).
"""
import json
import os

# ---------------- Grade base (px @96dpi, A4) ----------------
PAGE_W, PAGE_H = 794, 1123
M = 56                      # margem de conteúdo
CW = PAGE_W - 2 * M         # 682 — largura de conteúdo
GUT = 24                    # gutter
U = 8                       # unidade de ritmo

# ---------------- Escala tipográfica (4 tamanhos) ----------------
T_DISPLAY = 56
T_TITLE = 28
T_SUB = 16
T_BODY = 12.5
SERIF = "Georgia, 'Times New Roman', serif"
SANS = "Inter, system-ui, sans-serif"

# ---------------- Paleta (cor de marca: framboesa) ----------------
# Valores concretos (vão para o designTokens / Theme.styles.designTokens):
PRIMARY_HEX = '#A82E4E'
SECOND_HEX = '#C77D3A'
ACCENT_HEX = '#E6B45C'
BG_HEX = '#FBF7F2'
SURFACE_HEX = '#FFFFFF'
BORDER_HEX = '#ECE0D6'
TEXT_HEX = '#2B2126'
MUTED_HEX = '#7C6E72'

# Nos ELEMENTOS usamos cores LITERAIS (como o gerador de demo). O $tokens.* só
# resolve no caminho do editor (themeResolve com os tokens no store); em outros
# render paths (showcase público, PDF) pode não resolver → cor lavada. Literais
# renderizam corretamente em todos os caminhos. A paleta segue registrada nos
# designTokens do Theme (abaixo) para edição global de tema.
PRIMARY = PRIMARY_HEX
SECOND = SECOND_HEX
ACCENT = ACCENT_HEX
BG = BG_HEX
SURFACE = SURFACE_HEX
BORDER = BORDER_HEX
TEXT = TEXT_HEX
MUTED = MUTED_HEX
# Cores de composição sem token equivalente (overlays/creme/zebra) — literais:
CREAM = '#FBF1E6'
ZEBRA = '#F3EBE2'
BOXBG = '#F6EEF1'
INK_OVERLAY = 'rgba(28,16,21,0.42)'
INK_BAND = 'rgba(24,13,18,0.58)'

IMG = '/media/catalog_pro'

BRAND = {
    'nome': 'Cristallo',
    'wordmark': 'CRISTALLO',
    'sub': 'EMBALAGENS & UTENSÍLIOS',
    'tagline': 'Transparência que valoriza cada criação.',
    'sobre': (
        'A Cristallo nasceu nos bastidores da confeitaria — entre brigadeiros que '
        'precisavam brilhar e sobremesas que mereciam ser vistas. Desenhamos '
        'embalagens PET cristal, caixas e utensílios que protegem o sabor e '
        'transformam cada doce numa vitrine. Do ateliê ao food service, a '
        'embalagem é a primeira mordida — e ela entra pelos olhos.'
    ),
    'contato': {
        'site': 'cristallo.com.br',
        'tel': '(11) 4002-8922',
        'email': 'vendas@cristallo.com.br',
        'insta': '@cristallo.embalagens',
        'end': 'R. das Confeitarias, 250 — São Paulo, SP',
    },
}

PRODUTOS = [
    # cat, nome, especificação, descrição curta, preço, imagem
    ('Potes & Taças', 'Pote Cristal 250ml', 'PET cristal · c/ tampa', 'Transparência total para brigadeiros e mousses.', '0,89', 'pote-250'),
    ('Potes & Taças', 'Copo Sobremesa 200ml', 'PET · base reforçada', 'Para verrines e sobremesas em camadas.', '0,75', 'copo-200'),
    ('Potes & Taças', 'Pote Redondo 500ml', 'PET · tampa de pressão', 'Versátil para doces, saladas e porções.', '1,20', 'pote-500'),
    ('Potes & Taças', 'Taça Petit Gâteau 150ml', 'PET · formato premium', 'Apresentação elegante para o seu best-seller.', '0,95', 'taca-petit'),
    ('Caixas & Delivery', 'Caixa 6 Doces', 'Cartão · visor cristal', 'Janela transparente que mostra o conteúdo.', '1,80', 'caixa-6'),
    ('Caixas & Delivery', 'Bolo no Pote 250ml', 'PET · tampa rosqueável', 'Veda de verdade — bolo no pote sem vazar.', '1,10', 'bolo-pote'),
    ('Caixas & Delivery', 'Sacola Delivery Kraft', 'Kraft · alça reforçada', 'Robustez e charme rústico para o delivery.', '0,68', 'sacola'),
    ('Caixas & Delivery', 'Marmita Bio 750ml', 'Fibra · biodegradável', 'Compostável, resistente a calor e gordura.', '1,45', 'marmita'),
    ('Finalização', 'Forminha Cupcake', 'Papel · forneável', 'Mantém a forma e não solta a massa.', '0,18', 'forminha'),
    ('Finalização', 'Colher Degustação', 'PS cristal · 90mm', 'O toque final para provas e sobremesas.', '0,09', 'colher'),
    ('Finalização', 'Tag Kraft Personalizável', 'Kraft · c/ furo', 'Sua marca em cada embalagem entregue.', '0,22', 'tag'),
    ('Finalização', 'Fita de Cetim 10mm', 'Poliéster · rolo 10m', 'Acabamento que assina o seu cuidado.', '0,40', 'fita'),
]

# Sumário (índice) — nome + página impressa
INDICE = [
    ('Apresentação', 2),
    ('Linha Confeitaria 2026', 4),
    ('Potes, Copos & Caixas', 5),
    ('Delivery & Finalização', 6),
    ('Tabela de Preços', 7),
    ('Diferenciais', 8),
    ('Contato', 9),
]


# ============================================================
# Builders de elemento (catalogIO)
# ============================================================
class Page:
    def __init__(self, name, order):
        self.name = name
        self.order = order
        self.els = []

    def add(self, el):
        el['zIndex'] = len(self.els)
        self.els.append(el)
        return el

    def json(self):
        return {'name': self.name, 'order': self.order, 'elements': self.els}


def rect(x, y, w, h, bg=None, radius=0, bc=None, bw=0, name='Forma'):
    # SEMPRE define backgroundColor. Sem ele, o ElementRenderer cai no default
    # cinza (#E5E7EB) e preenche molduras/bordas com cinza por cima do conteúdo.
    style = {'borderRadius': radius, 'backgroundColor': bg if bg is not None else 'transparent'}
    if bc and bw:
        style.update({'borderColor': bc, 'borderWidth': bw, 'borderStyle': 'solid'})
    return {'type': 'shape-rectangle', 'name': name,
            'position': {'x': x, 'y': y}, 'size': {'width': w, 'height': h},
            'style': style}


def text(x, y, w, h, s, size, color, font=SANS, weight='normal', align='left',
         lh=1.3, ls=0, kind=None, multi=False, name='Texto'):
    # Texto de UMA linha → 'text-title' (sem padding, centro vertical, sem
    # overflow-hidden). Só corpo multi-linha usa 'text-paragraph' (p-2 + clip),
    # senão labels curtos somem (ElementRenderer recorta a linha que não cabe).
    if kind is None:
        kind = 'text-paragraph' if multi else 'text-title'
    return {'type': kind, 'name': name,
            'position': {'x': x, 'y': y}, 'size': {'width': w, 'height': h},
            'style': {'fontFamily': font, 'fontSize': size, 'fontWeight': str(weight),
                      'textColor': color, 'textAlign': align, 'lineHeight': lh,
                      'letterSpacing': ls},
            'content': {'text': s}}


def image(x, y, w, h, fname, radius=0, fit='cover', name='Imagem'):
    src = f'{IMG}/{fname}.jpg'
    return {'type': 'image', 'name': name,
            'position': {'x': x, 'y': y}, 'size': {'width': w, 'height': h},
            'style': {'borderRadius': radius, 'objectFit': fit},
            'imageUrl': src,
            'imageData': {'src': src, 'opacity': 1, 'borderRadius': radius,
                          'objectFit': fit, 'aspectRatioLocked': False}}


def regua(p, x, y, w=64, cor=ACCENT):
    p.add(rect(x, y, w, 4, bg=cor, radius=2, name='Régua'))


def logo_lockup(p, x, y, dark_bg=False, scale=1.0):
    """Monograma (selo) + wordmark — tratamento de logo, round-trip-safe."""
    s = scale
    badge = int(46 * s)
    fg = CREAM if dark_bg else SURFACE
    word_color = CREAM if dark_bg else TEXT
    p.add(rect(x, y, badge, badge, bg=PRIMARY, radius=int(12 * s), name='Selo'))
    p.add(text(x, y + int(7 * s), badge, int(32 * s), 'C', int(26 * s), fg,
               font=SERIF, weight='bold', align='center', name='Monograma'))
    p.add(text(x + badge + 12, y + int(4 * s), 260, int(22 * s), BRAND['wordmark'],
               int(18 * s), word_color, font=SERIF, weight='bold', ls=2, name='Wordmark'))
    p.add(text(x + badge + 12, y + int(26 * s), 260, int(14 * s), BRAND['sub'],
               int(8.5 * s), word_color, font=SANS, ls=2, name='Sub-wordmark'))


# ============================================================
# Páginas
# ============================================================
def pg_capa(order):
    p = Page('Capa', order)
    p.add(image(0, 0, PAGE_W, PAGE_H, 'hero', name='Hero'))           # foto sangrada
    p.add(rect(0, 0, PAGE_W, PAGE_H, bg=INK_OVERLAY, name='Overlay'))  # legibilidade global
    p.add(rect(0, 720, PAGE_W, PAGE_H - 720, bg=INK_BAND, name='Faixa inferior'))
    p.add(rect(0, 0, PAGE_W, 132, bg='rgba(18,10,14,0.50)', name='Scrim topo'))  # legibilidade do logo
    p.add(rect(24, 24, PAGE_W - 48, PAGE_H - 48, bc=CREAM, bw=1, name='Moldura'))  # frame de pôster
    logo_lockup(p, M, 64, dark_bg=True)
    p.add(text(M, 690, 200, 24, 'CATÁLOGO 2026', 13, ACCENT, font=SANS, weight='bold', ls=4, name='Kicker'))
    p.add(text(M, 724, CW, 150, BRAND['nome'], T_DISPLAY, CREAM, font=SERIF, weight='bold', lh=1.05, name='Título'))
    regua(p, M, 854, 72)
    p.add(text(M, 880, CW - 120, 70, BRAND['tagline'], 20, CREAM, font=SERIF, lh=1.3, name='Tagline'))
    p.add(text(M, PAGE_H - 90, CW, 24, BRAND['contato']['site'] + '   ·   ' + BRAND['contato']['insta'],
               12, CREAM, font=SANS, ls=1, name='Rodapé capa'))
    return p


def header_secao(p, kicker, titulo):
    """Cabeçalho padrão de seção (mesma posição em todas as páginas)."""
    p.add(rect(0, 0, PAGE_W, PAGE_H, bg=BG, name='Fundo'))
    p.add(text(M, 64, CW, 20, kicker, 12, PRIMARY, font=SANS, weight='bold', ls=3, name='Kicker'))
    p.add(text(M, 86, CW, 50, titulo, T_TITLE, TEXT, font=SERIF, weight='bold', kind='text-title', name='Título'))
    regua(p, M, 138, 64)


def pg_apresentacao(order):
    p = Page('Apresentação', order)
    header_secao(p, 'A MARCA', 'Apresentação')
    # lead + corpo em duas colunas + imagem de respiro
    p.add(text(M, 176, CW, 64, 'A embalagem é a primeira mordida.', 22, PRIMARY,
               font=SERIF, weight='bold', lh=1.25, name='Lead'))
    col_w = (CW - GUT) // 2
    metade = len(BRAND['sobre']) // 2
    corte = BRAND['sobre'].rfind(' ', 0, metade)
    p.add(text(M, 250, col_w, 220, BRAND['sobre'][:corte].strip(), T_BODY, TEXT,
               font=SANS, lh=1.65, multi=True, name='Corpo 1'))
    p.add(text(M + col_w + GUT, 250, col_w, 220, BRAND['sobre'][corte:].strip(), T_BODY, TEXT,
               font=SANS, lh=1.65, multi=True, name='Corpo 2'))
    p.add(image(M, 506, CW, 430, 'apresentacao', radius=14, name='Imagem'))
    p.add(rect(M, 506, CW, 430, bc=BORDER, bw=1, radius=14, name='Borda imagem'))
    p.add(text(M, 952, CW, 24, '“Do ateliê ao food service — protege o sabor, valoriza a vitrine.”',
               13, MUTED, font=SERIF, align='center', name='Legenda'))
    return p


def pg_indice(order):
    p = Page('Índice', order)
    header_secao(p, 'NAVEGAÇÃO', 'Índice')
    y = 200
    for i, (nome, pag) in enumerate(INDICE, 1):
        p.add(text(M, y, 44, 30, f'{i:02d}', T_SUB, ACCENT, font=SERIF, weight='bold', name='Num'))
        p.add(text(M + 56, y, CW - 56 - 60, 30, nome, T_SUB, TEXT, font=SANS, name='Item'))
        p.add(text(M + CW - 60, y, 60, 30, f'{pag:02d}', T_SUB, PRIMARY, font=SERIF, weight='bold',
                   align='right', name='Pág'))
        p.add(rect(M, y + 40, CW, 1, bg=BORDER, name='Linha'))
        y += 58
    p.add(text(M, y + 18, CW, 24, f'{len(PRODUTOS)} produtos · 3 linhas · preços base 2026',
               12, MUTED, font=SANS, ls=1, name='Nota'))
    return p


def pg_divisor(order):
    p = Page('Divisor', order)
    p.add(image(0, 0, PAGE_W, PAGE_H, 'divisor', name='Fundo'))
    p.add(rect(0, 0, PAGE_W, PAGE_H, bg=INK_OVERLAY, name='Overlay'))
    p.add(rect(0, 470, PAGE_W, 200, bg=INK_BAND, name='Faixa'))
    p.add(rect(0, 470, PAGE_W, 6, bg=ACCENT, name='Acento'))
    p.add(text(M, 500, CW, 28, 'LINHA 2026', 14, ACCENT, font=SANS, weight='bold', ls=5, align='center', name='Kicker'))
    p.add(text(M, 530, CW, 90, 'Linha Confeitaria', 46, CREAM, font=SERIF, weight='bold',
               align='center', kind='text-title', name='Categoria'))
    p.add(text(M, 624, CW, 30, 'Embalagens PET cristal, caixas e finalização', 16, CREAM,
               font=SANS, align='center', name='Sub'))
    return p


def _card(p, x, y, w, h, prod):
    _, nome, spec, desc, preco, img = prod
    pad = 16
    p.add(rect(x, y, w, h, bg=SURFACE, radius=14, bc=BORDER, bw=1, name='Card'))
    img_h = int(h * 0.46)
    p.add(image(x + 10, y + 10, w - 20, img_h - 10, img, radius=10, name='Foto'))
    ny = y + img_h + 8
    p.add(text(x + pad, ny, w - 2 * pad, 24, nome, T_SUB, TEXT, font=SERIF, weight='bold', name='Nome'))
    p.add(text(x + pad, ny + 26, w - 2 * pad, 16, spec.upper(), 9.5, PRIMARY, font=SANS, weight='bold',
               ls=1, name='Spec'))
    price_h = 28
    py = y + h - 12 - price_h
    dy = ny + 46
    p.add(text(x + pad, dy, w - 2 * pad, max(24, py - dy - 6), desc, T_BODY, MUTED,
               font=SANS, lh=1.3, multi=True, name='Desc'))
    p.add(rect(x + pad, py - 8, w - 2 * pad, 1, bg=BORDER, name='Filete'))
    p.add(text(x + pad, py, w - 2 * pad, price_h, f'R$ {preco}', 19, PRIMARY, font=SERIF,
               weight='bold', name='Preço'))


def pg_grade(order, kicker, titulo, produtos):
    p = Page(titulo, order)
    header_secao(p, kicker, titulo)
    cols, rows = 2, 3
    top0 = 176
    card_w = (CW - GUT) // cols
    card_h = (PAGE_H - top0 - M - GUT * (rows - 1)) // rows
    for i, prod in enumerate(produtos[:cols * rows]):
        r, c = divmod(i, cols)
        x = M + c * (card_w + GUT)
        y = top0 + r * (card_h + GUT)
        _card(p, x, y, card_w, card_h, prod)
    return p


def pg_precos(order):
    p = Page('Tabela de Preços', order)
    header_secao(p, 'REFERÊNCIA', 'Tabela de Preços')
    x = M
    y = 180
    # colunas: Produto | Especificação | Linha | Preço(dir)
    c_prod, c_spec, c_lin = 250, 230, 110
    c_preco = CW - c_prod - c_spec - c_lin
    # cabeçalho
    p.add(rect(x, y, CW, 38, bg=PRIMARY, radius=6, name='Cabeçalho'))
    p.add(text(x + 14, y + 9, c_prod, 22, 'PRODUTO', 11, CREAM, font=SANS, weight='bold', ls=1, name='h1'))
    p.add(text(x + 14 + c_prod, y + 9, c_spec, 22, 'ESPECIFICAÇÃO', 11, CREAM, font=SANS, weight='bold', ls=1, name='h2'))
    p.add(text(x + 14 + c_prod + c_spec, y + 9, c_lin, 22, 'LINHA', 11, CREAM, font=SANS, weight='bold', ls=1, name='h3'))
    p.add(text(x + CW - c_preco - 14, y + 9, c_preco, 22, 'PREÇO', 11, CREAM, font=SANS, weight='bold',
               align='right', ls=1, name='h4'))
    y += 38
    rh = 33
    for i, (cat, nome, spec, desc, preco, img) in enumerate(PRODUTOS):
        if i % 2 == 0:
            p.add(rect(x, y, CW, rh, bg=ZEBRA, name='Zebra'))
        p.add(text(x + 14, y + 8, c_prod, 20, nome, 12.5, TEXT, font=SANS, weight='bold', name='c1'))
        p.add(text(x + 14 + c_prod, y + 8, c_spec, 20, spec, 11.5, MUTED, font=SANS, name='c2'))
        p.add(text(x + 14 + c_prod + c_spec, y + 8, c_lin, 20, cat.split(' ')[0], 11.5, SECOND, font=SANS, name='c3'))
        p.add(text(x + CW - c_preco - 14, y + 8, c_preco, 20, f'R$ {preco}', 13, PRIMARY, font=SERIF,
                   weight='bold', align='right', name='c4'))
        y += rh
    p.add(rect(x, y, CW, 1, bg=BORDER, name='Base'))
    # nota B2B
    y += 22
    p.add(rect(x, y, CW, 112, bg=BOXBG, radius=10, bc=BORDER, bw=1, name='Box B2B'))
    p.add(text(x + 20, y + 18, CW - 40, 26, 'Atacado & food service', T_SUB, PRIMARY, font=SERIF,
               weight='bold', name='B2B título'))
    p.add(text(x + 20, y + 50, CW - 40, 50,
               'Acima de 500 un.: -12%   ·   acima de 2.000 un.: -20%   ·   frete CIF a partir de R$ 300.',
               12.5, TEXT, font=SANS, lh=1.45, multi=True, name='B2B texto'))
    return p


def pg_diferenciais(order):
    p = Page('Diferenciais', order)
    header_secao(p, 'POR QUE CRISTALLO', 'Diferenciais')
    itens = [
        ('01', 'Cristal de verdade', 'PET de alta transparência que mostra o produto sem distorcer a cor.'),
        ('02', 'Veda e protege', 'Tampas testadas contra vazamento — seguro para delivery e transporte.'),
        ('03', 'Linha completa', 'Da forminha à sacola: tudo combinando numa só identidade.'),
        ('04', 'Sob medida', 'Personalização com sua marca a partir de tiragens pequenas.'),
    ]
    y = 184
    bh = 150
    for i, (num, tit, txt) in enumerate(itens):
        r, c = divmod(i, 2)
        bx = M + c * (CW // 2 + GUT // 2 if False else (CW - GUT) // 2 + GUT)
        bw = (CW - GUT) // 2
        bx = M + c * (bw + GUT)
        by = y + r * (bh + GUT)
        p.add(rect(bx, by, bw, bh, bg=SURFACE, radius=14, bc=BORDER, bw=1, name='Bloco'))
        p.add(text(bx + 20, by + 18, 60, 40, num, 30, ACCENT, font=SERIF, weight='bold', name='Num'))
        p.add(text(bx + 20, by + 60, bw - 40, 26, tit, T_SUB, TEXT, font=SERIF, weight='bold', name='Tít'))
        p.add(text(bx + 20, by + 88, bw - 40, 50, txt, T_BODY, MUTED, font=SANS, lh=1.4, multi=True, name='Txt'))
    # faixa de chamada
    fy = y + 2 * (bh + GUT) + 6
    p.add(rect(M, fy, CW, 92, bg=PRIMARY, radius=14, name='Faixa CTA'))
    p.add(text(M + 24, fy + 22, CW - 48, 30, 'Monte seu kit e peça uma amostra grátis.', T_SUB + 4,
               CREAM, font=SERIF, weight='bold', name='CTA'))
    p.add(text(M + 24, fy + 54, CW - 48, 24, BRAND['contato']['site'] + '   ·   ' + BRAND['contato']['tel'],
               13, CREAM, font=SANS, ls=1, name='CTA contato'))
    return p


def pg_contracapa(order):
    p = Page('Contracapa', order)
    p.add(rect(0, 0, PAGE_W, PAGE_H, bg=PRIMARY, name='Fundo'))
    p.add(rect(24, 24, PAGE_W - 48, PAGE_H - 48, bc=CREAM, bw=1, name='Moldura'))
    # logo centralizado
    badge = 64
    cx = PAGE_W // 2
    p.add(rect(cx - badge // 2, 300, badge, badge, bg=CREAM, radius=16, name='Selo'))
    p.add(text(cx - badge // 2, 312, badge, 44, 'C', 38, PRIMARY, font=SERIF, weight='bold', align='center', name='Mono'))
    p.add(text(M, 392, CW, 60, BRAND['wordmark'], 40, CREAM, font=SERIF, weight='bold', ls=4, align='center', name='Wordmark'))
    p.add(text(M, 452, CW, 26, BRAND['sub'], 12, ACCENT, font=SANS, ls=4, align='center', name='Sub'))
    regua(p, cx - 36, 502, 72)
    p.add(text(M, 532, CW, 30, BRAND['tagline'], 18, CREAM, font=SERIF, align='center', name='Tagline'))
    # contato
    ct = BRAND['contato']
    linhas = [ct['tel'], ct['email'], ct['site'], ct['end']]
    y = 760
    for ln in linhas:
        p.add(text(M, y, CW, 24, ln, 14, CREAM, font=SANS, align='center', lh=1.5, name='Contato'))
        y += 34
    p.add(text(M, PAGE_H - 96, CW, 22, '© 2026 Cristallo Embalagens · Imagens meramente ilustrativas',
               10.5, ACCENT, font=SANS, align='center', name='Legal'))
    return p


# ============================================================
# Montagem do envelope catalogIO v1.0
# ============================================================
def design_tokens():
    def ct(v):
        return {'value': v}
    return {
        'name': 'Cristallo — Framboesa & Caramelo', 'version': '1.0',
        'description': 'Paleta de marca para embalagens de confeitaria.',
        'colors': {
            'primary': ct(PRIMARY_HEX), 'secondary': ct(SECOND_HEX), 'accent': ct(ACCENT_HEX),
            'background': ct(BG_HEX), 'surface': ct(SURFACE_HEX), 'border': ct(BORDER_HEX),
            'text': {'primary': ct(TEXT_HEX), 'secondary': ct(MUTED_HEX), 'disabled': ct('#BDB3B6')},
            'success': ct('#3F8F5B'), 'warning': ct('#C77D3A'), 'error': ct('#B23A48'), 'info': ct('#3A6EA8'),
        },
        'typography': {
            'h1': {'fontFamily': SERIF, 'fontSize': T_DISPLAY, 'fontWeight': 700, 'lineHeight': 1.1},
            'h2': {'fontFamily': SERIF, 'fontSize': T_TITLE, 'fontWeight': 700, 'lineHeight': 1.2},
            'h3': {'fontFamily': SERIF, 'fontSize': 22, 'fontWeight': 700, 'lineHeight': 1.25},
            'h4': {'fontFamily': SERIF, 'fontSize': T_SUB, 'fontWeight': 700, 'lineHeight': 1.3},
            'h5': {'fontFamily': SANS, 'fontSize': 14, 'fontWeight': 600, 'lineHeight': 1.4},
            'h6': {'fontFamily': SANS, 'fontSize': 12, 'fontWeight': 600, 'lineHeight': 1.4},
            'body': {'fontFamily': SANS, 'fontSize': T_BODY, 'fontWeight': 400, 'lineHeight': 1.6},
            'bodySmall': {'fontFamily': SANS, 'fontSize': 11, 'fontWeight': 400, 'lineHeight': 1.5},
            'bodyLarge': {'fontFamily': SANS, 'fontSize': 18, 'fontWeight': 400, 'lineHeight': 1.6},
            'caption': {'fontFamily': SANS, 'fontSize': 10.5, 'fontWeight': 400, 'lineHeight': 1.4},
            'button': {'fontFamily': SANS, 'fontSize': 13, 'fontWeight': 600, 'lineHeight': 1, 'letterSpacing': 1, 'textTransform': 'uppercase'},
        },
        'spacing': {'base': U, 'xxs': 2, 'xs': 4, 'sm': 8, 'md': 16, 'lg': 24, 'xl': 32, 'xxl': 48, 'xxxl': 64},
        'borderRadius': {'none': 0, 'sm': 4, 'md': 8, 'lg': 14, 'xl': 20, 'full': 9999},
        'shadows': {
            'none': {'value': 'none'}, 'sm': {'value': '0 1px 2px rgba(43,33,38,0.06)'},
            'md': {'value': '0 4px 10px rgba(43,33,38,0.10)'}, 'lg': {'value': '0 12px 24px rgba(43,33,38,0.12)'},
            'xl': {'value': '0 24px 40px rgba(43,33,38,0.16)'},
        },
    }


def build():
    grade_a = PRODUTOS[:6]
    grade_b = PRODUTOS[6:]
    pages = [
        pg_capa(0),
        pg_apresentacao(1),
        pg_indice(2),
        pg_divisor(3),
        pg_grade(4, 'CATÁLOGO · 01', 'Potes, Copos & Caixas', grade_a),
        pg_grade(5, 'CATÁLOGO · 02', 'Delivery & Finalização', grade_b),
        pg_precos(6),
        pg_diferenciais(7),
        pg_contracapa(8),
    ]
    return {
        'app': 'Catana', 'schemaVersion': '1.0',
        'exportedAt': '2026-06-30T12:00:00.000Z',
        'catalog': {
            'name': 'Cristallo — Catálogo 2026',
            'description': 'Embalagens & utensílios para confeitaria e food service.',
        },
        'settings': {'gridSize': 8, 'snapToGrid': True, 'defaultZoom': 75},
        'designTokens': design_tokens(),
        'pages': [p.json() for p in pages],
    }


if __name__ == '__main__':
    env = build()
    out = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'catalogo_cristallo.json')
    with open(out, 'w', encoding='utf-8') as fh:
        json.dump(env, fh, ensure_ascii=False, indent=2)
    n_el = sum(len(p['elements']) for p in env['pages'])
    print(f'OK: {out}')
    print(f'   {len(env["pages"])} páginas, {n_el} elementos')
