"""
Gera um catálogo de demonstração a partir de um tema/manifest.

Exemplos:
  python manage.py gerar_catalogo_demo --tema padaria
  python manage.py gerar_catalogo_demo --tema padaria --estrutura essencial
  python manage.py gerar_catalogo_demo --tema padaria --estrutura custom --secoes capa produtos contracapa
  python manage.py gerar_catalogo_demo --tema padaria --b2b --periodo "Primavera 2026"
"""
from django.core.management.base import BaseCommand, CommandError

from api.demo.generator import gerar_catalogo_demo, ESTRUTURAS, SECOES_CANONICAS
from api.demo.themes import TEMAS_VALIDOS


class Command(BaseCommand):
    help = 'Gera (ou regenera) um catálogo de demonstração temático.'

    def add_arguments(self, parser):
        parser.add_argument('--tema', choices=TEMAS_VALIDOS, help='Tema do catálogo demo.')
        parser.add_argument('--manifest', help='Caminho para um manifest.json customizado.')
        parser.add_argument('--estrutura', choices=['completo', 'essencial', 'custom'],
                            default='completo', help='Conjunto de seções a gerar.')
        parser.add_argument('--secoes', nargs='*', default=None,
                            help=f'Seções (só com --estrutura custom). Opções: {", ".join(SECOES_CANONICAS)}')
        parser.add_argument('--b2b', action='store_true', help='Inclui a seção de atacado/B2B.')
        parser.add_argument('--periodo', default=None, help='Rótulo de validade/campanha (ex.: "Primavera 2026").')
        parser.add_argument('--sem-premium', action='store_true',
                            help='Desliga a identidade visual premium (gera o catálogo temático limpo).')

    def handle(self, *args, **opts):
        if not opts.get('tema') and not opts.get('manifest'):
            raise CommandError('Informe --tema ou --manifest.')

        catalog = gerar_catalogo_demo(
            tema=opts.get('tema'),
            manifest_path=opts.get('manifest'),
            estrutura=opts.get('estrutura'),
            secoes=opts.get('secoes'),
            b2b=opts.get('b2b'),
            periodo=opts.get('periodo'),
            identidade_premium=not opts.get('sem_premium'),
        )

        n_paginas = catalog.pages.count()
        self.stdout.write(self.style.SUCCESS(
            f'Catálogo demo criado: id={catalog.id} "{catalog.title}" '
            f'({n_paginas} páginas, estrutura={opts.get("estrutura")}).'
        ))
