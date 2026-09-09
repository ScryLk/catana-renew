"""
Gerador de catálogos de demonstração.

Escreve DIRETO no banco (Organization/Sede/Category/Product/ProductMedia/Media/
Catalog/Page/Component/PageComponent), espelhando exatamente o formato que o
front `catalogLoader.service.ts` reconstrói:

- geometria  -> colunas do PageComponent (position_x/y, width, height, layer)
- resto      -> Component.content (JSON espelho de CatalogElement), com o estilo
                do tema BAKED em valores concretos (não usa design tokens globais)

Página em coordenadas 794 x 1123 (A4 @ 96dpi), igual ao editor/PDF do front.
Imagens são gravadas como URL RELATIVA (/media/...); o front prefixa a base.

Idempotente: regerar o mesmo tema apaga a Organization demo anterior (cascata
remove sedes/categorias/produtos/mídia/catálogo/páginas/componentes) e recria.
"""
import json
import os
from io import BytesIO

from django.conf import settings
from django.core.files import File
from django.core.files.base import ContentFile
from django.db import transaction

from ..models import (
    User, Organization, Sede, Category, Product, ProductMedia, Media,
    Catalog, Page, Component, PageComponent,
)
from .themes import get_theme
from .identidade import computar_identidade
from .perfis import get_perfil, formatar_preco_brl
from . import logo as logo_mod

# ---- Layout (mesmo espaço de coordenadas do front) ----
PAGE_W = 794
PAGE_H = 1123
MARGIN = 56
CONTENT_W = PAGE_W - 2 * MARGIN  # 682

# Seções macro e presets de estrutura.
SECOES_CANONICAS = [
    'capa', 'apresentacao', 'sobre', 'indice', 'divisores', 'produtos',
    'especiais', 'precos', 'como_comprar', 'termos', 'contracapa',
]
ESTRUTURAS = {
    'completo': SECOES_CANONICAS,
    'essencial': ['capa', 'apresentacao', 'produtos', 'como_comprar', 'contracapa'],
}

DEMO_USER = 'catana_demo'


# ============================================================
# Builders de elemento (baked style no content)
# ============================================================

class PageBuilder:
    """Acumula elementos de uma página e cria Component/PageComponent."""

    def __init__(self, catalog, order, org, sede, user):
        self.page = Page.objects.create(catalog=catalog, order=order)
        self.org = org
        self.sede = sede
        self.user = user
        self.layer = 0

    def add(self, content, x, y, w, h):
        comp_type = content.get('type', 'text')
        if comp_type.startswith('text'):
            component_type = 'text'
        elif comp_type in ('image', 'uploaded-image'):
            component_type = 'image'
        else:
            component_type = 'text'  # shapes entram como 'text' (genérico)

        component = Component.objects.create(
            name=content.get('name') or comp_type,
            component_type=component_type,
            content=content,
            is_reusable=False,
            organization=self.org,
            sede=self.sede,
            created_by=self.user,
        )
        PageComponent.objects.create(
            page=self.page,
            component=component,
            position_x=int(round(x)),
            position_y=int(round(y)),
            width=int(round(w)),
            height=int(round(h)),
            layer=self.layer,
        )
        self.layer += 1


def el_rect(bg, radius=0, border_color=None, border_width=0, name='Retângulo', shadow=None):
    # bg aceita cor OU gradiente CSS (o render detecta gradiente em
    # backgroundColor); shadow vira style.boxShadow (sombra real).
    style = {'backgroundColor': bg, 'borderRadius': radius}
    if border_color and border_width:
        style.update({'borderColor': border_color, 'borderWidth': border_width, 'borderStyle': 'solid'})
    if shadow:
        style['boxShadow'] = shadow
    return {'type': 'shape-rectangle', 'name': name, 'style': style}


def el_text(text, size, color, font, weight='normal', align='left', line_height=1.3,
            kind='text-paragraph', name='Texto', letter_spacing=0, italic=False):
    style = {
        'fontFamily': font,
        'fontSize': size,
        'fontWeight': str(weight),
        'textColor': color,
        'textAlign': align,
        'lineHeight': line_height,
        'letterSpacing': letter_spacing,
    }
    if italic:
        # fontStyle só é aplicado pelo render em text-paragraph (vistoria §1.1).
        style['fontStyle'] = 'italic'
    return {
        'type': kind,
        'name': name,
        'style': style,
        'content': {'text': text},
    }


def el_image(src, radius=0, object_fit='cover', name='Imagem'):
    # Grava imageData.src E imageUrl: o canvas usa imageData (ImageFigma) e o
    # preview/PDF usa imageUrl (fallback). Ambos relativos /media/...
    return {
        'type': 'image',
        'name': name,
        'style': {'borderRadius': radius, 'objectFit': object_fit},
        'imageUrl': src,
        'imageData': {
            'src': src,
            'opacity': 1,
            'borderRadius': radius,
            'objectFit': object_fit,
            'aspectRatioLocked': False,
        },
    }


# ============================================================
# Persistência de imagens (padrão dos seed scripts)
# ============================================================

def _criar_media(path, nome, org, sede, user):
    """Cria Media copiando o arquivo local para /media/. Retorna (media, url)."""
    if not path or not os.path.exists(path):
        return None, None
    with open(path, 'rb') as fh:
        media = Media(
            name=os.path.basename(path),
            organization=org,
            sede=sede,
            uploaded_by=user,
            media_type='image',
        )
        media.file.save(os.path.basename(path), File(fh), save=True)
    return media, media.file.url  # url relativa: /media/...


