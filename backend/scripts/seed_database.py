#!/usr/bin/env python3
"""
Script profissional para popular o banco de dados com dados mockados realistas.
Limpa todas as tabelas e insere dados de demonstração para Produtos, Catálogos e Mídia.
"""

import os
import sys
import django
from decimal import Decimal
from datetime import datetime, timedelta
import random

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'catana_back.settings')
django.setup()

from django.contrib.auth import get_user_model
from api.models import (
    Organization, Sede, Category, Product, MediaFolder,
    Media, Theme, Catalog, Page, Comment
)

User = get_user_model()

# Dados profissionais para embalagens
CATEGORIES_DATA = [
    {
        'name': 'Embalagens para Alimentos',
        'description': 'Soluções completas para acondicionamento de alimentos',
        'subcategories': [
            {'name': 'Potes e Tampas', 'description': 'Potes plásticos com tampas para diversos usos'},
            {'name': 'Bandejas', 'description': 'Bandejas para carnes, frutas e legumes'},
            {'name': 'Sacos e Sacolas', 'description': 'Embalagens flexíveis para alimentos'},
        ]
    },
    {
        'name': 'Food Service',
        'description': 'Produtos para restaurantes e delivery',
        'subcategories': [
            {'name': 'Marmitas', 'description': 'Embalagens para refeições prontas'},
            {'name': 'Copos e Tampas', 'description': 'Copos descartáveis e tampas'},
            {'name': 'Talheres', 'description': 'Talheres descartáveis biodegradáveis'},
        ]
    },
    {
        'name': 'Confeitaria',
        'description': 'Embalagens especiais para doces e bolos',
        'subcategories': [
            {'name': 'Caixas de Bolo', 'description': 'Caixas transparentes para bolos'},
            {'name': 'Potes de Doce', 'description': 'Potes para brigadeiros e docinhos'},
            {'name': 'Embalagens Personalizadas', 'description': 'Soluções customizadas'},
        ]
    },
    {
        'name': 'Linha Festa',
        'description': 'Produtos para eventos e festas',
        'subcategories': [
            {'name': 'Copos Personalizados', 'description': 'Copos para festas e eventos'},
            {'name': 'Pratos Descartáveis', 'description': 'Pratos plásticos resistentes'},
        ]
    }
]

