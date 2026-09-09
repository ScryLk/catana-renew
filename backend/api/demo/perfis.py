"""
Brand profiles por setor — FASE 2 do enriquecimento visual dos catálogos demo.

Cada perfil resolve, EM VALORES CONCRETOS (bake por elemento; nada de $tokens.*):

- paleta completa (primária/secundária/acento + neutros + textos) com os pares
  texto/fundo verificados programaticamente (WCAG AA: >= 4.5 corpo, >= 3.0 para
  texto grande/suave) — pares reprovados são corrigidos via `melhor_texto` e
  revalidados; se ainda falhar, `get_perfil` levanta erro (nunca gera ilegível);
- par tipográfico display+body APENAS da whitelist real (webfonts self-hosted
  em catana-front/public/fonts + web-safe do SO), com escala explícita
  (tamanho/peso/lineHeight/letterSpacing por nível);
- ritmo de espaçamento (unidade base e múltiplos);
- motivos gráficos reproduzíveis com o vocabulário real do render
  (docs/VISTORIA_VISUAL_CATALOGOS.md §1.1): rects, overlays rgba (alfa DENTRO
  da cor — `style.opacity` diverge canvas×PDF e é proibida), pills, filetes.

A paleta parte de themes.py (fonte histórica das cores por tema) e adiciona os
papéis que faltavam. O gerador NÃO deve ler themes.py diretamente para estilo
novo — o perfil é a fonte única da FASE 2.
"""
from .identidade import contraste, melhor_texto, _luminancia
from .themes import THEMES

# ---------------------------------------------------------------------------
# Whitelist tipográfica (webfonts self-hosted + web-safe; §1.3 da vistoria)
# ---------------------------------------------------------------------------
F_PLAYFAIR = "'Playfair Display', Georgia, serif"          # display serif premium
F_MONTSERRAT = "Montserrat, 'Trebuchet MS', sans-serif"    # display geométrico
F_INTER = "Inter, Arial, sans-serif"                       # corpo/UI
F_GEORGIA = "Georgia, 'Times New Roman', serif"            # serif de sistema
F_ARIAL_BLACK = "'Arial Black', Arial, sans-serif"         # impacto (fallback)

# Escala tipográfica base (papel -> dict). `italic` só em text-paragraph
# (render não aplica fontStyle em text-title); `ls` (letterSpacing) idem —
# por isso kicker/caption são sempre parágrafos no gerador.
ESCALA_BASE = {
    'display': {'size': 46, 'weight': '700', 'lh': 1.1, 'ls': 0},
    'h1':      {'size': 34, 'weight': '700', 'lh': 1.15, 'ls': 0},
    'h2':      {'size': 22, 'weight': '700', 'lh': 1.2, 'ls': 0},
    'h3':      {'size': 17, 'weight': '600', 'lh': 1.25, 'ls': 0},
    'lead':    {'size': 19, 'weight': '400', 'lh': 1.55, 'ls': 0, 'italic': True},
    'body':    {'size': 14, 'weight': '400', 'lh': 1.55, 'ls': 0},
    'small':   {'size': 12, 'weight': '400', 'lh': 1.45, 'ls': 0},
    'caption': {'size': 10.5, 'weight': '600', 'lh': 1.3, 'ls': 1},
    'kicker':  {'size': 12, 'weight': '600', 'lh': 1.2, 'ls': 3},
    'preco':   {'size': 21, 'weight': '700', 'lh': 1.1, 'ls': 0},
}

# Par tipográfico por tema (display = títulos/preço; body = todo o resto).
_PARES = {
    'padaria':     {'display': F_PLAYFAIR, 'body': F_INTER},
    'acougue':     {'display': F_MONTSERRAT, 'body': F_INTER},
    'mercado':     {'display': F_MONTSERRAT, 'body': F_INTER},
    'restaurante': {'display': F_PLAYFAIR, 'body': F_INTER},
    'festas':      {'display': F_MONTSERRAT, 'body': F_INTER},
    'boutique':    {'display': F_PLAYFAIR, 'body': F_INTER},
}

# Overlay do hero/capa por tema (alfa embutido na COR — nunca style.opacity).
_OVERLAYS = {
    'padaria':     'rgba(43, 26, 12, 0.38)',
    'acougue':     'rgba(20, 8, 10, 0.45)',
    'mercado':     'rgba(12, 36, 16, 0.38)',
    'restaurante': 'rgba(22, 10, 14, 0.45)',
    'festas':      'rgba(30, 8, 28, 0.40)',
    'boutique':    'rgba(16, 14, 12, 0.42)',
}


def _zebra(hex_primaria):
    """Zebra de tabela: primária com alfa baixo (rgba dentro da cor)."""
    h = hex_primaria.lstrip('#')
    r, g, b = int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)
    return f'rgba({r}, {g}, {b}, 0.07)'