def _media_de_pil(img, nome, org, sede, user):
    """Salva uma imagem PIL como Media (PNG). Retorna (url, largura, altura)."""
    buf = BytesIO()
    img.save(buf, 'PNG')
    buf.seek(0)
    media = Media(
        name=f'{nome}.png', organization=org, sede=sede,
        uploaded_by=user, media_type='image',
    )
    media.file.save(f'{nome}.png', ContentFile(buf.read()), save=True)
    return media.file.url, img.width, img.height


# ============================================================
# Geração
# ============================================================

def _carregar_manifest(tema=None, manifest_path=None):
    if manifest_path:
        path = manifest_path
    else:
        path = os.path.join(settings.BASE_DIR, 'demo_assets', tema, 'manifest.json')
    if not os.path.exists(path):
        raise FileNotFoundError(f'Manifest não encontrado: {path}')
    with open(path, encoding='utf-8') as fh:
        manifest = json.load(fh)
    base_dir = os.path.dirname(path)
    return manifest, base_dir


def _resolver_secoes(estrutura, secoes):
    if estrutura == 'custom':
        pedidas = [s for s in (secoes or []) if s in SECOES_CANONICAS]
        return pedidas or ESTRUTURAS['essencial']
    return ESTRUTURAS.get(estrutura, ESTRUTURAS['completo'])


@transaction.atomic
def gerar_catalogo_demo(tema=None, manifest_path=None, estrutura='completo',
                        secoes=None, b2b=False, periodo=None,
                        identidade_premium=True):
    """
    Gera (ou regenera) o catálogo demo de um tema. Retorna o Catalog criado.

    identidade_premium: aplica a camada de identidade visual (logo, marca em
    cabeçalho/rodapé, capa/divisores/contracapa "designed"). Quando False,
    mantém o catálogo temático limpo base.
    """
    manifest, base_dir = _carregar_manifest(tema, manifest_path)
    tema = manifest.get('tema', tema)
    theme = get_theme(tema)
    cores = theme['paleta']
    # FASE 2: o par tipográfico vem do brand profile (webfonts self-hosted da
    # whitelist + escala explícita), não mais de themes.py.
    perfil = get_perfil(tema)
    fontes = {'titulo': perfil['tipografia']['display'],
              'corpo': perfil['tipografia']['body']}
    empresa = manifest.get('empresa', {})
    secoes_ativas = _resolver_secoes(estrutura, secoes)
    incluir_divisores = 'divisores' in secoes_ativas
    incluir_b2b = b2b and bool(manifest.get('b2b'))

    user, _ = User.objects.get_or_create(
        username=DEMO_USER,
        defaults={'email': 'demo@catana.local', 'role': 'admin'},
    )

    org_name = f'[DEMO] {theme["nome"]}'
    # Idempotência: remove a org demo anterior (cascata limpa tudo abaixo).
    Organization.objects.filter(name=org_name, owner=user).delete()

    org = Organization.objects.create(name=org_name, owner=user)
    sede = Sede.objects.create(name='Matriz', organization=org, responsible_user=user)
    org.default_sede = sede
    org.save(update_fields=['default_sede'])
    user.organizations.add(org)
    user.sedes.add(sede)

    # Categorias
    cat_objs = {}
    for nome_cat in manifest.get('categorias', []):
        cat_objs[nome_cat] = Category.objects.create(
            name=nome_cat, organization=org, sede=sede, created_by=user,
        )

    # Produtos + imagens
    produtos = []
    for idx, p in enumerate(manifest.get('produtos', [])):
        img_path = os.path.join(base_dir, 'images', p.get('imagem', '')) if p.get('imagem') else None
        media, url = _criar_media(img_path, p['nome'], org, sede, user)
        produto = Product.objects.create(
            name=p['nome'],
            description=p.get('descricao', ''),
            price=p.get('preco') or '0',
            sku=f'DEMO-{tema}-{idx:03d}',
            stock=100,
            currency='BRL',
            category=cat_objs.get(p.get('categoria')),
            specs=p.get('specs', []),
            cover_image=media,
            organization=org,
            sede=sede,
            created_by=user,
        )
        if media:
            ProductMedia.objects.create(product=produto, media=media, order=0)
        produtos.append({**p, '_url': url, '_obj': produto})

    # Catálogo
    catalog = Catalog.objects.create(
        title=theme['nome'],
        description=empresa.get('slogan', ''),
        organization=org,
        sede=sede,
        created_by=user,
        is_public=True,
        is_demo=True,
    )

    # Identidade visual (computada uma vez; baked nos elementos).
    ident = computar_identidade(tema, theme, manifest)
    nome_empresa = empresa.get('nome', theme['nome'])
    logos = {}
    if identidade_premium:
        logos['mono'] = _media_de_pil(
            logo_mod.monograma(ident, nome_empresa), f'logo-mono-{tema}', org, sede, user)
        logos['word_claro'] = _media_de_pil(
            logo_mod.wordmark(ident, nome_empresa, cor_texto=ident['paleta']['texto_sobre_primaria']),
            f'logo-word-claro-{tema}', org, sede, user)
        logos['word_escuro'] = _media_de_pil(
            logo_mod.wordmark(ident, nome_empresa, cor_texto=ident['paleta']['primaria']),
            f'logo-word-escuro-{tema}', org, sede, user)
        logos['motivo'] = _media_de_pil(
            logo_mod.motivo_faixa(ident, ident['motivo']), f'motivo-{tema}', org, sede, user)

    order = 0
    ctx = dict(catalog=catalog, org=org, sede=sede, user=user, cores=cores,
               fontes=fontes, empresa=empresa, produtos=produtos, manifest=manifest,
               periodo=periodo, incluir_divisores=incluir_divisores,
               incluir_b2b=incluir_b2b,
               premium=identidade_premium, ident=ident, logos=logos,
               perfil=perfil, num_pagina=[0])

    builders = {
        'capa': _sec_capa,
        'apresentacao': _sec_apresentacao,
        'sobre': _sec_sobre,
        'indice': _sec_indice,
        'produtos': _sec_produtos,
        'especiais': _sec_especiais,
        'precos': _sec_precos,
        'como_comprar': _sec_como_comprar,
        'termos': _sec_termos,
        'contracapa': _sec_contracapa,
    }
    for sec in secoes_ativas:
        if sec in ('divisores',):
            continue  # modificador, não é página própria
        builder = builders.get(sec)
        if not builder:
            continue
        order = builder(ctx, order)

    return catalog