PRODUCTS_DATA = [
    # Potes e Tampas
    {'name': 'Pote Redondo 250ml', 'category': 'Potes e Tampas', 'price': '0.45', 'stock': 5000,
     'description': 'Pote redondo transparente com tampa, ideal para molhos, temperos e pequenas porções. Material: PP virgem, transparente cristal.'},
    {'name': 'Pote Redondo 500ml', 'category': 'Potes e Tampas', 'price': '0.65', 'stock': 4500,
     'description': 'Pote redondo transparente 500ml com tampa de encaixe perfeito. Ideal para alimentos refrigerados e congelados.'},
    {'name': 'Pote Redondo 1000ml', 'category': 'Potes e Tampas', 'price': '0.95', 'stock': 3500,
     'description': 'Pote 1L transparente com tampa, perfeito para açaí, sorvetes e refeições. Alta resistência e claridade cristalina.'},
    {'name': 'Pote Quadrado 500ml', 'category': 'Potes e Tampas', 'price': '0.70', 'stock': 4000,
     'description': 'Pote quadrado com tampa hermética, otimiza espaço na geladeira. Material atóxico e reutilizável.'},
    {'name': 'Pote Retangular 750ml', 'category': 'Potes e Tampas', 'price': '0.85', 'stock': 3800,
     'description': 'Pote retangular ideal para marmitas e refeições. Tampa com vedação segura, empilhável.'},

    # Bandejas
    {'name': 'Bandeja Açougue 15x20cm', 'category': 'Bandejas', 'price': '0.35', 'stock': 6000,
     'description': 'Bandeja branca para carnes e frios, alta absorção. Fundo absorvente e filme PVC incluso.'},
    {'name': 'Bandeja Açougue 20x30cm', 'category': 'Bandejas', 'price': '0.55', 'stock': 5500,
     'description': 'Bandeja tamanho grande para cortes especiais. Absorvente de alta qualidade, higiênica e segura.'},
    {'name': 'Bandeja Isopor P', 'category': 'Bandejas', 'price': '0.25', 'stock': 7000,
     'description': 'Bandeja isopor branca tamanho P, ideal para frutas e legumes. Leve e econômica.'},
    {'name': 'Bandeja Isopor M', 'category': 'Bandejas', 'price': '0.35', 'stock': 6500,
     'description': 'Bandeja isopor média, versátil para diversos alimentos. Excelente isolamento térmico.'},
    {'name': 'Bandeja Isopor G', 'category': 'Bandejas', 'price': '0.50', 'stock': 5000,
     'description': 'Bandeja grande para grandes volumes. Resistente e com ótimo custo-benefício.'},

    # Marmitas
    {'name': 'Marmitex 500ml', 'category': 'Marmitas', 'price': '0.80', 'stock': 4500,
     'description': 'Marmita retangular com tampa fixa, ideal para delivery. Micro-ondável e resistente a vazamentos.'},
    {'name': 'Marmitex 750ml', 'category': 'Marmitas', 'price': '1.05', 'stock': 4200,
     'description': 'Marmita tamanho médio para refeições completas. Design moderno, empilhável e resistente.'},
    {'name': 'Marmitex 1000ml', 'category': 'Marmitas', 'price': '1.35', 'stock': 3800,
     'description': 'Marmita 1L para porções generosas. Tampa com vedação total, perfeita para transporte.'},
    {'name': 'Marmita Redonda 800ml', 'category': 'Marmitas', 'price': '1.15', 'stock': 3500,
     'description': 'Marmita redonda com divisórias opcionais. Material premium, apta para microondas.'},
    {'name': 'Bandeja 3 Divisórias', 'category': 'Marmitas', 'price': '1.50', 'stock': 3000,
     'description': 'Bandeja com 3 compartimentos, ideal para marmitas executivas. Elegante e funcional.'},

    # Copos e Tampas
    {'name': 'Copo 200ml Transparente', 'category': 'Copos e Tampas', 'price': '0.15', 'stock': 10000,
     'description': 'Copo descartável cristal 200ml. Transparência superior, ideal para sucos e bebidas frias.'},
    {'name': 'Copo 300ml Transparente', 'category': 'Copos e Tampas', 'price': '0.20', 'stock': 9500,
     'description': 'Copo 300ml transparente, resistente e elegante. Perfeito para smoothies e drinks.'},
    {'name': 'Copo 500ml Transparente', 'category': 'Copos e Tampas', 'price': '0.30', 'stock': 8500,
     'description': 'Copo grande 500ml para milk-shakes e açaí. Alta resistência e claridade cristalina.'},
    {'name': 'Tampa Dome com Furo', 'category': 'Copos e Tampas', 'price': '0.12', 'stock': 8000,
     'description': 'Tampa dome transparente com furo para canudo. Encaixe perfeito, sem vazamentos.'},
    {'name': 'Tampa Plana com Furo', 'category': 'Copos e Tampas', 'price': '0.10', 'stock': 8500,
     'description': 'Tampa plana para copos, com abertura para canudo. Prática e econômica.'},

    # Caixas de Bolo
    {'name': 'Caixa Bolo Baixa G', 'category': 'Caixas de Bolo', 'price': '3.50', 'stock': 1500,
     'description': 'Caixa transparente para bolo grande até 3kg. Base branca, tampa cristal, elegante.'},
    {'name': 'Caixa Bolo Alta G', 'category': 'Caixas de Bolo', 'price': '4.20', 'stock': 1200,
     'description': 'Caixa alta para bolos decorados. Espaçosa, resistente e com ótimo acabamento.'},
    {'name': 'Caixa Bolo Média', 'category': 'Caixas de Bolo', 'price': '2.80', 'stock': 1800,
     'description': 'Caixa tamanho médio para bolos de até 2kg. Prática e com excelente apresentação.'},
    {'name': 'Caixa Fatia Individual', 'category': 'Caixas de Bolo', 'price': '0.95', 'stock': 3000,
     'description': 'Caixa individual para fatia de bolo. Design sofisticado, perfeita para venda unitária.'},

    # Potes de Doce
    {'name': 'Pote Brigadeiro 30ml', 'category': 'Potes de Doce', 'price': '0.25', 'stock': 8000,
     'description': 'Potinho redondo 30ml para brigadeiros. Tampa com travamento, transparente cristal.'},
    {'name': 'Pote Doce 50ml', 'category': 'Potes de Doce', 'price': '0.35', 'stock': 7000,
     'description': 'Pote 50ml para docinhos variados. Prático, higiênico e com ótima apresentação.'},
    {'name': 'Pote Sobremesa 100ml', 'category': 'Potes de Doce', 'price': '0.45', 'stock': 6000,
     'description': 'Pote para sobremesas individuais. Ideal para mousses, pudins e cremes.'},
    {'name': 'Pote Decorado 150ml', 'category': 'Potes de Doce', 'price': '0.65', 'stock': 4500,
     'description': 'Pote decorado para doces finos. Elegante e sofisticado, perfeito para presentes.'},

    # Copos Personalizados
    {'name': 'Copo Festa 300ml', 'category': 'Copos Personalizados', 'price': '0.35', 'stock': 5000,
     'description': 'Copo translúcido para festas. Disponível em várias cores, resistente e reutilizável.'},
    {'name': 'Copo Long Drink 320ml', 'category': 'Copos Personalizados', 'price': '0.40', 'stock': 4800,
     'description': 'Copo long drink transparente. Elegante para eventos, alta qualidade.'},
    {'name': 'Taça Champagne 150ml', 'category': 'Copos Personalizados', 'price': '0.55', 'stock': 3500,
     'description': 'Taça para espumantes e champagne. Design sofisticado, ideal para brindes.'},
]

