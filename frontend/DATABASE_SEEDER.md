# 🌱 Database Seeder - Dados Fictícios para Testes

## 📋 Script de Seed Completo

Este script cria dados fictícios para testar toda a funcionalidade de perfis públicos.

---

## 🐍 Script Python/Django

Crie o arquivo `seed_public_profiles.py` na pasta `management/commands/`:

```python
# your_app/management/commands/seed_public_profiles.py

from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from django.utils import timezone
from faker import Faker
import random
from your_app.models import (
    PublicProfile,
    Catalog,
    Product,
    Category,
    Organization,
    Sede,
    ProfileFollow,
    ProfileSave,
    CatalogLike,
    CatalogView,
)

fake = Faker('pt_BR')

class Command(BaseCommand):
    help = 'Popula o banco de dados com perfis públicos e catálogos fictícios'

    def add_arguments(self, parser):
        parser.add_argument(
            '--users',
            type=int,
            default=50,
            help='Número de usuários/perfis a criar',
        )
        parser.add_argument(
            '--catalogs-per-user',
            type=int,
            default=5,
            help='Média de catálogos por usuário',
        )
        parser.add_argument(
            '--products-per-catalog',
            type=int,
            default=20,
            help='Média de produtos por catálogo',
        )

    def handle(self, *args, **options):
        num_users = options['users']
        catalogs_per_user = options['catalogs_per_user']
        products_per_catalog = options['products_per_catalog']

        self.stdout.write(self.style.WARNING('🌱 Iniciando seed do banco de dados...'))

        # 1. Criar Organização e Sede padrão
        org, _ = Organization.objects.get_or_create(
            name='Catana Demo',
            defaults={
                'description': 'Organização de demonstração',
                'is_active': True,
            }
        )

        sede, _ = Sede.objects.get_or_create(
            name='Sede Principal',
            organization=org,
            defaults={
                'is_active': True,
            }
        )

        self.stdout.write(self.style.SUCCESS(f'✅ Organização: {org.name}'))
        self.stdout.write(self.style.SUCCESS(f'✅ Sede: {sede.name}'))

        # 2. Criar Categorias
        categories = self._create_categories()
        self.stdout.write(self.style.SUCCESS(f'✅ {len(categories)} categorias criadas'))

        # 3. Criar Usuários e Perfis Públicos
        users_profiles = self._create_users_and_profiles(num_users, org, sede)
        self.stdout.write(self.style.SUCCESS(f'✅ {len(users_profiles)} usuários e perfis criados'))

        # 4. Criar Catálogos
        catalogs = self._create_catalogs(users_profiles, catalogs_per_user, org, sede)
        self.stdout.write(self.style.SUCCESS(f'✅ {len(catalogs)} catálogos criados'))

        # 5. Criar Produtos
        products = self._create_products(catalogs, categories, products_per_catalog, org, sede)
        self.stdout.write(self.style.SUCCESS(f'✅ {len(products)} produtos criados'))

        # 6. Criar Interações (Follows, Likes, Views)
        self._create_interactions(users_profiles, catalogs)
        self.stdout.write(self.style.SUCCESS(f'✅ Interações criadas'))

        self.stdout.write(self.style.SUCCESS('\n🎉 Seed concluído com sucesso!'))
        self.stdout.write(self.style.WARNING('\n📊 Resumo:'))
        self.stdout.write(f'   • {num_users} usuários')
        self.stdout.write(f'   • {len(catalogs)} catálogos')
        self.stdout.write(f'   • {len(products)} produtos')
        self.stdout.write(f'   • {len(categories)} categorias')

    def _create_categories(self):
        """Cria categorias de produtos"""
        category_names = [
            'Moda Feminina',
            'Moda Masculina',
            'Eletrônicos',
            'Casa e Decoração',
            'Alimentos e Bebidas',
            'Esportes',
            'Beleza e Cosméticos',
            'Livros',
            'Brinquedos',
            'Automóveis',
            'Saúde',
            'Pets',
            'Joias e Acessórios',
            'Arte e Artesanato',
        ]

        categories = []
        for name in category_names:
            category, created = Category.objects.get_or_create(
                name=name,
                defaults={
                    'description': fake.text(max_nb_chars=100),
                }
            )
            categories.append(category)

        return categories

    def _create_users_and_profiles(self, num_users, org, sede):
        """Cria usuários e seus perfis públicos"""
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
        ]

        users_profiles = []

        for i in range(num_users):
            # Criar usuário
            username = fake.user_name() + str(random.randint(100, 999))
            email = f"{username}@example.com"

            user, created = User.objects.get_or_create(
                username=username,
                defaults={
                    'email': email,
                    'first_name': fake.first_name(),
                    'last_name': fake.last_name(),
                }
            )

            if created:
                user.set_password('demo123')
                user.save()

            # Criar perfil público
            profile_type = random.choice(profile_types)
            segments = random.choice(segments_options)

            # Nome baseado no tipo
            if profile_type == 'empresa':
                display_name = fake.company()
            else:
                display_name = f"{user.first_name} {user.last_name}"

            bio_templates = [
                f"Especialista em {segments[0].lower()} há mais de 10 anos",
                f"Oferecemos o melhor em {segments[0].lower()} com qualidade garantida",
                f"Criando experiências únicas em {segments[0].lower()}",
                f"Sua melhor escolha em {segments[0].lower()}",
                f"Inovação e qualidade em {segments[0].lower()}",
            ]

            profile, created = PublicProfile.objects.get_or_create(
                user=user,
                defaults={
                    'username': username,
                    'display_name': display_name,
                    'bio': random.choice(bio_templates),
                    'description': fake.text(max_nb_chars=500),
                    'profile_type': profile_type,
                    'segments': segments,
                    'city': fake.city(),
                    'state': fake.state_abbr(),
                    'country': 'Brasil',
                    'visibility': random.choice(['publico', 'publico', 'publico', 'semi-publico']),  # 75% público
                    'show_in_search': random.choice([True, True, True, False]),  # 75% visível
                    'allow_messages': random.choice([True, True, False]),  # 66% permite mensagens
                    'allow_follows': True,
                }
            )

            users_profiles.append((user, profile))

        return users_profiles

    def _create_catalogs(self, users_profiles, catalogs_per_user, org, sede):
        """Cria catálogos para os usuários"""
        catalog_templates = [
            "Coleção {season} {year}",
            "Lançamentos {month}",
            "Ofertas Especiais {season}",
            "Catálogo Premium {year}",
            "Novidades {month} {year}",
            "Black Friday {year}",
            "Natal {year}",
            "Verão {year}",
        ]

        seasons = ['Primavera', 'Verão', 'Outono', 'Inverno']
        months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
                  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

        catalogs = []

        for user, profile in users_profiles:
            # Número aleatório de catálogos
            num_catalogs = random.randint(
                max(1, catalogs_per_user - 2),
                catalogs_per_user + 3
            )

            for _ in range(num_catalogs):
                template = random.choice(catalog_templates)
                title = template.format(
                    season=random.choice(seasons),
                    year=random.choice([2023, 2024, 2025]),
                    month=random.choice(months)
                )

                catalog = Catalog.objects.create(
                    title=title,
                    description=fake.text(max_nb_chars=200),
                    organization=org,
                    sede=sede,
                    created_by=user,
                    is_public=random.choice([True, True, True, False]),  # 75% público
                    status=random.choice(['published', 'published', 'draft']),  # 66% publicado
                )

                catalogs.append(catalog)

        return catalogs

    def _create_products(self, catalogs, categories, products_per_catalog, org, sede):
        """Cria produtos para os catálogos"""
        products = []

        # URLs de imagens de exemplo (Unsplash)
        image_urls = [
            'https://images.unsplash.com/photo-1523275335684-37898b6baf30',
            'https://images.unsplash.com/photo-1505740420928-5e560c06d30e',
            'https://images.unsplash.com/photo-1572635196237-14b3f281503f',
            'https://images.unsplash.com/photo-1560769629-975ec94e6a86',
            'https://images.unsplash.com/photo-1542291026-7eec264c27ff',
            'https://images.unsplash.com/photo-1549298916-b41d501d3772',
            'https://images.unsplash.com/photo-1491553895911-0055eca6402d',
            'https://images.unsplash.com/photo-1606107557195-0e29a4b5b4aa',
        ]

        product_templates = [
            "{adjective} {item}",
            "{item} {variant}",
            "{adjective} {item} {variant}",
        ]

        adjectives = ['Premium', 'Deluxe', 'Básico', 'Profissional', 'Essencial', 'Elite']
        items = ['Produto', 'Item', 'Artigo', 'Peça']
        variants = ['Pro', 'Plus', 'Max', 'Mini', 'Standard', 'Lite']

        for catalog in catalogs:
            num_products = random.randint(
                max(5, products_per_catalog - 10),
                products_per_catalog + 10
            )

            for i in range(num_products):
                template = random.choice(product_templates)
                name = template.format(
                    adjective=random.choice(adjectives),
                    item=random.choice(items),
                    variant=random.choice(variants)
                )

                # SKU único
                sku = f"SKU-{catalog.id}-{i:04d}"

                # Preço aleatório
                price = round(random.uniform(19.90, 999.90), 2)

                # Imagens
                image_main = random.choice(image_urls)
                image_gallery = '|'.join(random.sample(image_urls, random.randint(1, 3)))

                product = Product.objects.create(
                    name=name,
                    sku=sku,
                    price=price,
                    description=fake.text(max_nb_chars=200),
                    category=random.choice(categories),
                    stock=random.randint(0, 500),
                    currency='BRL',
                    image_main=image_main,
                    image_gallery=image_gallery,
                    organization=org,
                    sede=sede,
                    catalog=catalog,
                    created_by=catalog.created_by,
                )

                products.append(product)

        return products

    def _create_interactions(self, users_profiles, catalogs):
        """Cria interações entre perfis e catálogos"""
        users = [user for user, _ in users_profiles]
        profiles = [profile for _, profile in users_profiles]

        # Follows (cada usuário segue entre 5 e 15 perfis)
        for user in users:
            num_follows = random.randint(5, 15)
            profiles_to_follow = random.sample(
                [p for p in profiles if p.user != user],
                min(num_follows, len(profiles) - 1)
            )

            for profile in profiles_to_follow:
                ProfileFollow.objects.get_or_create(
                    follower=user,
                    followed_profile=profile
                )

        # Saves (cada usuário salva entre 3 e 10 perfis)
        for user in users:
            num_saves = random.randint(3, 10)
            profiles_to_save = random.sample(
                [p for p in profiles if p.user != user],
                min(num_saves, len(profiles) - 1)
            )

            for profile in profiles_to_save:
                ProfileSave.objects.get_or_create(
                    user=user,
                    profile=profile
                )

        # Catalog Likes (cada usuário curte entre 10 e 30 catálogos)
        public_catalogs = [c for c in catalogs if c.is_public]

        for user in users:
            num_likes = random.randint(10, 30)
            catalogs_to_like = random.sample(
                public_catalogs,
                min(num_likes, len(public_catalogs))
            )

            for catalog in catalogs_to_like:
                CatalogLike.objects.get_or_create(
                    user=user,
                    catalog=catalog
                )

        # Catalog Views (cada catálogo público tem entre 50 e 500 views)
        for catalog in public_catalogs:
            num_views = random.randint(50, 500)

            for _ in range(num_views):
                # Algumas views com usuário, outras anônimas
                view_user = random.choice(users) if random.random() > 0.3 else None

                CatalogView.objects.create(
                    catalog=catalog,
                    user=view_user,
                    ip_address=fake.ipv4() if not view_user else None,
                )
```

