#!/usr/bin/env python3
"""
Script para inserir produtos fictícios no banco de dados
"""
import os
import django
import random
from decimal import Decimal

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'catana_back.settings')
django.setup()

from api.models import User, Organization, Sede, Product, Category
from django.utils.text import slugify

# Configurações
QUANTIDADE = 1000  # Número de produtos a inserir

# Listas de dados fictícios
PREFIXOS = ['Premium', 'Standard', 'Basic', 'Pro', 'Max', 'Ultra', 'Super', 'Mega', 'Mini', 'Lite']
TIPOS = ['Kit', 'Pack', 'Combo', 'Set', 'Bundle', 'Collection', 'Box', 'Item', 'Product', 'Article']
SUFIXOS = ['Plus', 'Advanced', 'Professional', 'Essential', 'Complete', 'Deluxe', 'Limited', 'Special', 'Edition', 'Series']

CATEGORIAS = [
    'Eletrônicos', 'Moda', 'Casa e Decoração', 'Esportes', 'Livros',
    'Brinquedos', 'Beleza', 'Alimentos', 'Ferramentas', 'Automotivo',
    'Pets', 'Música', 'Informática', 'Saúde', 'Jardinagem'
]

DESCRICOES = [
    'Produto de alta qualidade com excelente acabamento',
    'Item essencial para o dia a dia',
    'Perfeito para quem busca praticidade',
    'Desenvolvido com tecnologia de ponta',
    'Design moderno e funcional',
    'Ideal para uso profissional',
    'Máxima durabilidade e resistência',
    'Produto certificado e testado',
    'Solução completa para suas necessidades',
    'Inovação e qualidade em um só produto'
]

def gerar_nome_produto():
    """Gera nome aleatório para produto"""
    prefixo = random.choice(PREFIXOS)
    tipo = random.choice(TIPOS)
    sufixo = random.choice(SUFIXOS) if random.random() > 0.5 else ''

    if sufixo:
        return f"{prefixo} {tipo} {sufixo}"
    return f"{prefixo} {tipo}"

def gerar_sku():
    """Gera SKU único"""
    import uuid
    return f"PROD-{uuid.uuid4().hex[:8].upper()}"

def inserir_produtos():
    print(f"=== Inserindo {QUANTIDADE} produtos fictícios ===\n")

    # Obter usuário admin e organização
    user = User.objects.filter(is_superuser=True).first()
    if not user:
        print("❌ Nenhum usuário admin encontrado")
        return

    org = user.organizations.first()
    if not org:
        print("❌ Nenhuma organização encontrada")
        return

    sede = org.sedes.first()
    if not sede:
        print("❌ Nenhuma sede encontrada")
        return

    print(f"✅ Usando usuário: {user.username}")
    print(f"✅ Organização: {org.name}")
    print(f"✅ Sede: {sede.name}\n")

    # Criar ou obter categorias
    categorias_obj = {}
    print("Criando categorias...")
    for cat_name in CATEGORIAS:
        cat, created = Category.objects.get_or_create(
            name=cat_name,
            organization=org,
            sede=sede,
            defaults={'created_by': user}
        )
        categorias_obj[cat_name] = cat
    print(f"✅ {len(categorias_obj)} categorias prontas\n")

    # Inserir produtos
    print(f"Inserindo {QUANTIDADE} produtos...")
    produtos_criados = 0
    produtos_falhos = 0

    for i in range(QUANTIDADE):
        try:
            nome = gerar_nome_produto()
            sku = gerar_sku()
            preco = Decimal(random.uniform(10, 1000)).quantize(Decimal('0.01'))
            estoque = random.randint(0, 500)
            categoria = random.choice(list(categorias_obj.values()))
            descricao = random.choice(DESCRICOES)

            # Alguns produtos serão públicos
            is_public = random.random() > 0.3  # 70% públicos

            produto = Product.objects.create(
                name=nome,
                sku=sku,
                price=preco,
                stock=estoque,
                currency='BRL',
                category=categoria,
                description=descricao,
                organization=org,
                sede=sede,
                created_by=user,
                is_public=is_public
            )

            # Se for público, gerar slug
            if is_public:
                produto.public_slug = f"{slugify(nome)}-{produto.id}"
                produto.save(update_fields=['public_slug'])

            produtos_criados += 1

            # Mostrar progresso
            if (i + 1) % 100 == 0:
                print(f"  {i + 1}/{QUANTIDADE} produtos criados...")

        except Exception as e:
            produtos_falhos += 1
            if produtos_falhos <= 5:  # Mostrar apenas os primeiros 5 erros
                print(f"  ⚠️  Erro ao criar produto {i + 1}: {e}")

    print(f"\n✅ Processo concluído!")
    print(f"   Produtos criados: {produtos_criados}")
    print(f"   Produtos públicos: {Product.objects.filter(is_public=True).count()}")
    print(f"   Falhas: {produtos_falhos}")
    print(f"   Total no sistema: {Product.objects.count()}")

if __name__ == '__main__':
    inserir_produtos()
