#!/usr/bin/env python3
"""
Script de teste para bulk import de produtos
"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'catana_back.settings')
django.setup()

from api.models import User, Organization, Sede, Product
from api.serializers import BulkImportRequestSerializer
from rest_framework.test import APIRequestFactory
from api.views import ProductViewSet

def test_bulk_import():
    print("=== Teste de Bulk Import ===\n")

    # 1. Buscar ou criar usuário de teste
    print("1. Preparando usuário...")
    user = User.objects.filter(is_superuser=True).first()
    if not user:
        print("   ❌ Nenhum superusuário encontrado. Crie um primeiro.")
        return
    print(f"   ✅ Usuário: {user.username}")

    # 2. Buscar ou criar organização
    print("\n2. Preparando organização...")
    org = user.organizations.first()
    if not org:
        print("   ⚠️  Criando organização de teste...")
        org = Organization.objects.create(
            name="Organização Teste",
            owner=user
        )
        user.organizations.add(org)
    print(f"   ✅ Organização: {org.name} (ID: {org.id})")

    # 3. Buscar ou criar sede
    print("\n3. Preparando sede...")
    sede = org.sedes.first()
    if not sede:
        print("   ⚠️  Criando sede de teste...")
        sede = Sede.objects.create(
            name="Sede Teste",
            organization=org,
            responsible_user=user
        )
        user.sedes.add(sede)
    print(f"   ✅ Sede: {sede.name} (ID: {sede.id})")

    # 4. Preparar dados de teste
    print("\n4. Preparando dados de teste...")
    test_data = {
        "products": [
            {
                "name": "Produto Teste 1",
                "sku": "TEST-001",
                "price": 99.90,
                "description": "Produto de teste 1",
                "category": "Eletrônicos",
                "stock": 10,
                "currency": "BRL",
                "sede": sede.id,
                "organization": org.id
            },
            {
                "name": "Produto Teste 2",
                "sku": "TEST-002",
                "price": 149.90,
                "description": "Produto de teste 2",
                "category": "Eletrônicos",
                "stock": 5,
                "currency": "BRL",
                "sede": sede.id,
                "organization": org.id
            },
            {
                "name": "Produto Teste 3",
                "sku": "TEST-003",
                "price": 199.90,
                "stock": 20,
                "currency": "BRL",
                "sede": sede.id,
                "organization": org.id
            }
        ]
    }

    # 5. Validar serializer
    print("\n5. Validando serializer...")
    serializer = BulkImportRequestSerializer(data=test_data)
    if not serializer.is_valid():
        print(f"   ❌ Erro de validação: {serializer.errors}")
        return
    print("   ✅ Dados válidos!")

    # 6. Limpar produtos de teste anteriores
    print("\n6. Limpando produtos de teste anteriores...")
    deleted = Product.objects.filter(sku__startswith='TEST-').delete()
    print(f"   ✅ {deleted[0]} produtos removidos")

    # 7. Testar endpoint
    print("\n7. Testando endpoint bulk_import...")
    from rest_framework.test import force_authenticate
    factory = APIRequestFactory()
    request = factory.post(
        '/api/products/bulk_import/',
        test_data,
        format='json'
    )
    force_authenticate(request, user=user)

    view = ProductViewSet.as_view({'post': 'bulk_import'})
    response = view(request)

    # 8. Verificar resultado
    print("\n8. Resultado:")
    print(f"   Status: {response.status_code}")
    print(f"   Dados: {response.data}")

    if response.status_code == 200:
        print(f"\n   ✅ Sucesso: {response.data['success']} produtos criados")
        print(f"   ❌ Falhas: {response.data['failed']}")
        if response.data['errors']:
            print(f"   Erros: {response.data['errors']}")
        print(f"   IDs criados: {response.data['created_ids']}")
    else:
        print(f"\n   ❌ Erro: {response.data}")

    # 9. Verificar produtos criados
    print("\n9. Verificando produtos no banco...")
    products = Product.objects.filter(sku__startswith='TEST-')
    print(f"   ✅ {products.count()} produtos encontrados no banco")
    for p in products:
        print(f"      - {p.name} (SKU: {p.sku}, Preço: {p.price})")

    print("\n=== Teste Concluído ===")

if __name__ == '__main__':
    test_bulk_import()