# ---- helpers de seção ----

def _bg(page, cor):
    page.add(el_rect(cor, name='Fundo'), 0, 0, PAGE_W, PAGE_H)


def _faixa(page, cor, y, h):
    page.add(el_rect(cor, name='Faixa'), 0, y, PAGE_W, h)


def _new_page(ctx, order):
    return PageBuilder(ctx['catalog'], order, ctx['org'], ctx['sede'], ctx['user']), order + 1


def _img_aspecto(logos_entry, altura):
    """Dada uma entrada (url, w, h) e uma altura alvo, retorna (url, largura, altura)."""
    url, w, h = logos_entry
    largura = int(altura * (w / h)) if h else altura
    return url, largura, altura


def _marca(page, ctx):
    """Cabeçalho + rodapé de marca nas páginas de conteúdo (apenas premium)."""
    if not ctx['premium']:
        return
    pal = ctx['ident']['paleta']
    fontes = ctx['fontes']
    empresa = ctx['empresa']
    logos = ctx['logos']
    ctx['num_pagina'][0] += 1
    num = ctx['num_pagina'][0]
    # Cabeçalho: monograma + nome.
    if logos.get('mono'):
        page.add(el_image(logos['mono'][0], object_fit='contain', name='Logo'),
                 MARGIN, 22, 34, 34)
    page.add(el_text(empresa.get('nome', ''), 13, pal['texto_suave'], fontes['titulo'],
                     weight='600', name='MarcaNome'), MARGIN + 44, 29, 460, 24)
    # Rodapé: linha de acento + rede social + número da página.
    page.add(el_rect(pal['acento'], name='LinhaRodape'), MARGIN, PAGE_H - 54, CONTENT_W, 2)
    contato = empresa.get('contato', {})
    page.add(el_text(contato.get('instagram', ''), 11, pal['texto_suave'], fontes['corpo'],
                     name='Rodape'), MARGIN, PAGE_H - 44, CONTENT_W - 90, 20)
    page.add(el_text(str(num), 11, pal['texto_suave'], fontes['corpo'], align='right',
                     name='Num'), MARGIN + CONTENT_W - 90, PAGE_H - 44, 90, 20)


def _kicker(page, ctx, texto, x, y, w=300):
    """Rótulo caps espaçado acima de títulos (perfil.escala.kicker).

    Usa text-paragraph (único que aplica letterSpacing) e compensa o padding
    interno de 8px (p-2) para alinhar opticamente com o título abaixo.
    """
    esc = ctx['perfil']['tipografia']['escala']['kicker']
    cor = ctx['perfil']['paleta']['kicker']
    page.add(el_text(texto.upper(), esc['size'], cor, ctx['fontes']['corpo'],
                     weight=esc['weight'], letter_spacing=esc['ls'],
                     line_height=esc['lh'], name='Kicker'),
             x - 8, y - 8, w + 16, 32)


def _lead(page, ctx, texto, x, y, w, h=64):
    """Parágrafo de abertura em itálico (perfil.escala.lead)."""
    esc = ctx['perfil']['tipografia']['escala']['lead']
    page.add(el_text(texto, esc['size'], ctx['perfil']['paleta']['texto'],
                     ctx['fontes']['corpo'], line_height=esc['lh'],
                     italic=True, name='Lead'), x, y, w, h)


def _badge_pill(page, ctx, texto, x, y):
    """Etiqueta pill (acento + texto AA sobre acento). Composta por primitivas."""
    pal = ctx['perfil']['paleta']
    esc = ctx['perfil']['tipografia']['escala']['caption']
    w = int(len(texto) * 7.2) + 24
    page.add(el_rect(pal['acento'], radius=ctx['perfil']['motivos']['pill_radius'],
                     name='BadgePill'), x, y, w, 24)
    page.add(el_text(texto.upper(), esc['size'], pal['texto_sobre_acento'],
                     ctx['fontes']['corpo'], weight=esc['weight'], align='center',
                     kind='text-title', name='BadgeTexto'), x, y + 1, w, 22)
    return w


def el_qr(url, cor, label=None):
    """QR de marca (qr-code é o único tipo rico renderizado — vistoria §1.1)."""
    return {
        'type': 'qr-code',
        'name': 'QR',
        'qrCodeData': {
            'destinationType': 'url',
            'customUrl': url,
            'data': url,
            'color': cor,
            'backgroundColor': '#FFFFFF',
            'errorCorrection': 'M',
            'margin': 2,
            'quality': 'high',
            'trackScans': False,
            **({'label': label} if label else {}),
        },
    }