---

## 🚀 Como Executar

### 1. Instalar dependências

```bash
pip install faker
```

### 2. Rodar o comando

```bash
# Criar dados padrão (50 usuários, 5 catálogos cada, 20 produtos cada)
python manage.py seed_public_profiles

# Criar mais usuários
python manage.py seed_public_profiles --users=100

# Customizar
python manage.py seed_public_profiles --users=100 --catalogs-per-user=10 --products-per-catalog=30
```

### 3. Limpar dados (se necessário)

```bash
python manage.py flush --no-input
```

---

## 📊 Dados Criados (Padrão)

Com `--users=50`:

- **50 usuários** com perfis públicos
- **~250 catálogos** (5 por usuário em média)
- **~5.000 produtos** (20 por catálogo em média)
- **14 categorias** de produtos
- **~500 follows** (cada usuário segue ~10 perfis)
- **~350 saves** (cada usuário salva ~7 perfis)
- **~1.000 likes** em catálogos
- **~12.500 views** nos catálogos (50-500 por catálogo)

**Total de registros: ~20.000**

---

## 🎯 Perfis Gerados

### Tipos de Perfil
- 33% Empresas (ex: "Distribuidora Silva LTDA")
- 33% Criadores (ex: "João da Silva")
- 33% Revendedores (ex: "Maria Santos")