def clear_database():
    """Limpa todas as tabelas mantendo usuários e estrutura básica"""
    print("🗑️  Limpando banco de dados...")

    # Limpar na ordem correta devido às foreign keys
    Comment.objects.all().delete()
    Page.objects.all().delete()
    Catalog.objects.all().delete()
    Theme.objects.all().delete()
    Product.objects.all().delete()
    Media.objects.all().delete()
    MediaFolder.objects.all().delete()
    Category.objects.all().delete()

    print("✅ Banco de dados limpo!")

def create_categories(organization, sede, user):
    """Cria categorias e subcategorias"""
    print("\n📦 Criando categorias...")

    categories = {}

    for cat_data in CATEGORIES_DATA:
        # Criar categoria principal
        category = Category.objects.create(
            name=cat_data['name'],
            description=cat_data['description'],
            organization=organization,
            sede=sede,
            created_by=user
        )
        categories[cat_data['name']] = category
        print(f"  ✓ {category.name}")

        # Criar subcategorias
        for sub_data in cat_data['subcategories']:
            subcategory = Category.objects.create(
                name=sub_data['name'],
                description=sub_data['description'],
                parent=category,
                organization=organization,
                sede=sede,
                created_by=user
            )
            categories[sub_data['name']] = subcategory
            print(f"    ✓ {subcategory.name}")

    return categories

def create_products(categories, organization, sede, user):
    """Cria produtos profissionais"""
    print("\n🏷️  Criando produtos...")

    products = []

    for idx, prod_data in enumerate(PRODUCTS_DATA, 1):
        category = categories.get(prod_data['category'])

        # Gerar SKU único
        sku = f"CAT-{category.name[:3].upper()}-{idx:04d}"

        # Especificações técnicas realistas
        specs = [
            {"label": "Material", "value": "Polipropileno (PP)"},
            {"label": "Cor", "value": "Transparente Cristal"},
            {"label": "Temperatura", "value": "-18°C a +100°C"},
            {"label": "Certificação", "value": "ANVISA e INMETRO"},
            {"label": "Embalagem", "value": f"{random.randint(50, 100)} unidades/pacote"},
        ]

        # Informações de dropshipping
        dropshipping_info = {
            "supplier": "Catana Embalagens Ltda",
            "supplierSku": f"FORN-{idx:05d}",
            "leadTime": str(random.randint(3, 7)),
            "weight": f"{random.uniform(0.1, 2.0):.3f}",
            "width": str(random.randint(10, 30)),
            "height": str(random.randint(5, 20)),
            "depth": str(random.randint(10, 30)),
            "shippingCost": f"{random.uniform(10, 30):.2f}"
        }

        product = Product.objects.create(
            name=prod_data['name'],
            description=prod_data['description'],
            price=Decimal(prod_data['price']),
            sku=sku,
            stock=prod_data['stock'],
            currency='BRL',
            category=category,
            badge='Mais Vendido' if idx % 5 == 0 else ('Lançamento' if idx % 7 == 0 else ''),
            specs=specs,
            dropshipping_info=dropshipping_info,
            organization=organization,
            sede=sede,
            created_by=user
        )
        products.append(product)
        print(f"  ✓ {product.name} - R$ {product.price}")

    print(f"\n✅ {len(products)} produtos criados!")
    return products