def _sec_capa(ctx, order):
    (page, order), cores, fontes, empresa = _new_page(ctx, order), ctx['cores'], ctx['fontes'], ctx['empresa']
    if ctx['premium']:
        return _capa_premium(ctx, page, order)
    _bg(page, cores['primary'])
    hero = ctx['produtos'][0]['_url'] if ctx['produtos'] else None
    if hero:
        page.add(el_image(hero, radius=18, name='Hero'), MARGIN, 130, CONTENT_W, 430)
    page.add(el_rect(cores['accent'], radius=3, name='Régua'), MARGIN, 600, 90, 6)
    page.add(el_text(empresa.get('nome', ctx['manifest'].get('tema', '')), 54,
                     cores['textOnPrimary'], fontes['titulo'], weight='bold',
                     align='left', kind='text-title', name='Nome'),
             MARGIN, 626, CONTENT_W, 130)
    page.add(el_text(empresa.get('slogan', ''), 26, cores['accent'], fontes['corpo'],
                     align='left', name='Slogan'), MARGIN, 760, CONTENT_W, 70)
    rotulo = ctx['periodo'] or 'Catálogo de produtos'
    page.add(el_text(rotulo.upper(), 16, cores['textOnPrimary'], fontes['corpo'],
                     align='left', letter_spacing=2, name='Rótulo'),
             MARGIN, 1030, CONTENT_W, 40)
    return order


def _capa_premium(ctx, page, order):
    pal = ctx['ident']['paleta']
    fontes = ctx['fontes']
    empresa = ctx['empresa']
    logos = ctx['logos']
    raio = ctx['ident']['tokens']['raio']
    # Fundo na cor primária + bloco de acento lateral.
    _bg(page, pal['primaria'])
    page.add(el_rect(ctx['perfil']['motivos']['gradiente_marca'], name='BlocoAcento'),
             0, 0, 16, PAGE_H)
    # Foto hero grande no topo, com overlay rgba (substituto aprovado de filtro:
    # alfa DENTRO da cor — sobrevive a canvas e PDF) + caption informativa.
    hero = ctx['produtos'][0]['_url'] if ctx['produtos'] else None
    if hero:
        page.add(el_image(hero, radius=raio, name='Hero'), MARGIN, 120, CONTENT_W, 470)
        page.add(el_rect(ctx['perfil']['motivos']['overlay_hero'], radius=raio,
                         name='OverlayHero'), MARGIN, 120, CONTENT_W, 470)
        n_prod = len(ctx['produtos'])
        n_cat = len(ctx['manifest'].get('categorias', []))
        esc_cap = ctx['perfil']['tipografia']['escala']['caption']
        page.add(el_text(f'{n_prod} PRODUTOS  ·  {n_cat} CATEGORIAS', esc_cap['size'] + 1,
                         ctx['perfil']['paleta']['texto_sobre_overlay'], ctx['fontes']['corpo'],
                         weight=esc_cap['weight'], letter_spacing=2,
                         name='CaptionHero'), MARGIN + 16, 120 + 470 - 40, CONTENT_W - 32, 30)
    # Faixa do motivo gráfico abaixo da foto.
    if logos.get('motivo'):
        page.add(el_image(logos['motivo'][0], object_fit='cover', name='Motivo'),
                 MARGIN, 612, CONTENT_W, 56)
    # Wordmark (versão clara) como assinatura principal.
    if logos.get('word_claro'):
        url, lw, lh = _img_aspecto(logos['word_claro'], 120)
        page.add(el_image(url, object_fit='contain', name='Wordmark'),
                 MARGIN, 700, min(lw, CONTENT_W), 120)
    else:
        page.add(el_text(empresa.get('nome', ''), 54, pal['texto_sobre_primaria'],
                         fontes['titulo'], weight='bold', kind='text-title', name='Nome'),
                 MARGIN, 700, CONTENT_W, 120)
    # Slogan + régua de acento.
    page.add(el_rect(pal['acento'], radius=3, name='Régua'), MARGIN, 838, 90, 6)
    page.add(el_text(empresa.get('slogan', ''), 26, pal['texto_sobre_primaria'],
                     fontes['corpo'], name='Slogan'), MARGIN, 858, CONTENT_W, 60)
    rotulo = ctx['periodo'] or 'Catálogo de produtos'
    page.add(el_text(rotulo.upper(), 15, pal['acento'], fontes['corpo'],
                     letter_spacing=3, name='Rótulo'), MARGIN, 1040, CONTENT_W, 36)
    return order


def _sec_apresentacao(ctx, order):
    (page, order), cores, fontes, empresa = _new_page(ctx, order), ctx['cores'], ctx['fontes'], ctx['empresa']
    _bg(page, ctx['ident']['paleta']['fundo'] if ctx['premium'] else cores['background'])
    _marca(page, ctx)
    if ctx['premium']:
        # Hierarquia editorial: kicker -> título -> lead itálico -> corpo.
        _kicker(page, ctx, 'A marca', MARGIN, 92)
        page.add(el_text('Bem-vindo', 42, cores['primary'], fontes['titulo'], weight='bold',
                         kind='text-title', name='Título'), MARGIN, 118, CONTENT_W, 70)
        page.add(el_rect(cores['accent'], radius=3, name='Régua'), MARGIN, 196, 80, 5)
        if empresa.get('slogan'):
            _lead(page, ctx, f'“{empresa["slogan"]}”', MARGIN, 226, CONTENT_W, 60)
        esc_body = ctx['perfil']['tipografia']['escala']['body']
        page.add(el_text(empresa.get('sobre', ''), esc_body['size'] + 4, cores['text'],
                         fontes['corpo'], line_height=esc_body['lh'], name='Intro'),
                 MARGIN, 300, CONTENT_W, 160)
    else:
        page.add(el_text('Bem-vindo', 42, cores['primary'], fontes['titulo'], weight='bold',
                         kind='text-title', name='Título'), MARGIN, 110, CONTENT_W, 80)
        page.add(el_rect(cores['accent'], radius=3, name='Régua'), MARGIN, 196, 80, 5)
        page.add(el_text(empresa.get('sobre', ''), 20, cores['text'], fontes['corpo'],
                         line_height=1.6, name='Intro'), MARGIN, 232, CONTENT_W, 220)
    img = ctx['produtos'][1]['_url'] if len(ctx['produtos']) > 1 else (
        ctx['produtos'][0]['_url'] if ctx['produtos'] else None)
    if img:
        page.add(el_image(img, radius=16, name='Imagem'), MARGIN, 480, CONTENT_W, 470)
    return order


