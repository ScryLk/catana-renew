"""
Gera o catálogo showcase ÁUREA (boutique de luxo, portfólio).

Uso:
    python manage.py gerar_catalogo_aurea

Idempotente (modo replace): apaga a org "[PORTFÓLIO] ÁUREA" anterior e recria.
O catalog_id muda a cada geração — abra sempre o id impresso ao final.
"""
from django.core.management.base import BaseCommand

from api.demo.aurea import gerar_catalogo_aurea


class Command(BaseCommand):
    help = 'Gera (modo replace) o catálogo showcase ÁUREA.'

    def handle(self, *args, **options):
        catalog = gerar_catalogo_aurea()
        paginas = catalog.pages.count()
        self.stdout.write(self.style.SUCCESS(
            f'Catálogo ÁUREA gerado: id={catalog.id} · "{catalog.title}" · '
            f'{paginas} páginas'
        ))
        self.stdout.write(f'Abrir no editor: /editor?catalog={catalog.id}')
