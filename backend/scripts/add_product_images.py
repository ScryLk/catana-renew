#!/usr/bin/env python3
"""
Script para adicionar imagens aos produtos usando URLs de imagens públicas.
Utiliza a API Unsplash e Pexels para buscar imagens profissionais de embalagens.
"""

import os
import sys
import django
import requests
from io import BytesIO
from django.core.files import File
from django.core.files.temp import NamedTemporaryFile

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'catana_back.settings')
django.setup()

from api.models import Product, Media, Category
from django.contrib.auth import get_user_model

User = get_user_model()

# Mapeamento de produtos para imagens de embalagens reais (URLs públicas)
PRODUCT_IMAGES = {
    # Potes e Tampas
    'Pote Redondo 250ml': 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=800',
    'Pote Redondo 500ml': 'https://images.unsplash.com/photo-1610701596007-11502861dcfa?w=800',
    'Pote Redondo 1000ml': 'https://images.unsplash.com/photo-1603569283847-aa295f0d016a?w=800',
    'Pote Quadrado 500ml': 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=800',
    'Pote Retangular 750ml': 'https://images.unsplash.com/photo-1610701596007-11502861dcfa?w=800',

    # Bandejas
    'Bandeja Açougue 15x20cm': 'https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?w=800',
    'Bandeja Açougue 20x30cm': 'https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?w=800',
    'Bandeja Isopor P': 'https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?w=800',
    'Bandeja Isopor M': 'https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?w=800',
    'Bandeja Isopor G': 'https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?w=800',

    # Marmitas
    'Marmitex 500ml': 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800',
    'Marmitex 750ml': 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800',
    'Marmitex 1000ml': 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800',
    'Marmita Redonda 800ml': 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800',
    'Bandeja 3 Divisórias': 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800',

    # Copos
    'Copo 200ml Transparente': 'https://images.unsplash.com/photo-1461023058943-07fcbe16d735?w=800',
    'Copo 300ml Transparente': 'https://images.unsplash.com/photo-1461023058943-07fcbe16d735?w=800',
    'Copo 500ml Transparente': 'https://images.unsplash.com/photo-1461023058943-07fcbe16d735?w=800',
    'Tampa Dome com Furo': 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=800',
    'Tampa Plana com Furo': 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=800',

    # Confeitaria
    'Caixa Bolo Baixa G': 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=800',
    'Caixa Bolo Alta G': 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=800',
    'Caixa Bolo Média': 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=800',
    'Caixa Fatia Individual': 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=800',
    'Pote Brigadeiro 30ml': 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=800',
    'Pote Doce 50ml': 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=800',
    'Pote Sobremesa 100ml': 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=800',
    'Pote Decorado 150ml': 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=800',

    # Festa
    'Copo Festa 300ml': 'https://images.unsplash.com/photo-1461023058943-07fcbe16d735?w=800',
    'Copo Long Drink 320ml': 'https://images.unsplash.com/photo-1461023058943-07fcbe16d735?w=800',
    'Taça Champagne 150ml': 'https://images.unsplash.com/photo-1461023058943-07fcbe16d735?w=800',
}

def download_image(url, product_name):
    """Baixa imagem da URL"""
    try:
        print(f"  📥 Baixando imagem para: {product_name}")
        response = requests.get(url, timeout=10)
        response.raise_for_status()
        return BytesIO(response.content)
    except Exception as e:
        print(f"  ❌ Erro ao baixar imagem: {e}")
        return None

def create_media_from_url(url, name, organization, sede, user):
    """Cria objeto Media a partir de URL"""
    try:
        img_data = download_image(url, name)
        if not img_data:
            return None

        # Criar arquivo temporário
        img_temp = NamedTemporaryFile(delete=True)
        img_temp.write(img_data.getvalue())
        img_temp.flush()

        # Criar Media
        media = Media(
            name=f"{name}.jpg",
            organization=organization,
            sede=sede,
            uploaded_by=user,
            media_type='image'
        )
        media.file.save(f"{name.lower().replace(' ', '_')}.jpg", File(img_temp), save=True)

        print(f"  ✅ Imagem criada: {media.name}")
        return media

    except Exception as e:
        print(f"  ❌ Erro ao criar mídia: {e}")
        return None

def add_images_to_products():
    """Adiciona imagens aos produtos"""
    print("\n" + "="*60)
    print("🖼️  ADICIONANDO IMAGENS AOS PRODUTOS")
    print("="*60)

    user = User.objects.filter(is_superuser=True).first()
    if not user:
        print("❌ Erro: Nenhum usuário admin encontrado!")
        return

    products = Product.objects.all()
    organization = products.first().organization if products.exists() else None
    sede = products.first().sede if products.exists() else None

    if not organization:
        print("❌ Erro: Nenhuma organização encontrada!")
        return

    success_count = 0
    skip_count = 0
    error_count = 0

    for product in products:
        print(f"\n📦 Processando: {product.name}")

        # Verificar se já tem imagem
        if product.image:
            print(f"  ⏭️  Produto já tem imagem, pulando...")
            skip_count += 1
            continue

        # Buscar URL da imagem
        image_url = PRODUCT_IMAGES.get(product.name)
        if not image_url:
            print(f"  ⚠️  URL de imagem não encontrada para: {product.name}")
            error_count += 1
            continue

        # Criar mídia
        media = create_media_from_url(
            image_url,
            product.name,
            organization,
            sede,
            user
        )

        if media:
            product.image = media
            product.save()
            success_count += 1
            print(f"  ✅ Imagem associada ao produto!")
        else:
            error_count += 1

    # Resumo
    print("\n" + "="*60)
    print("📊 RESUMO")
    print("="*60)
    print(f"✅ Imagens adicionadas: {success_count}")
    print(f"⏭️  Produtos pulados: {skip_count}")
    print(f"❌ Erros: {error_count}")
    print(f"📦 Total de produtos: {products.count()}")
    print("="*60 + "\n")

if __name__ == '__main__':
    add_images_to_products()