def _sec_sobre(ctx, order):
    (page, order), cores, fontes, empresa = _new_page(ctx, order), ctx['cores'], ctx['fontes'], ctx['empresa']
    if ctx['premium']:
        pal = ctx['ident']['paleta']
        _bg(page, pal['fundo'])
        _marca(page, ctx)
        page.add(el_text('Sobre a empresa', 34, pal['primaria'], fontes['titulo'],
                         weight='bold', kind='text-title', name='Título'), MARGIN, 96, CONTENT_W, 60)
        page.add(el_rect(pal['acento'], radius=3, name='Régua'), MARGIN, 162, 80, 5)
        tcor = pal['texto']
    else:
        _bg(page, cores['surface'])
        _faixa(page, cores['primary'], 0, 150)
        page.add(el_text('Sobre a empresa', 34, cores['textOnPrimary'], fontes['titulo'],
                         weight='bold', kind='text-title', name='Título'), MARGIN, 54, CONTENT_W, 60)
        tcor = cores['text']
    page.add(el_text(empresa.get('sobre', ''), 19, tcor, fontes['corpo'],
                     line_height=1.7, name='Texto'), MARGIN, 210, CONTENT_W, 320)
    contato = empresa.get('contato', {})
    linhas = [
        ('Telefone', contato.get('telefone')),
        ('Endereço', contato.get('endereco')),
        ('Instagram', contato.get('instagram')),
        ('WhatsApp', contato.get('whatsapp')),
    ]
    y = 580
    page.add(el_text('Contato', 24, cores['primary'], fontes['titulo'], weight='bold',
                     name='Contato'), MARGIN, y, CONTENT_W, 44)
    y += 56
    for rotulo, valor in linhas:
        if not valor:
            continue
        page.add(el_text(f'{rotulo}:  {valor}', 18, cores['textMuted'], fontes['corpo'],
                         name=rotulo), MARGIN, y, CONTENT_W, 36)
        y += 44
    return order


def _sec_indice(ctx, order):
    (page, order), cores, fontes = _new_page(ctx, order), ctx['cores'], ctx['fontes']
    _bg(page, cores['background'])
    _marca(page, ctx)
    if ctx['premium']:
        _kicker(page, ctx, 'Navegação', MARGIN, 92)
    page.add(el_text('Índice', 40, cores['primary'], fontes['titulo'], weight='bold',
                     kind='text-title', name='Título'), MARGIN, 110, CONTENT_W, 80)
    page.add(el_rect(cores['accent'], radius=3, name='Régua'), MARGIN, 196, 80, 5)
    y = 250
    for i, cat in enumerate(ctx['manifest'].get('categorias', []), start=1):
        page.add(el_text(f'{i:02d}', 22, cores['accent'], fontes['titulo'], weight='bold',
                         name='Num'), MARGIN, y, 60, 36)
        page.add(el_text(cat, 22, cores['text'], fontes['corpo'], name='Cat'),
                 MARGIN + 70, y, CONTENT_W - 70, 36)
        page.add(el_rect(cores['border'], name='Linha'), MARGIN, y + 46, CONTENT_W, 1)
        y += 64
    return order


def _card_produto(ctx, page, prod, x, y, w, h):
    # Premium-aware (HEAD) + layout ancorado do main: nome -> descrição (ocupa o
    # vão) -> preço no rodapé. O renderer recorta o overflow (overflow-hidden),
    # então a descrição longa não invade o preço.
    cores, fontes = ctx['cores'], ctx['fontes']
    if ctx['premium']:
        pal = ctx['ident']['paleta']
        raio = ctx['ident']['tokens']['raio']
        # Sombra SIMULADA (rect rgba offset): boxShadow real renderiza no canvas
        # mas o html2canvas não rasteriza no PDF (gate desta sessão) — regra:
        # degradou no PDF, não entra na geração.
        page.add(el_rect(ctx['perfil']['motivos']['sombra_simulada'], radius=raio,
                         name='Sombra'), x + 4, y + 7, w, h)
        card_bg, borda = pal['neutro_claro'], pal['neutro_escuro']
        nome_cor, preco_cor, desc_cor = pal['texto'], pal['acento'], pal['texto_suave']
    else:
        raio = 14
        card_bg, borda = cores['surface'], cores['border']
        nome_cor, preco_cor, desc_cor = cores['text'], cores['primary'], cores['textMuted']

    page.add(el_rect(card_bg, radius=raio, border_color=borda, border_width=1, name='Card'),
             x, y, w, h)
    pad = 16
    img_h = int(h * 0.44)
    if prod.get('_url'):
        page.add(el_image(prod['_url'], radius=max(0, raio - 4), name='Foto'),
                 x + 10, y + 10, w - 20, img_h - 10)
    # Etiqueta pill sobre a foto (ex.: "Mais vendido") — só premium e se houver.
    if ctx['premium'] and prod.get('badge'):
        _badge_pill(page, ctx, prod['badge'], x + 18, y + 18)
    name_y = y + img_h + 8
    name_h = 24                               # 1 linha (nomes dos manifests cabem)
    price_h = 30
    price_y = y + h - 12 - price_h            # preço ancorado no rodapé
    # Nome = 1 linha -> text-title (sem p-2/clip; parágrafo cortava descendentes).
    page.add(el_text(prod['nome'], 17, nome_cor, fontes['titulo'], weight='bold',
                     kind='text-title', name='Nome'), x + pad, name_y, w - 2 * pad, name_h)
    # Linha de especificação em caps (specs do manifest) — premium.
    desc_y = name_y + name_h + 2
    if ctx['premium'] and prod.get('specs'):
        esc_cap = ctx['perfil']['tipografia']['escala']['caption']
        spec_txt = '  ·  '.join(
            f"{s.get('label', '')} {s.get('value', '')}".strip()
            for s in prod['specs'][:2]
        ).upper()
        page.add(el_text(spec_txt, esc_cap['size'], preco_cor, fontes['corpo'],
                         weight=esc_cap['weight'], letter_spacing=esc_cap['ls'],
                         line_height=esc_cap['lh'], name='Specs'),
                 x + pad - 8, desc_y - 8, w - 2 * pad + 16, 26)
        desc_y += 20
    desc_h = max(24, price_y - desc_y - 6)    # descrição ocupa o vão até o preço
    # No card do grid entra só a PRIMEIRA frase (a descrição completa aparece
    # nos Destaques) — evita corte no meio de palavra pelo overflow-hidden.
    descricao = (prod.get('descricao', '') or '').strip()
    primeira_frase = descricao.split('. ')[0].rstrip('.')
    if primeira_frase:
        primeira_frase += '.'
    page.add(el_text(primeira_frase, 12, desc_cor, fontes['corpo'],
                     line_height=1.35, name='Desc'), x + pad, desc_y, w - 2 * pad, desc_h)
    page.add(el_text(formatar_preco_brl(prod.get('preco', '0')), 21, preco_cor,
                     fontes['titulo'], weight='bold', name='Preço'),
             x + pad, price_y, w - 2 * pad, price_h)