def create_media_folders(organization, sede, user):
    """Cria estrutura de pastas de mídia"""
    print("\n📁 Criando pastas de mídia...")

    folders = {}

    folders_data = [
        {'name': 'Produtos', 'subfolders': ['Embalagens', 'Food Service', 'Confeitaria']},
        {'name': 'Catálogos', 'subfolders': ['2024', '2025']},
        {'name': 'Marketing', 'subfolders': ['Banners', 'Redes Sociais', 'Email Marketing']},
    ]

    for folder_data in folders_data:
        # Criar pasta principal
        main_folder = MediaFolder.objects.create(
            name=folder_data['name'],
            organization=organization,
            sede=sede,
            created_by=user
        )
        folders[folder_data['name']] = main_folder
        print(f"  ✓ {main_folder.name}")

        # Criar subpastas
        for subfolder_name in folder_data['subfolders']:
            subfolder = MediaFolder.objects.create(
                name=subfolder_name,
                parent=main_folder,
                organization=organization,
                sede=sede,
                created_by=user
            )
            folders[f"{folder_data['name']}/{subfolder_name}"] = subfolder
            print(f"    ✓ {subfolder.name}")

    return folders

def create_themes(organization, sede, user):
    """Cria temas profissionais para catálogos"""
    print("\n🎨 Criando temas...")

    themes_data = [
        {
            'name': 'Catana Corporativo',
            'styles': {
                'primaryColor': '#2D2D2D',
                'secondaryColor': '#FFFFFF',
                'accentColor': '#4CAF50',
                'fontFamily': 'Inter, sans-serif',
                'fontSize': '16px',
                'headerFont': 'Poppins, sans-serif'
            }
        },
        {
            'name': 'Catana Clean',
            'styles': {
                'primaryColor': '#FFFFFF',
                'secondaryColor': '#F5F5F5',
                'accentColor': '#2196F3',
                'fontFamily': 'Roboto, sans-serif',
                'fontSize': '15px',
                'headerFont': 'Montserrat, sans-serif'
            }
        },
        {
            'name': 'Catana Elegante',
            'styles': {
                'primaryColor': '#1A1A1A',
                'secondaryColor': '#E0E0E0',
                'accentColor': '#FFD700',
                'fontFamily': 'Lato, sans-serif',
                'fontSize': '16px',
                'headerFont': 'Playfair Display, serif'
            }
        }
    ]

    themes = []
    for theme_data in themes_data:
        theme = Theme.objects.create(
            name=theme_data['name'],
            styles=theme_data['styles'],
            organization=organization,
            sede=sede,
            created_by=user
        )
        themes.append(theme)
        print(f"  ✓ {theme.name}")

    return themes

