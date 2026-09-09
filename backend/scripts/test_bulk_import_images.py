#!/usr/bin/env python3
"""
Teste de processamento de imagens no bulk import
"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'catana_back.settings')
django.setup()

from api.models import User, Organization, Sede, Product, ProductMedia
from rest_framework.test import APIRequestFactory, force_authenticate
from api.views import ProductViewSet

def test_image_processing():
    print("=== Teste de Processamento de Imagens ===\n")

    # 1. Preparar ambiente
    print("1. Preparando ambiente...")
    user = User.objects.filter(is_superuser=True).first()
    org = user.organizations.first()
    sede = org.sedes.first()
    print(f"   ✅ Usuário: {user.username}, Org: {org.name}, Sede: {sede.name}")

    # 2. Limpar produtos de teste
    print("\n2. Limpando produtos de teste anteriores...")
    Product.objects.filter(sku='IMG-TEST-001').delete()
    print("   ✅ Limpeza concluída")

    # 3. Teste com imagens reais
    print("\n3. Testando importação com imagens...")

    # URLs de imagens de teste (usar placeholders públicos)
    test_data = {
        "products": [
            {
                "name": "Produto com Imagens",
                "sku": "IMG-TEST-001",
                "price": 99.90,
                "description": "Teste de processamento de imagens",
                "category": "Teste Imagens",
                "stock": 10,
                "currency": "BRL",
                "sede": sede.id,
                "organization": org.id,
                # Imagem principal
                "image_main": "https://via.placeholder.com/800x600/FF5733/FFFFFF?text=Cover",
                # Galeria (separada por |)
                "image_gallery": "https://via.placeholder.com/800x600/33FF57/FFFFFF?text=Gallery+1|https://via.placeholder.com/800x600/3357FF/FFFFFF?text=Gallery+2|https://via.placeholder.com/800x600/FF33F5/FFFFFF?text=Gallery+3"
            }
        ]
    }

    factory = APIRequestFactory()
    request = factory.post('/api/products/bulk_import/', test_data, format='json')
    force_authenticate(request, user=user)

    view = ProductViewSet.as_view({'post': 'bulk_import'})
    response = view(request)

    print(f"   Status: {response.status_code}")
    print(f"   Resposta: {response.data}")

    if response.data['success'] == 1:
        print("   ✅ Produto criado com sucesso!")

        # 4. Verificar produto e imagens
        print("\n4. Verificando produto e imagens...")
        product = Product.objects.get(sku='IMG-TEST-001')
        print(f"   Produto ID: {product.id}")
        print(f"   Nome: {product.name}")

        # Verificar imagem de capa
        if product.cover_image:
            print(f"   ✅ Imagem de capa: {product.cover_image.file.name}")
        else:
            print("   ⚠️ Imagem de capa NÃO foi processada")

        # Verificar galeria
        gallery_count = ProductMedia.objects.filter(product=product).count()
        print(f"   Galeria: {gallery_count} imagens")

        if gallery_count > 0:
            print("   Imagens da galeria:")
            for pm in ProductMedia.objects.filter(product=product):
                print(f"      - Ordem {pm.order}: {pm.media.file.name}")
            print("   ✅ Galeria processada com sucesso!")
        else:
            print("   ⚠️ Galeria NÃO foi processada")

    else:
        print(f"   ❌ Falha ao criar produto")
        print(f"   Erros: {response.data.get('errors', [])}")

    # 5. Teste com URLs inválidas (deve criar produto mesmo assim)
    print("\n5. Testando com URLs inválidas...")
    Product.objects.filter(sku='IMG-TEST-002').delete()

    test_data_invalid = {
        "products": [
            {
                "name": "Produto com Imagem Inválida",
                "sku": "IMG-TEST-002",
                "price": 149.90,
                "sede": sede.id,
                "organization": org.id,
                "image_main": "https://invalid-url-that-does-not-exist.com/image.jpg"
            }
        ]
    }

    request = factory.post('/api/products/bulk_import/', test_data_invalid, format='json')
    force_authenticate(request, user=user)
    response = view(request)

    print(f"   Status: {response.status_code}")
    print(f"   Sucesso: {response.data['success']}")

    if response.data['success'] == 1:
        product = Product.objects.get(sku='IMG-TEST-002')
        if product.cover_image:
            print("   ❌ Produto NÃO deveria ter imagem")
        else:
            print("   ✅ Produto criado SEM imagem (correto - erro de imagem não bloqueou)")
    else:
        print("   ❌ Produto não foi criado (erro - imagem não deveria bloquear)")

    print("\n=== Teste Concluído ===")

if __name__ == '__main__':
    test_image_processing()
