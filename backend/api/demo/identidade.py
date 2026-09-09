"""
Objeto de identidade visual dos catálogos demonstração premium.

Computa UMA vez, a partir do tema + manifest, a fonte única da verdade da
identidade (paleta completa, tipografia, tokens, motivo gráfico). Seus valores
CONCRETOS são baked em cada elemento pelo gerador — nada de referência
$tokens.* (o sistema de tokens global segue desconectado do rendering, ver
CLAUDE.md "Aparência: 3 camadas").
"""

# Motivo gráfico recorrente por tema (desenhado em PNG por api/demo/logo.py).
MOTIVOS = {
    'padaria': 'onda',
    'acougue': 'traco',
    'mercado': 'folha',
    'restaurante': 'filete',
    'festas': 'confete',
    'boutique': 'linha',
}


def _rgb(hex_color):
    h = hex_color.lstrip('#')
    if len(h) == 3:
        h = ''.join(c * 2 for c in h)
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def _luminancia(hex_color):
    """Luminância relativa WCAG."""
    def canal(c):
        c = c / 255
        return c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4
    r, g, b = _rgb(hex_color)
    return 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b)


def contraste(a, b):
    la, lb = _luminancia(a), _luminancia(b)
    hi, lo = max(la, lb), min(la, lb)
    return (hi + 0.05) / (lo + 0.05)


def melhor_texto(fundo, claro='#FFFFFF', escuro='#1A1A1A'):
    """Escolhe entre texto claro/escuro o que tiver mais contraste com o fundo."""
    return escuro if contraste(escuro, fundo) >= contraste(claro, fundo) else claro


def computar_identidade(tema, theme, manifest):
    """Retorna o dict de identidade visual (valores concretos)."""
    p = theme['paleta']
    f = theme['fontes']

    fundo = p['background']
    texto = p['text']
    # Garante contraste mínimo legível entre texto e fundo.
    if contraste(texto, fundo) < 4.5:
        texto = melhor_texto(fundo)

    return {
        'tema': tema,
        'paleta': {
            'primaria': p['primary'],
            'secundaria': p['secondary'],
            'acento': p['accent'],
            'neutro_claro': p['surface'],
            'neutro_escuro': p['border'],
            'fundo': fundo,
            'texto': texto,
            'texto_suave': p['textMuted'],
            'texto_sobre_primaria': p['textOnPrimary'],
        },
        'tipografia': {
            'display': {'familia': f['titulo'], 'peso': '700'},
            'heading': {'familia': f['titulo'], 'peso': '600'},
            'body': {'familia': f['corpo'], 'peso': '400'},
        },
        'tokens': {
            'raio': 16,
            'sombra': '0 8px 24px rgba(0,0,0,0.12)',  # informativo (shape não renderiza sombra)
            'espaco': 8,
            'acento_espessura': 6,
        },
        'motivo': MOTIVOS.get(tema, 'barra'),
    }