def _divisor_categoria(ctx, page, categoria):
    """Cabeçalho de categoria. Premium: faixa full-bleed com acento + motivo."""
    cores, fontes = ctx['cores'], ctx['fontes']
    if ctx['premium']:
        pal = ctx['ident']['paleta']
        page.add(el_rect(pal['primaria'], name='FaixaCat'), 0, 0, PAGE_W, 132)
        page.add(el_rect(pal['acento'], name='AcentoCat'), 0, 132, PAGE_W, 6)
        if ctx['logos'].get('motivo'):
            page.add(el_image(ctx['logos']['motivo'][0], object_fit='cover', name='Motivo'),
                     0, 86, PAGE_W, 40)
        page.add(el_text(categoria, 38, pal['texto_sobre_primaria'], fontes['titulo'],
                         weight='bold', kind='text-title', name='Categoria'),
                 MARGIN, 40, CONTENT_W, 60)
    elif ctx['incluir_divisores']:
        _faixa(page, cores['primary'], 0, 120)
        page.add(el_text(categoria, 32, cores['textOnPrimary'], fontes['titulo'],
                         weight='bold', kind='text-title', name='Categoria'),
                 MARGIN, 40, CONTENT_W, 56)
    else:
        page.add(el_text(categoria, 30, cores['primary'], fontes['titulo'],
                         weight='bold', kind='text-title', name='Categoria'),
                 MARGIN, 90, CONTENT_W, 56)


def _sec_produtos(ctx, order):
    cores, fontes = ctx['cores'], ctx['fontes']
    # Agrupa por categoria, na ordem do manifest.
    por_cat = {}
    for prod in ctx['produtos']:
        por_cat.setdefault(prod.get('categoria', 'Produtos'), []).append(prod)

    cols, rows = 2, 3
    gap = 28
    card_w = (CONTENT_W - gap) / cols
    top0 = 200
    card_h = (PAGE_H - top0 - MARGIN - 24 - gap * (rows - 1)) / rows

    def bg_pagina(page):
        _bg(page, ctx['ident']['paleta']['fundo'] if ctx['premium'] else cores['background'])

    for categoria, itens in por_cat.items():
        page, order = _new_page(ctx, order)
        bg_pagina(page)
        _marca(page, ctx)
        _divisor_categoria(ctx, page, categoria)
        slot = 0
        for prod in itens:
            if slot == cols * rows:
                page, order = _new_page(ctx, order)
                bg_pagina(page)
                _marca(page, ctx)
                cont_cor = ctx['ident']['paleta']['primaria'] if ctx['premium'] else cores['primary']
                page.add(el_text(f'{categoria} (cont.)', 24, cont_cor,
                                 fontes['titulo'], weight='bold', kind='text-title',
                                 name='Categoria'), MARGIN, 96, CONTENT_W, 50)
                slot = 0
            r, cidx = divmod(slot, cols)
            x = MARGIN + cidx * (card_w + gap)
            y = top0 + r * (card_h + gap)
            _card_produto(ctx, page, prod, x, y, card_w, card_h)
            slot += 1
    return order