### Segmentos
- Moda e Acessórios
- Eletrônicos e Tecnologia
- Alimentos e Bebidas
- Casa e Decoração
- Esportes e Fitness
- Beleza e Cosméticos
- Arte e Artesanato
- Livros e Papelaria
- Pets
- Saúde e Bem-estar

### Localização
- Cidades brasileiras aleatórias
- Estados brasileiros aleatórios

---

## 📸 Imagens de Exemplo

O script usa URLs do Unsplash para imagens:
- ✅ Imagens reais de produtos
- ✅ Alta qualidade
- ✅ Gratuitas para uso

URLs incluídas:
- Produtos eletrônicos
- Roupas e acessórios
- Tênis e calçados
- Relógios
- Diversos itens

---

## 🔧 Customização

### Adicionar Mais Categorias

```python
category_names = [
    'Moda Feminina',
    'Moda Masculina',
    # Adicione aqui:
    'Moda Infantil',
    'Ferramentas',
    'Jardinagem',
]
```

### Adicionar Mais Segmentos

```python
segments_options = [
    ['Moda', 'Acessórios'],
    # Adicione aqui:
    ['Música', 'Instrumentos'],
    ['Games', 'Consoles'],
]
```

### Usar Suas Próprias Imagens

```python
image_urls = [
    'https://seu-cdn.com/image1.jpg',
    'https://seu-cdn.com/image2.jpg',
    # ...
]
```