def create_catalogs(themes, organization, sede, user, products):
    """Cria catálogos profissionais"""
    print("\n📚 Criando catálogos...")

    catalogs_data = [
        {
            'title': 'Catálogo Geral Catana 2025',
            'description': 'Catálogo completo com toda a linha de produtos Catana para o ano de 2025. Inclui embalagens para alimentos, food service, confeitaria e linha festa.',
            'is_public': True,
            'pages': 12
        },
        {
            'title': 'Linha Food Service Premium',
            'description': 'Soluções completas para restaurantes, delivery e eventos. Marmitas, copos, tampas e talheres de alta qualidade.',
            'is_public': True,
            'pages': 8
        },
        {
            'title': 'Embalagens para Confeitaria',
            'description': 'Linha especializada em embalagens para doces, bolos e sobremesas. Caixas, potes e acessórios para confeiteiros profissionais.',
            'is_public': True,
            'pages': 6
        },
        {
            'title': 'Soluções para Açougues e Hortifruti',
            'description': 'Bandejas, filmes e embalagens para carnes, frutas e legumes. Produtos que garantem frescor e apresentação.',
            'is_public': True,
            'pages': 5
        },
        {
            'title': 'Linha Festa - Eventos Especiais',
            'description': 'Copos, pratos e acessórios para festas e eventos. Produtos coloridos, resistentes e elegantes.',
            'is_public': False,
            'pages': 4
        },
    ]

    catalogs = []
    for idx, cat_data in enumerate(catalogs_data):
        theme = themes[idx % len(themes)]

        catalog = Catalog.objects.create(
            title=cat_data['title'],
            description=cat_data['description'],
            theme=theme,
            organization=organization,
            sede=sede,
            created_by=user,
            is_public=cat_data['is_public']
        )

        # Criar páginas para o catálogo
        for page_num in range(1, cat_data['pages'] + 1):
            Page.objects.create(
                catalog=catalog,
                order=page_num
            )

        # Simular alguns likes
        if random.random() > 0.5:
            catalog.likes.add(user)

        catalogs.append(catalog)
        print(f"  ✓ {catalog.title} ({catalog.pages.count()} páginas)")

    return catalogs

def add_catalog_comments(catalogs, user):
    """Adiciona comentários aos catálogos públicos"""
    print("\n💬 Adicionando comentários...")

    comments_text = [
        "Excelente qualidade dos produtos! Recomendo.",
        "Catálogo muito bem organizado e completo.",
        "Preços competitivos e ótimo atendimento.",
        "Material de primeira linha, muito satisfeito.",
        "Entrega rápida e produtos conforme especificado.",
    ]

    total_comments = 0
    for catalog in catalogs:
        if catalog.is_public:
            num_comments = random.randint(2, 5)
            for _ in range(num_comments):
                Comment.objects.create(
                    catalog=catalog,
                    user=user,
                    text=random.choice(comments_text)
                )
                total_comments += 1

    print(f"  ✓ {total_comments} comentários adicionados")

def main():
    """Função principal que executa todo o processo"""
    print("\n" + "="*60)
    print("🚀 SEED DATABASE - CATANA EMBALAGENS")
    print("="*60)

    # Verificar se existe usuário admin
    user = User.objects.filter(is_superuser=True).first()
    if not user:
        print("❌ Erro: Nenhum usuário admin encontrado!")
        print("   Execute: python manage.py createsuperuser")
        sys.exit(1)

    # Verificar organização
    organization = Organization.objects.first()
    if not organization:
        print("📊 Criando organização padrão...")
        organization = Organization.objects.create(
            name="Catana Embalagens",
            description="Soluções em embalagens plásticas de alta qualidade",
            owner=user
        )
        user.organizations.add(organization)

    # Verificar sede
    sede = Sede.objects.filter(organization=organization).first()
    if not sede:
        print("🏢 Criando sede padrão...")
        sede = Sede.objects.create(
            name="Matriz",
            organization=organization,
            responsible_user=user
        )
        user.sedes.add(sede)

    print(f"\n👤 Usuário: {user.username}")
    print(f"🏢 Organização: {organization.name}")
    print(f"📍 Sede: {sede.name}")

    # Limpar dados antigos
    clear_database()

    # Criar dados novos
    categories = create_categories(organization, sede, user)
    products = create_products(categories, organization, sede, user)
    folders = create_media_folders(organization, sede, user)
    themes = create_themes(organization, sede, user)
    catalogs = create_catalogs(themes, organization, sede, user, products)
    add_catalog_comments(catalogs, user)

    # Resumo final
    print("\n" + "="*60)
    print("✨ RESUMO DO SEED")
    print("="*60)
    print(f"📦 Categorias: {Category.objects.count()}")
    print(f"🏷️  Produtos: {Product.objects.count()}")
    print(f"📁 Pastas de Mídia: {MediaFolder.objects.count()}")
    print(f"🎨 Temas: {Theme.objects.count()}")
    print(f"📚 Catálogos: {Catalog.objects.count()}")
    print(f"📄 Páginas: {Page.objects.count()}")
    print(f"💬 Comentários: {Comment.objects.count()}")
    print("="*60)
    print("✅ Banco de dados populado com sucesso!")
    print("="*60 + "\n")

if __name__ == '__main__':
    main()