def _aprofundar_para_texto(cor, texto='#FFFFFF', minimo=4.5):
    """Escurece a cor (mantendo o matiz) até `texto` passar AA sobre ela.

    Resolve primárias de tom médio (ex.: rosa de 'festas') que não alcançam
    4.5 nem com branco nem com preto. Retorna a cor ajustada.
    """
    h = cor.lstrip('#')
    r, g, b = int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)
    for _ in range(24):
        if contraste(texto, f'#{r:02X}{g:02X}{b:02X}') >= minimo:
            break
        r, g, b = int(r * 0.92), int(g * 0.92), int(b * 0.92)
    return f'#{r:02X}{g:02X}{b:02X}'


def _montar_perfil(tema):
    theme = THEMES[tema]
    p = theme['paleta']
    par = _PARES.get(tema, {'display': F_GEORGIA, 'body': F_INTER})

    # Primária usada como FUNDO de texto (faixas, cabeçalho de tabela, capa):
    # se nem claro nem escuro alcançarem AA sobre ela, aprofunda o tom.
    primaria = p['primary']
    if contraste(melhor_texto(primaria), primaria) < 4.5:
        primaria = _aprofundar_para_texto(primaria)

    paleta = {
        'primaria': primaria,
        'primaria_viva': p['primary'],   # tom original (acentos/shapes sem texto)
        'secundaria': p['secondary'],
        'acento': p['accent'],
        'fundo': p['background'],
        'superficie': p['surface'],
        'neutro_borda': p['border'],
        'texto': p['text'],
        'texto_suave': p['textMuted'],
        'texto_sobre_primaria': p['textOnPrimary'],
        'texto_sobre_acento': melhor_texto(p['accent']),
        'texto_sobre_overlay': '#FFF8F0',
    }

    perfil = {
        'tema': tema,
        'nome': theme['nome'],
        'paleta': paleta,
        'tipografia': {
            'display': par['display'],
            'body': par['body'],
            'escala': {k: dict(v) for k, v in ESCALA_BASE.items()},
        },
        'ritmo': {'base': 8, 'item': 12, 'bloco': 24, 'secao': 48, 'raio': 16, 'filete': 4},
        'motivos': {
            'overlay_hero': _OVERLAYS.get(tema, 'rgba(0, 0, 0, 0.40)'),
            # Sombra REAL (style.boxShadow, honrada pelo render) — mais forte em
            # tema escuro para continuar visível.
            'sombra_card': ('0 10px 26px rgba(0, 0, 0, 0.45)'
                            if _luminancia(p['background']) < 0.2
                            else '0 10px 24px rgba(0, 0, 0, 0.12)'),
            # Gradiente de marca (vai em style.backgroundColor; o render detecta).
            'gradiente_marca': f"linear-gradient(135deg, {p['accent']} 0%, {p['secondary']} 100%)",
            'scrim_faixa': 'rgba(10, 6, 4, 0.50)',
            'zebra': _zebra(p['primary']),
            'sombra_simulada': 'rgba(0, 0, 0, 0.10)',
            'pill_radius': 999,
        },
    }
    return perfil


# Pares (texto, fundo, contraste mínimo, papel-de-texto que pode ser corrigido)
_PARES_AA = [
    ('texto', 'fundo', 4.5),
    ('texto', 'superficie', 4.5),
    ('texto_sobre_primaria', 'primaria', 4.5),
    ('texto_sobre_acento', 'acento', 4.5),
    ('texto_suave', 'fundo', 3.0),
    ('texto_suave', 'superficie', 3.0),
]


def _validar_e_corrigir(perfil):
    """Verifica AA programaticamente; corrige com melhor_texto; falha se não der."""
    pal = perfil['paleta']
    problemas = []
    for chave_texto, chave_fundo, minimo in _PARES_AA:
        if contraste(pal[chave_texto], pal[chave_fundo]) < minimo:
            pal[chave_texto] = melhor_texto(pal[chave_fundo])
        if contraste(pal[chave_texto], pal[chave_fundo]) < minimo:
            problemas.append(f'{chave_texto}/{chave_fundo} < {minimo}')
    # Kicker usa a primária sobre o fundo; precisa de >= 3.0, senão cai no texto.
    if contraste(pal['primaria'], pal['fundo']) >= 3.0:
        pal['kicker'] = pal['primaria']
    else:
        pal['kicker'] = pal['texto']
    if problemas:
        raise ValueError(f"Perfil '{perfil['tema']}' reprova AA: {', '.join(problemas)}")
    return perfil


def get_perfil(tema):
    """Perfil validado (AA) do tema. Levanta ValueError se o tema não existir."""
    if tema not in THEMES:
        raise ValueError(f'Tema sem perfil: {tema}')
    return _validar_e_corrigir(_montar_perfil(tema))


def formatar_preco_brl(valor):
    """'12.9' | 12.9 -> 'R$ 12,90' (pt-BR; milhar com ponto)."""
    try:
        n = float(str(valor).replace(',', '.'))
    except (TypeError, ValueError):
        return f'R$ {valor}'
    inteiro, cent = divmod(round(n * 100), 100)
    inteiro_fmt = f'{inteiro:,}'.replace(',', '.')
    return f'R$ {inteiro_fmt},{cent:02d}'