---

## 🧪 Testes Recomendados

Após rodar o seed:

1. **Teste a Busca**
   ```
   GET /api/public-profiles/search/?query=silva
   ```

2. **Teste Perfil Específico**
   ```
   GET /api/public-profiles/1/
   ```

3. **Teste Catálogos de um Perfil**
   ```
   GET /api/public-profiles/1/catalogs/
   ```

4. **Teste Estatísticas**
   ```
   GET /api/public-profiles/me/stats/
   ```

---

## 📈 Performance

O script é otimizado para:
- ✅ Criar dados em batch quando possível
- ✅ Usar `get_or_create` para evitar duplicatas
- ✅ Processar em chunks para grandes volumes

**Tempo estimado:**
- 50 usuários: ~30 segundos
- 100 usuários: ~1 minuto
- 500 usuários: ~5 minutos

---

## 🗑️ Limpar Dados de Teste

```bash
# Opção 1: Limpar tudo
python manage.py flush --no-input

# Opção 2: Deletar apenas perfis públicos
python manage.py shell
>>> from your_app.models import PublicProfile
>>> PublicProfile.objects.all().delete()

# Opção 3: Deletar usuários de teste
>>> from django.contrib.auth.models import User
>>> User.objects.filter(email__contains='@example.com').delete()
```

---

## ✅ Checklist de Verificação

Após rodar o seed, verifique:

- [ ] Usuários criados com sucesso
- [ ] Perfis públicos associados
- [ ] Catálogos criados e vinculados
- [ ] Produtos com SKUs únicos
- [ ] Categorias populadas
- [ ] Follows criados (verifique followers_count)
- [ ] Likes em catálogos
- [ ] Views registradas
- [ ] Imagens carregando corretamente

---

## 🚨 Troubleshooting

### Erro: "Faker module not found"
```bash
pip install faker
```

### Erro: "Organization does not exist"
Verifique se o model Organization existe e está migrado:
```bash
python manage.py makemigrations
python manage.py migrate
```

### Erro: "Duplicate key value"
Limpe o banco antes:
```bash
python manage.py flush --no-input
```

### Imagens não aparecem
As URLs do Unsplash são válidas, mas podem precisar de parâmetros:
```python
image_urls = [
    'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400',
    # Adicione ?w=400 para controlar tamanho
]
```

---

**Criado em**: 2025-12-28
**Versão**: 1.0
**Compatível com**: Django 3.2+, Python 3.8+
