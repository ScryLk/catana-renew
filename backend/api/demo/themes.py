"""
Registro de temas dos catálogos de demonstração.

Cada tema define valores CONCRETOS (cores hex, famílias de fonte) que o gerador
"baka" diretamente no `Component.content` de cada elemento. Não usa os design
tokens globais do front (eles existem mas o baked aqui é proposital e isolado).

Famílias de fonte: stacks web-safe, para renderizarem igual no editor e no PDF
(o export usa html2canvas sobre o DOM).
"""

# Cada tema: paleta + fontes. As cores são strings hex prontas para ir no style.
THEMES = {
    'padaria': {
        'nome': 'Padaria Pão Dourado',
        'paleta': {
            'primary': '#8B5E3C',      # marrom pão
            'secondary': '#D9A05B',    # caramelo
            'accent': '#C8902F',       # dourado
            'background': '#FBF6EE',   # creme
            'surface': '#FFFFFF',
            'text': '#3B2A1A',         # marrom escuro
            'textMuted': '#7A6A58',
            'textOnPrimary': '#FFF8EE',
            'border': '#E6D8C3',
        },
        'fontes': {
            'titulo': 'Georgia, "Times New Roman", serif',
            'corpo': 'Georgia, "Times New Roman", serif',
        },
    },
    'acougue': {
        'nome': 'Açougue Corte Nobre',
        'paleta': {
            'primary': '#7A1F2B',      # vinho
            'secondary': '#B23A48',    # vermelho carne
            'accent': '#E0A458',       # dourado rústico
            'background': '#1C1416',   # quase preto
            'surface': '#2A2023',
            'text': '#F3E9E6',
            'textMuted': '#C8B3AE',
            'textOnPrimary': '#FFF5F2',
            'border': '#4A3A3D',
        },
        'fontes': {
            'titulo': '"Arial Black", Arial, sans-serif',
            'corpo': 'Arial, Helvetica, sans-serif',
        },
    },
    'mercado': {
        'nome': 'Mercado Hortifruti Verde',
        'paleta': {
            'primary': '#2E7D32',      # verde
            'secondary': '#F57C00',    # laranja
            'accent': '#FBC02D',       # amarelo
            'background': '#F4FBF2',
            'surface': '#FFFFFF',
            'text': '#1B3A1E',
            'textMuted': '#5E7A60',
            'textOnPrimary': '#FFFFFF',
            'border': '#D6E8D2',
        },
        'fontes': {
            'titulo': '"Trebuchet MS", Helvetica, sans-serif',
            'corpo': 'Verdana, Geneva, sans-serif',
        },
    },
    'restaurante': {
        'nome': 'Restaurante Casa Bordô',
        'paleta': {
            'primary': '#6B2737',      # bordô
            'secondary': '#A8763E',    # dourado envelhecido
            'accent': '#D4AF37',       # dourado
            'background': '#16110F',   # escuro elegante
            'surface': '#241B17',
            'text': '#F2E8DC',
            'textMuted': '#C2AE97',
            'textOnPrimary': '#FBF3E6',
            'border': '#43332B',
        },
        'fontes': {
            'titulo': '"Palatino Linotype", Georgia, serif',
            'corpo': 'Georgia, serif',
        },
    },
    'festas': {
        'nome': 'Festas Confete & Cia',
        'paleta': {
            'primary': '#E5328A',      # rosa
            'secondary': '#2EA6E5',    # azul
            'accent': '#FFC400',       # amarelo
            'background': '#FFF7FB',
            'surface': '#FFFFFF',
            'text': '#3A1F4D',
            'textMuted': '#7A5C8C',
            'textOnPrimary': '#FFFFFF',
            'border': '#F3D6E6',
        },
        'fontes': {
            'titulo': '"Comic Sans MS", "Trebuchet MS", cursive',
            'corpo': '"Trebuchet MS", Helvetica, sans-serif',
        },
    },
    'boutique': {
        'nome': 'Boutique Linho & Co',
        'paleta': {
            'primary': '#1A1A1A',      # preto
            'secondary': '#9C8E80',    # nude
            'accent': '#C9B79C',       # nude claro
            'background': '#FAF8F5',   # off-white
            'surface': '#FFFFFF',
            'text': '#1A1A1A',
            'textMuted': '#8A8278',
            'textOnPrimary': '#FFFFFF',
            'border': '#E7E2DA',
        },
        'fontes': {
            'titulo': '"Helvetica Neue", Arial, sans-serif',
            'corpo': '"Helvetica Neue", Arial, sans-serif',
        },
    },
}

TEMAS_VALIDOS = list(THEMES.keys())


def get_theme(tema):
    """Retorna o dict do tema; levanta ValueError se inválido."""
    if tema not in THEMES:
        raise ValueError(
            f"Tema '{tema}' inválido. Opções: {', '.join(TEMAS_VALIDOS)}"
        )
    return THEMES[tema]