def _sec_especiais(ctx, order):
    (page, order), cores, fontes = _new_page(ctx, order), ctx['cores'], ctx['fontes']
    if ctx['premium']:
        pal = ctx['ident']['paleta']
        _bg(page, pal['fundo'])
        _marca(page, ctx)
        titulo_cor, card_bg = pal['primaria'], pal['neutro_claro']
        nome_cor, desc_cor, preco_cor = pal['texto'], pal['texto_suave'], pal['acento']
        acento = pal['acento']
    else:
        _bg(page, cores['primary'])
        titulo_cor, card_bg = cores['textOnPrimary'], cores['surface']
        nome_cor, desc_cor, preco_cor = cores['text'], cores['textMuted'], cores['primary']
        acento = cores['accent']
    page.add(el_text('Destaques da casa', 40, titulo_cor, fontes['titulo'],
                     weight='bold', kind='text-title', name='Título'), MARGIN, 90, CONTENT_W, 70)
    page.add(el_rect(acento, radius=3, name='Régua'), MARGIN, 168, 90, 6)
    destaques = ctx['produtos'][:3]
    y = 220
    for prod in destaques:
        page.add(el_rect(card_bg, radius=14, name='Card'), MARGIN, y, CONTENT_W, 230)
        if prod.get('_url'):
            page.add(el_image(prod['_url'], radius=12, name='Foto'), MARGIN + 14, y + 14, 280, 202)
        if ctx['premium']:
            _badge_pill(page, ctx, prod.get('badge') or 'Destaque', MARGIN + 24, y + 24)
        tx = MARGIN + 320
        page.add(el_text(prod['nome'], 26, nome_cor, fontes['titulo'], weight='bold',
                         name='Nome'), tx, y + 24, CONTENT_W - 340, 44)
        page.add(el_text(prod.get('descricao', ''), 15, desc_cor, fontes['corpo'],
                         line_height=1.5, name='Desc'), tx, y + 76, CONTENT_W - 340, 90)
        page.add(el_text(formatar_preco_brl(prod.get('preco', '0')), 26, preco_cor,
                         fontes['titulo'], weight='bold', name='Preço'),
                 tx, y + 170, CONTENT_W - 340, 40)
        y += 254
    return order


def _sec_precos(ctx, order):
    (page, order), cores, fontes = _new_page(ctx, order), ctx['cores'], ctx['fontes']
    _bg(page, ctx['ident']['paleta']['fundo'] if ctx['premium'] else cores['background'])
    _marca(page, ctx)
    if ctx['premium']:
        _kicker(page, ctx, 'Referência', MARGIN, 82)
    page.add(el_text('Tabela de preços', 38, cores['primary'], fontes['titulo'],
                     weight='bold', kind='text-title', name='Título'), MARGIN, 100, CONTENT_W, 70)
    page.add(el_rect(cores['accent'], radius=3, name='Régua'), MARGIN, 176, 80, 5)
    y = 220
    # Zebra premium: primária com alfa (rgba na COR — nunca style.opacity).
    zebra = ctx['perfil']['motivos']['zebra'] if ctx['premium'] else cores['surface']
    # cabeçalho
    page.add(el_rect(cores['primary'], name='Cab'), MARGIN, y, CONTENT_W, 44)
    page.add(el_text('Produto', 16, cores['textOnPrimary'], fontes['corpo'], weight='bold',
                     name='h1'), MARGIN + 16, y + 10, CONTENT_W - 340, 28)
    if ctx['premium']:
        page.add(el_text('Especificação', 16, cores['textOnPrimary'], fontes['corpo'],
                         weight='bold', name='h3'), MARGIN + CONTENT_W - 330, y + 10, 150, 28)
    page.add(el_text('Preço', 16, cores['textOnPrimary'], fontes['corpo'], weight='bold',
                     align='right', name='h2'), MARGIN + CONTENT_W - 180, y + 10, 164, 28)
    y += 44
    for i, prod in enumerate(ctx['produtos']):
        if y > PAGE_H - 200:
            break
        if i % 2 == 0:
            page.add(el_rect(zebra, name='Linha'), MARGIN, y, CONTENT_W, 38)
        page.add(el_text(prod['nome'], 15, cores['text'], fontes['corpo'], name='p'),
                 MARGIN + 16, y + 8, CONTENT_W - 340, 26)
        if ctx['premium']:
            spec0 = (prod.get('specs') or [{}])[0]
            spec_txt = f"{spec0.get('label', '')} {spec0.get('value', '')}".strip()
            page.add(el_text(spec_txt, 12, cores['textMuted'], fontes['corpo'], name='s'),
                     MARGIN + CONTENT_W - 330, y + 10, 150, 24)
        page.add(el_text(formatar_preco_brl(prod.get('preco', '0')), 15, cores['primary'],
                         fontes['corpo'], weight='bold', align='right', name='v'),
                 MARGIN + CONTENT_W - 180, y + 8, 164, 26)
        y += 38

    if ctx['incluir_b2b']:
        b2b = ctx['manifest']['b2b']
        y += 24
        page.add(el_text(b2b.get('titulo', 'Atacado'), 24, cores['primary'], fontes['titulo'],
                         weight='bold', name='B2B'), MARGIN, y, CONTENT_W, 40)
        y += 50
        fgap = 16
        fw = (CONTENT_W - 2 * fgap) / 3
        for j, faixa in enumerate(b2b.get('faixas', [])[:3]):
            fx = MARGIN + j * (fw + fgap)
            page.add(el_rect(cores['surface'], radius=12, border_color=cores['border'],
                             border_width=1, name='Faixa'), fx, y, fw, 110)
            page.add(el_text(faixa.get('quantidade', ''), 16, cores['textMuted'],
                             fontes['corpo'], align='center', name='q'), fx, y + 18, fw, 30)
            page.add(el_text(faixa.get('desconto', ''), 28, cores['primary'], fontes['titulo'],
                             weight='bold', align='center', name='d'), fx, y + 52, fw, 44)
        obs = b2b.get('observacao')
        if obs:
            page.add(el_text(obs, 14, cores['textMuted'], fontes['corpo'], line_height=1.5,
                             name='Obs'), MARGIN, y + 130, CONTENT_W, 60)
    return order


