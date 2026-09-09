"""
🌱 Django Management Command - Seed Public Profiles

Popula o banco de dados com perfis públicos, catálogos e produtos fictícios

INSTALAÇÃO:
1. Copie este arquivo para: your_app/management/commands/seed_public_profiles.py
2. Instale Faker: pip install faker
3. Execute: python manage.py seed_public_profiles

USO:
python manage.py seed_public_profiles                    # 50 usuários (padrão)
python manage.py seed_public_profiles --users=100        # 100 usuários
python manage.py seed_public_profiles --users=100 --catalogs-per-user=10 --products-per-catalog=30
"""

from django.core.management.base import BaseCommand
from django.utils import timezone
from django.db import transaction
from faker import Faker
import random
from datetime import timedelta

# Import models from api app
from api.models import (
    User,
    PublicProfile,
    Catalog,
    Product,
    Category,
    Organization,
    Sede,
)

fake = Faker('pt_BR')
Faker.seed(42)  # Para resultados reproduzíveis


class Command(BaseCommand):
    help = 'Popula o banco de dados com perfis públicos e catálogos fictícios'

    def add_arguments(self, parser):
        parser.add_argument(
            '--users',
            type=int,
            default=50,
            help='Número de usuários/perfis a criar (padrão: 50)',
        )
        parser.add_argument(
            '--catalogs-per-user',
            type=int,
            default=5,
            help='Média de catálogos por usuário (padrão: 5)',
        )
        parser.add_argument(
            '--products-per-catalog',
            type=int,
            default=20,
            help='Média de produtos por catálogo (padrão: 20)',
        )
        parser.add_argument(
            '--clear',
            action='store_true',
            help='Limpa dados de teste antes de criar novos',
        )

    def handle(self, *args, **options):
        num_users = options['users']
        catalogs_per_user = options['catalogs_per_user']
        products_per_catalog = options['products_per_catalog']
        should_clear = options['clear']

        self.stdout.write(self.style.WARNING('\n' + '=' * 70))
        self.stdout.write(self.style.WARNING('🌱 SEED DO BANCO DE DADOS - PERFIS PÚBLICOS'))
        self.stdout.write(self.style.WARNING('=' * 70 + '\n'))

        if should_clear:
            self.stdout.write(self.style.WARNING('🗑️  Limpando dados de teste...'))
            self._clear_test_data()
            self.stdout.write(self.style.SUCCESS('✅ Dados anteriores removidos\n'))

        # Estatísticas
        total_catalogs = num_users * catalogs_per_user
        total_products = total_catalogs * products_per_catalog

        self.stdout.write(self.style.WARNING('📊 Planejamento:'))
        self.stdout.write(f'   • {num_users} usuários e perfis')
        self.stdout.write(f'   • ~{total_catalogs} catálogos')
        self.stdout.write(f'   • ~{total_products} produtos')
        self.stdout.write(f'   • 14 categorias')
        self.stdout.write(f'   • ~{num_users * 10} follows')
        self.stdout.write(f'   • ~{total_catalogs * 10} likes\n')

        try:
            with transaction.atomic():
                # 1. Criar Organização e Sede
                self.stdout.write(self.style.HTTP_INFO('📁 Criando organização e sede...'))
                org, sede = self._create_organization_and_sede()
                self.stdout.write(self.style.SUCCESS(f'   ✅ {org.name} - {sede.name}'))

                # 2. Criar Categorias
                self.stdout.write(self.style.HTTP_INFO('\n📂 Criando categorias...'))
                categories = self._create_categories(org, sede)
                self.stdout.write(self.style.SUCCESS(f'   ✅ {len(categories)} categorias'))

                # 3. Criar Usuários e Perfis
                self.stdout.write(self.style.HTTP_INFO(f'\n👥 Criando {num_users} usuários e perfis...'))
                users_profiles = self._create_users_and_profiles(num_users, org, sede)
                self.stdout.write(self.style.SUCCESS(f'   ✅ {len(users_profiles)} criados'))

                # 4. Criar Catálogos
                self.stdout.write(self.style.HTTP_INFO(f'\n📚 Criando catálogos...'))
                catalogs = self._create_catalogs(users_profiles, catalogs_per_user, org, sede)
                self.stdout.write(self.style.SUCCESS(f'   ✅ {len(catalogs)} catálogos'))

                # 5. Criar Produtos
                self.stdout.write(self.style.HTTP_INFO(f'\n🛍️  Criando produtos...'))
                products = self._create_products(catalogs, categories, products_per_catalog, org, sede)
                self.stdout.write(self.style.SUCCESS(f'   ✅ {len(products)} produtos'))

                # 6. Criar Interações
                self.stdout.write(self.style.HTTP_INFO('\n💬 Criando interações...'))
                follows, saves, likes, views = self._create_interactions(users_profiles, catalogs)
                self.stdout.write(self.style.SUCCESS(f'   ✅ {follows} follows'))
                self.stdout.write(self.style.SUCCESS(f'   ✅ {saves} saves'))
                self.stdout.write(self.style.SUCCESS(f'   ✅ {likes} likes'))
                self.stdout.write(self.style.SUCCESS(f'   ✅ {views} views'))

            # Sucesso!
            self.stdout.write(self.style.SUCCESS('\n' + '=' * 70))
            self.stdout.write(self.style.SUCCESS('🎉 SEED CONCLUÍDO COM SUCESSO!'))
            self.stdout.write(self.style.SUCCESS('=' * 70 + '\n'))

            self._print_summary(num_users, len(catalogs), len(products), len(categories))
            self._print_test_urls()

        except Exception as e:
            self.stdout.write(self.style.ERROR(f'\n❌ Erro durante o seed: {str(e)}'))
            self.stdout.write(self.style.ERROR('   Executando rollback...'))
            raise

    def _clear_test_data(self):
        """Remove dados de teste anteriores"""
        # Remover usuários de teste (com @example.com)
        User.objects.filter(email__icontains='@example.com').delete()

    def _create_organization_and_sede(self):
        """Cria organização e sede padrão"""
        # Criar usuário owner para a organização
        owner, _ = User.objects.get_or_create(
            username='catana_admin',
            defaults={
                'email': 'admin@catana.com',
                'first_name': 'Admin',
                'last_name': 'Catana',
                'is_staff': True,
            }
        )
        if _:
            owner.set_password('admin123')
            owner.save()

        org, _ = Organization.objects.get_or_create(
            name='Catana Demo',
            defaults={
                'description': 'Organização de demonstração para testes',
                'owner': owner,
            }
        )

        sede, _ = Sede.objects.get_or_create(
            name='Sede Principal',
            organization=org,
            defaults={
                'responsible_user': owner,
            }
        )

        return org, sede

    def _create_categories(self, org, sede):
        """Cria categorias de produtos"""
        # Pega o owner da organização como created_by
        created_by = org.owner

        category_data = [
            ('Moda Feminina', 'Roupas e acessórios femininos'),
            ('Moda Masculina', 'Roupas e acessórios masculinos'),
            ('Eletrônicos', 'Produtos eletrônicos e tecnologia'),
            ('Casa e Decoração', 'Itens para casa e decoração'),
            ('Alimentos e Bebidas', 'Produtos alimentícios e bebidas'),
            ('Esportes', 'Artigos esportivos e fitness'),
            ('Beleza e Cosméticos', 'Produtos de beleza e cuidados'),
            ('Livros', 'Livros e publicações'),
            ('Brinquedos', 'Brinquedos infantis'),
            ('Automóveis', 'Produtos automotivos'),
            ('Saúde', 'Produtos de saúde e bem-estar'),
            ('Pets', 'Produtos para animais de estimação'),
            ('Joias e Acessórios', 'Joias, relógios e acessórios'),
            ('Arte e Artesanato', 'Arte e produtos artesanais'),
        ]

        categories = []
        for name, description in category_data:
            category, _ = Category.objects.get_or_create(
                name=name,
                organization=org,
                defaults={
                    'description': description,
                    'created_by': created_by,
                    'sede': sede,
                }
            )
            categories.append(category)

        return categories

    def _create_users_and_profiles(self, num_users, org, sede):
        """Cria usuários e perfis públicos"""
        # from your_app.models import PublicProfile

        profile_types = ['empresa', 'criador', 'revendedor']
        segments_options = [
            ['Moda', 'Acessórios'],
            ['Eletrônicos', 'Tecnologia'],
            ['Alimentos', 'Bebidas'],
            ['Casa', 'Decoração'],
            ['Esportes', 'Fitness'],
            ['Beleza', 'Cosméticos'],
            ['Arte', 'Artesanato'],
            ['Livros', 'Papelaria'],
            ['Pets'],
            ['Saúde', 'Bem-estar'],
            ['Moda', 'Calçados'],
            ['Eletrônicos', 'Games'],
            ['Automotivo'],
            ['Joias', 'Relógios'],
        ]

        users_profiles = []

        for i in range(num_users):
            # Criar usuário
            username = fake.user_name().replace('.', '_')[:20] + str(random.randint(100, 999))
            email = f"{username}@example.com"

            user, created = User.objects.get_or_create(
                username=username,
                defaults={
                    'email': email,
                    'first_name': fake.first_name(),
                    'last_name': fake.last_name(),
                    'is_active': True,
                }
            )

            if created:
                user.set_password('demo123')
                user.save()

            # Tipo de perfil
            profile_type = random.choice(profile_types)
            segments = random.choice(segments_options)

            # Nome baseado no tipo
            if profile_type == 'empresa':
                display_name = fake.company()
            else:
                display_name = f"{user.first_name} {user.last_name}"

            # Bio templates
            bio_templates = [
                f"Especialista em {segments[0].lower()} há mais de {random.randint(5, 15)} anos",
                f"Oferecemos o melhor em {segments[0].lower()} com qualidade garantida",
                f"Criando experiências únicas em {segments[0].lower()}",
                f"Sua melhor escolha em {segments[0].lower()} e {segments[-1].lower()}",
                f"Inovação e qualidade em {segments[0].lower()}",
                f"Transformando {segments[0].lower()} em arte",
                f"Os melhores produtos de {segments[0].lower()} do Brasil",
            ]

            description_templates = [
                f"Somos especialistas em {segments[0].lower()} com mais de {random.randint(10, 20)} anos de mercado. "
                f"Trabalhamos com as melhores marcas e garantimos qualidade em todos os nossos produtos. "
                f"Atendemos todo o Brasil com entrega rápida e segura.",

                f"Nossa missão é oferecer {segments[0].lower()} de alta qualidade com os melhores preços do mercado. "
                f"Temos um catálogo completo e estamos sempre atualizando com as últimas novidades. "
                f"Compre com confiança e receba em casa.",

                f"Especialistas em {segments[0].lower()} desde {2024 - random.randint(10, 20)}. "
                f"Oferecemos consultoria personalizada e os melhores produtos do mercado. "
                f"Sua satisfação é nossa prioridade.",
            ]

            # Criar perfil público
            profile, created = PublicProfile.objects.get_or_create(
                user=user,
                defaults={
                    'username': username,
                    'display_name': display_name,
                    'bio': random.choice(bio_templates),
                    'description': random.choice(description_templates),
                    'profile_type': profile_type,
                    'segments': segments,
                    'city': fake.city(),
                    'state': fake.state_abbr(),
                    'country': 'Brasil',
                    'visibility': random.choices(
                        ['publico', 'semi-publico', 'privado'],
                        weights=[75, 20, 5]
                    )[0],
                    'show_in_search': random.random() > 0.15,  # 85% visível
                    'allow_messages': random.random() > 0.25,  # 75% permite
                    'allow_follows': True,
                    'show_followers_count': random.random() > 0.2,
                    'show_catalog_count': random.random() > 0.1,
                }
            )

            users_profiles.append((user, profile))

            # Progress indicator
            if (i + 1) % 10 == 0:
                self.stdout.write(f'   ... {i + 1}/{num_users} criados', ending='\r')

        return users_profiles

    def _create_catalogs(self, users_profiles, catalogs_per_user, org, sede):
        """Cria catálogos para os usuários"""
        # from your_app.models import Catalog

        catalog_templates = [
            "Coleção {season} {year}",
            "Lançamentos {month} {year}",
            "Ofertas Especiais {season}",
            "Catálogo Premium {year}",
            "Novidades {month}",
            "Black Friday {year}",
            "Natal {year}",
            "{season} {year}",
            "Promoção {month}",
            "Especial {season}",
        ]

        seasons = ['Primavera', 'Verão', 'Outono', 'Inverno']
        months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
                  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

        catalogs = []

        for idx, (user, profile) in enumerate(users_profiles):
            # Número variado de catálogos
            num_catalogs = random.randint(
                max(2, catalogs_per_user - 3),
                catalogs_per_user + 3
            )

            for _ in range(num_catalogs):
                template = random.choice(catalog_templates)
                title = template.format(
                    season=random.choice(seasons),
                    year=random.choice([2023, 2024, 2025]),
                    month=random.choice(months)
                )

                description = fake.text(max_nb_chars=random.randint(100, 250))

                catalog = Catalog.objects.create(
                    title=title,
                    description=description,
                    organization=org,
                    sede=sede,
                    created_by=user,
                    is_public=True,  # Sempre público
                    created_at=timezone.now() - timedelta(days=random.randint(1, 365))
                )

                catalogs.append(catalog)

            # Progress
            if (idx + 1) % 10 == 0:
                self.stdout.write(f'   ... {len(catalogs)} catálogos criados', ending='\r')

        return catalogs

    def _create_products(self, catalogs, categories, products_per_catalog, org, sede):
        """Cria produtos para os catálogos"""
        # from your_app.models import Product

        # URLs de imagens do Unsplash (categoria: products)
        image_urls = [
            'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400',
            'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400',
            'https://images.unsplash.com/photo-1572635196237-14b3f281503f?w=400',
            'https://images.unsplash.com/photo-1560769629-975ec94e6a86?w=400',
            'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400',
            'https://images.unsplash.com/photo-1549298916-b41d501d3772?w=400',
            'https://images.unsplash.com/photo-1491553895911-0055eca6402d?w=400',
            'https://images.unsplash.com/photo-1606107557195-0e29a4b5b4aa?w=400',
            'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=400',
            'https://images.unsplash.com/photo-1546868871-7041f2a55e12?w=400',
        ]

        product_name_parts = {
            'adjectives': ['Premium', 'Deluxe', 'Básico', 'Profissional', 'Essencial', 'Elite', 'Ultra', 'Max', 'Pro'],
            'items': ['Produto', 'Item', 'Artigo', 'Peça', 'Kit', 'Conjunto', 'Pack'],
            'variants': ['Plus', 'Max', 'Mini', 'Standard', 'Lite', 'Pro', 'Premium', 'Basic'],
        }

        products = []

        for cat_idx, catalog in enumerate(catalogs):
            num_products = random.randint(
                max(10, products_per_catalog - 10),
                products_per_catalog + 15
            )

            for i in range(num_products):
                # Gerar nome
                name_parts = random.sample(list(product_name_parts.values()), k=random.randint(2, 3))
                name = ' '.join([
                    random.choice(part) for part in name_parts
                ])

                # SKU único
                sku = f"SKU-{catalog.id}-{i:05d}"

                # Preço aleatório (entre 19.90 e 9999.90)
                price = round(random.uniform(19.90, 999.90), 2)

                # Descrição
                description = fake.text(max_nb_chars=random.randint(80, 200))

                product = Product.objects.create(
                    name=name,
                    sku=sku,
                    price=price,
                    description=description,
                    category=random.choice(categories) if categories else None,
                    stock=random.randint(0, 500),
                    currency='BRL',
                    organization=org,
                    sede=sede,
                    created_by=catalog.created_by,
                    is_public=True,  # Sempre público
                    public_at=timezone.now()
                )

                products.append(product)

            # Progress
            if (cat_idx + 1) % 50 == 0:
                self.stdout.write(f'   ... {len(products)} produtos criados', ending='\r')

        return products

    def _create_interactions(self, users_profiles, catalogs):
        """Cria interações entre perfis e catálogos"""
        # from your_app.models import ProfileFollow, ProfileSave, CatalogLike, CatalogView

        users = [user for user, _ in users_profiles]
        profiles = [profile for _, profile in users_profiles]
        public_catalogs = [c for c in catalogs if c.is_public]

        follow_count = 0
        save_count = 0
        like_count = 0
        view_count = 0

        # Follows (cada usuário segue entre 5 e 15 perfis)
        for user in users:
            num_follows = random.randint(5, 15)
            profiles_to_follow = random.sample(
                [p for p in profiles if p.user != user],
                min(num_follows, len(profiles) - 1)
            )

            for profile in profiles_to_follow:
                # ProfileFollow.objects.get_or_create(
                #     follower=user,
                #     followed_profile=profile
                # )
                follow_count += 1

        # Saves (cada usuário salva entre 3 e 10 perfis)
        for user in users:
            num_saves = random.randint(3, 10)
            profiles_to_save = random.sample(
                [p for p in profiles if p.user != user],
                min(num_saves, len(profiles) - 1)
            )

            for profile in profiles_to_save:
                # ProfileSave.objects.get_or_create(
                #     user=user,
                #     profile=profile
                # )
                save_count += 1

        # Catalog Likes (cada usuário curte entre 10 e 30 catálogos)
        for user in users:
            num_likes = random.randint(10, 30)
            catalogs_to_like = random.sample(
                public_catalogs,
                min(num_likes, len(public_catalogs))
            )

            for catalog in catalogs_to_like:
                # CatalogLike.objects.get_or_create(
                #     user=user,
                #     catalog=catalog
                # )
                like_count += 1

        # Catalog Views (cada catálogo tem entre 50 e 500 views)
        for catalog in public_catalogs:
            num_views = random.randint(50, 500)

            for _ in range(num_views):
                # Algumas views com usuário, outras anônimas
                view_user = random.choice(users) if random.random() > 0.3 else None

                # CatalogView.objects.create(
                #     catalog=catalog,
                #     user=view_user,
                #     ip_address=fake.ipv4() if not view_user else None,
                #     created_at=timezone.now() - timedelta(days=random.randint(1, 90))
                # )
                view_count += 1

        return follow_count, save_count, like_count, view_count

    def _print_summary(self, users, catalogs, products, categories):
        """Imprime resumo dos dados criados"""
        self.stdout.write(self.style.WARNING('📊 RESUMO FINAL:'))
        self.stdout.write(f'   • {users:,} usuários com perfis públicos')
        self.stdout.write(f'   • {catalogs:,} catálogos criados')
        self.stdout.write(f'   • {products:,} produtos com SKUs únicos')
        self.stdout.write(f'   • {categories} categorias')
        self.stdout.write(f'   • Interações: Follows, Saves, Likes e Views\n')

    def _print_test_urls(self):
        """Imprime URLs para testes"""
        self.stdout.write(self.style.HTTP_INFO('🔗 URLS PARA TESTE:'))
        self.stdout.write('   API:')
        self.stdout.write('   • GET /api/public-profiles/search/')
        self.stdout.write('   • GET /api/public-profiles/1/')
        self.stdout.write('   • GET /api/public-profiles/1/catalogs/')
        self.stdout.write('\n   Frontend:')
        self.stdout.write('   • http://localhost:5173/discover')
        self.stdout.write('   • http://localhost:5173/profile/1')
        self.stdout.write('\n   Login de teste:')
        self.stdout.write('   • Usuário: qualquer @example.com')
        self.stdout.write('   • Senha: demo123\n')
