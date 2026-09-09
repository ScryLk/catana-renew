#!/usr/bin/env python3
"""
Script de teste para validações de erro no bulk import
"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'catana_back.settings')
django.setup()

from api.models import User, Organization, Sede, Product
from api.serializers import BulkImportRequestSerializer
from rest_framework.test import APIRequestFactory, force_authenticate
from api.views import ProductViewSet

def test_bulk_import_errors():
    print("=== Teste de Validações e Erros ===\n")

    # 1. Preparar ambiente
    print("1. Preparando ambiente...")
    user = User.objects.filter(is_superuser=True).first()
    org = user.organizations.first()
    sede = org.sedes.first()
    print(f"   ✅ Usuário: {user.username}, Org: {org.name}, Sede: {sede.name}")

    # 2. Teste: SKU duplicado
    print("\n2. Teste: SKU duplicado")
    Product.objects.filter(sku='DUP-001').delete()
    Product.objects.create(
        name="Produto Original",
        sku="DUP-001",
        price=100,
        description="Original",
        organization=org,
        sede=sede,
        created_by=user
    )

    test_data = {
        "products": [
            {
                "name": "Produto Novo",
                "sku": "DUP-001",  # Duplicado!
                "price": 200,
                "sede": sede.id,
                "organization": org.id
            }
        ]
    }

    factory = APIRequestFactory()
    request = factory.post('/api/products/bulk_import/', test_data, format='json')
    force_authenticate(request, user=user)
    view = ProductViewSet.as_view({'post': 'bulk_import'})
    response = view(request)

    print(f"   Status: {response.status_code}")
    print(f"   Sucesso: {response.data['success']}, Falhas: {response.data['failed']}")
    print(f"   Erros: {response.data['errors']}")
    assert response.data['failed'] == 1, "Deveria ter falhado 1 produto"
    assert 'já existe' in response.data['errors'][0], "Erro deveria mencionar SKU duplicado"
    print("   ✅ SKU duplicado detectado corretamente!")

    # 3. Teste: Nome vazio (validação do serializer)
    print("\n3. Teste: Nome vazio (validação do serializer)")
    test_data = {
        "products": [
            {
                "name": "",  # Vazio!
                "sku": "EMPTY-001",
                "price": 100,
                "sede": sede.id,
                "organization": org.id
            }
        ]
    }

    request = factory.post('/api/products/bulk_import/', test_data, format='json')
    force_authenticate(request, user=user)
    response = view(request)

    print(f"   Status: {response.status_code}")
    if response.status_code == 400:
        print(f"   Erro de validação (esperado): {response.data}")
        assert 'error' in response.data or 'details' in response.data, "Deveria retornar erro de validação"
        print("   ✅ Nome vazio detectado pelo serializer!")
    else:
        print(f"   Sucesso: {response.data['success']}, Falhas: {response.data['failed']}")
        print(f"   Erros: {response.data['errors']}")
        assert response.data['failed'] == 1, "Deveria ter falhado 1 produto"
        print("   ✅ Nome vazio detectado corretamente!")

    # 4. Teste: Organização inválida
    print("\n4. Teste: Organização inválida")
    test_data = {
        "products": [
            {
                "name": "Produto Teste",
                "sku": "ORG-001",
                "price": 100,
                "sede": sede.id,
                "organization": 99999  # Não existe!
            }
        ]
    }

    request = factory.post('/api/products/bulk_import/', test_data, format='json')
    force_authenticate(request, user=user)
    response = view(request)

    print(f"   Status: {response.status_code}")
    print(f"   Sucesso: {response.data['success']}, Falhas: {response.data['failed']}")
    print(f"   Erros: {response.data['errors']}")
    assert response.data['failed'] == 1, "Deveria ter falhado 1 produto"
    assert 'organização' in response.data['errors'][0].lower() or 'organization' in response.data['errors'][0].lower(), "Erro deveria mencionar organização"
    print("   ✅ Organização inválida detectada corretamente!")

    # 5. Teste: Importação mista (sucesso + erro)
    print("\n5. Teste: Importação mista (2 sucessos + 1 erro)")
    Product.objects.filter(sku__startswith='MIX-').delete()

    test_data = {
        "products": [
            {
                "name": "Produto OK 1",
                "sku": "MIX-001",
                "price": 100,
                "sede": sede.id,
                "organization": org.id
            },
            {
                "name": "",  # Erro!
                "sku": "MIX-002",
                "price": 200,
                "sede": sede.id,
                "organization": org.id
            },
            {
                "name": "Produto OK 2",
                "sku": "MIX-003",
                "price": 300,
                "sede": sede.id,
                "organization": org.id
            }
        ]
    }

    request = factory.post('/api/products/bulk_import/', test_data, format='json')
    force_authenticate(request, user=user)
    response = view(request)

    print(f"   Status: {response.status_code}")
    print(f"   Sucesso: {response.data['success']}, Falhas: {response.data['failed']}")
    print(f"   Erros: {response.data['errors']}")
    print(f"   IDs criados: {response.data['created_ids']}")
    assert response.data['success'] == 2, "Deveria ter criado 2 produtos"
    assert response.data['failed'] == 1, "Deveria ter falhado 1 produto"
    print("   ✅ Importação mista funcionou corretamente!")

    # 6. Teste: Limite de 500 produtos
    print("\n6. Teste: Limite de 500 produtos")
    test_data = {
        "products": [
            {
                "name": f"Produto {i}",
                "sku": f"LIMIT-{i:04d}",
                "price": 100,
                "sede": sede.id,
                "organization": org.id
            }
            for i in range(501)  # 501 produtos!
        ]
    }

    request = factory.post('/api/products/bulk_import/', test_data, format='json')
    force_authenticate(request, user=user)
    response = view(request)

    print(f"   Status: {response.status_code}")
    print(f"   Resposta: {response.data}")
    assert response.status_code == 400, "Deveria retornar 400 (Bad Request)"
    message = response.data.get('message', '').lower()
    assert 'limite' in message or 'máximo' in message or '500' in str(response.data), "Erro deveria mencionar limite"
    print("   ✅ Limite de 500 produtos verificado!")

    # 7. Teste: Criação automática de categorias
    print("\n7. Teste: Criação automática de categorias")
    Product.objects.filter(sku='CAT-001').delete()

    test_data = {
        "products": [
            {
                "name": "Produto com Categoria Nova",
                "sku": "CAT-001",
                "price": 100,
                "category": "Categoria Nova Teste",
                "sede": sede.id,
                "organization": org.id
            }
        ]
    }

    request = factory.post('/api/products/bulk_import/', test_data, format='json')
    force_authenticate(request, user=user)
    response = view(request)

    print(f"   Status: {response.status_code}")
    print(f"   Sucesso: {response.data['success']}")

    # Verificar se a categoria foi criada
    from api.models import Category
    category = Category.objects.filter(name="Categoria Nova Teste", sede=sede).first()
    assert category is not None, "Categoria deveria ter sido criada"
    print(f"   ✅ Categoria '{category.name}' criada automaticamente!")

    print("\n=== Todos os Testes Passaram! ✅ ===")

if __name__ == '__main__':
    test_bulk_import_errors()