def _sec_como_comprar(ctx, order):
    (page, order), cores, fontes, empresa = _new_page(ctx, order), ctx['cores'], ctx['fontes'], ctx['empresa']
    _bg(page, ctx['ident']['paleta']['fundo'] if ctx['premium'] else cores['background'])
    _marca(page, ctx)
    if ctx['premium']:
        _kicker(page, ctx, 'Passo a passo', MARGIN, 92)
    page.add(el_text('Como comprar', 40, cores['primary'], fontes['titulo'], weight='bold',
                     kind='text-title', name='Título'), MARGIN, 110, CONTENT_W, 80)
    page.add(el_rect(cores['accent'], radius=3, name='Régua'), MARGIN, 196, 80, 5)
    contato = empresa.get('contato', {})
    passos = [
        ('1', 'Escolha seus produtos', 'Navegue pelo catálogo e monte sua lista.'),
        ('2', 'Faça seu pedido', f'Chame no WhatsApp {contato.get("whatsapp", "")} ou ligue {contato.get("telefone", "")}.'),
        ('3', 'Retire ou receba', f'Retire na loja ({contato.get("endereco", "")}) ou peça entrega.'),
    ]
    y = 250
    for num, titulo, desc in passos:
        page.add(el_rect(cores['primary'], radius=24, name='Bolha'), MARGIN, y, 48, 48)
        page.add(el_text(num, 24, cores['textOnPrimary'], fontes['titulo'], weight='bold',
                         align='center', name='N'), MARGIN, y + 8, 48, 32)
        page.add(el_text(titulo, 24, cores['text'], fontes['titulo'], weight='bold',
                         name='T'), MARGIN + 70, y, CONTENT_W - 70, 38)
        page.add(el_text(desc, 17, cores['textMuted'], fontes['corpo'], line_height=1.5,
                         name='D'), MARGIN + 70, y + 40, CONTENT_W - 70, 60)
        y += 130
    return order


def _sec_termos(ctx, order):
    (page, order), cores, fontes = _new_page(ctx, order), ctx['cores'], ctx['fontes']
    _bg(page, ctx['ident']['paleta']['fundo'] if ctx['premium'] else cores['surface'])
    _marca(page, ctx)
    if ctx['premium']:
        _kicker(page, ctx, 'Informações', MARGIN, 92)
    page.add(el_text('Termos e condições', 32, cores['primary'], fontes['titulo'],
                     weight='bold', kind='text-title', name='Título'), MARGIN, 110, CONTENT_W, 60)
    page.add(el_rect(cores['accent'], radius=3, name='Régua'), MARGIN, 176, 80, 5)
    termos = (
        '• Preços e disponibilidade sujeitos a alteração sem aviso prévio.\n'
        '• Imagens meramente ilustrativas.\n'
        '• Pedidos de atacado com antecedência mínima de 24 horas.\n'
        '• Produtos artesanais podem apresentar pequenas variações.\n'
        '• Este é um catálogo de demonstração, sem valor comercial.'
    )
    page.add(el_text(termos, 18, cores['text'], fontes['corpo'], line_height=1.9,
                     name='Termos'), MARGIN, 220, CONTENT_W, 400)
    return order


def _sec_contracapa(ctx, order):
    (page, order), cores, fontes, empresa = _new_page(ctx, order), ctx['cores'], ctx['fontes'], ctx['empresa']
    pal = ctx['ident']['paleta'] if ctx['premium'] else None
    primaria = pal['primaria'] if pal else cores['primary']
    sobre_prim = pal['texto_sobre_primaria'] if pal else cores['textOnPrimary']
    acento = pal['acento'] if pal else cores['accent']
    _bg(page, primaria)
    faixa_topo = ctx['perfil']['motivos']['gradiente_marca'] if ctx['premium'] else acento
    page.add(el_rect(faixa_topo, name='BlocoAcento'), 0, 0, PAGE_W, 12)

    if ctx['premium']:
        # Logo (wordmark claro) no topo + motivo.
        if ctx['logos'].get('word_claro'):
            url, lw, lh = _img_aspecto(ctx['logos']['word_claro'], 110)
            page.add(el_image(url, object_fit='contain', name='Wordmark'),
                     (PAGE_W - min(lw, CONTENT_W)) // 2, 230, min(lw, CONTENT_W), 110)
        if ctx['logos'].get('motivo'):
            page.add(el_image(ctx['logos']['motivo'][0], object_fit='cover', name='Motivo'),
                     MARGIN, 380, CONTENT_W, 40)

    page.add(el_text('Faça seu pedido', 50, sobre_prim, fontes['titulo'], weight='bold',
                     align='center', kind='text-title', name='CTA'), MARGIN, 470, CONTENT_W, 80)
    page.add(el_text(empresa.get('slogan', ''), 24, acento, fontes['corpo'],
                     align='center', name='Slogan'), MARGIN, 580, CONTENT_W, 50)
    # Bloco de contato em cartão.
    contato = empresa.get('contato', {})
    cy = 700
    page.add(el_rect(sobre_prim, radius=14, name='CartãoContato'), MARGIN + 80, cy, CONTENT_W - 160, 200)
    linhas = [v for v in [
        contato.get('whatsapp') and f'WhatsApp  {contato.get("whatsapp")}',
        contato.get('telefone') and f'Telefone  {contato.get("telefone")}',
        contato.get('instagram'),
        contato.get('endereco'),
    ] if v]
    ly = cy + 28
    for ln in linhas:
        page.add(el_text(ln, 17, primaria, fontes['corpo'], align='center', name='Contato'),
                 MARGIN + 80, ly, CONTENT_W - 160, 30)
        ly += 40

    # QR de marca (premium): aponta para o Instagram; cores da identidade.
    if ctx['premium'] and contato.get('instagram'):
        handle = contato['instagram'].lstrip('@').strip()
        if handle:
            qr_w = 132
            page.add(el_qr(f'https://instagram.com/{handle}', primaria,
                           label=contato['instagram']),
                     (PAGE_W - qr_w) // 2, cy + 220, qr_w, 160)
    return order
