"""
Django Management Command - Set Public Flag

Marca produtos e catálogos como públicos
"""

from django.core.management.base import BaseCommand
from django.utils import timezone
from api.models import Product, Catalog


class Command(BaseCommand):
    help = 'Marca todos os produtos e catálogos como públicos'

    def add_arguments(self, parser):
        parser.add_argument(
            '--products-only',
            action='store_true',
            help='Atualiza apenas produtos',
        )
        parser.add_argument(
            '--catalogs-only',
            action='store_true',
            help='Atualiza apenas catálogos',
        )

    def handle(self, *args, **options):
        products_only = options.get('products_only', False)
        catalogs_only = options.get('catalogs_only', False)

        self.stdout.write('=' * 70)
        self.stdout.write('🔓 CONFIGURANDO ITENS COMO PÚBLICOS')
        self.stdout.write('=' * 70)

        # Atualizar produtos
        if not catalogs_only:
            products_count = Product.objects.filter(is_public=False).count()
            self.stdout.write(f'\n📦 Atualizando {products_count} produtos...')

            updated = Product.objects.filter(is_public=False).update(
                is_public=True,
                public_at=timezone.now()
            )

            self.stdout.write(self.style.SUCCESS(f'   ✅ {updated} produtos marcados como públicos'))

        # Atualizar catálogos
        if not products_only:
            catalogs_count = Catalog.objects.filter(is_public=False).count()
            self.stdout.write(f'\n📚 Atualizando {catalogs_count} catálogos...')

            updated = Catalog.objects.filter(is_public=False).update(
                is_public=True
            )

            self.stdout.write(self.style.SUCCESS(f'   ✅ {updated} catálogos marcados como públicos'))

        # Resumo
        self.stdout.write('\n' + '=' * 70)
        self.stdout.write(self.style.SUCCESS('🎉 ATUALIZAÇÃO CONCLUÍDA!'))
        self.stdout.write('=' * 70)

        if not catalogs_only:
            total_public_products = Product.objects.filter(is_public=True).count()
            self.stdout.write(f'   • {total_public_products} produtos públicos no total')

        if not products_only:
            total_public_catalogs = Catalog.objects.filter(is_public=True).count()
            self.stdout.write(f'   • {total_public_catalogs} catálogos públicos no total')

        self.stdout.write('')
