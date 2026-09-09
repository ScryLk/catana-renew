# Especificação Backend - Importação em Lote de Produtos

## 📋 Visão Geral

Implementar endpoint para criação em lote de produtos via importação de planilhas XLSX/CSV.

---

## 🎯 Endpoint Requerido

### `POST /api/products/bulk_import/`

**Descrição**: Cria múltiplos produtos de uma vez, validando e retornando resultado detalhado.

---

## 📥 Request Body

```json
{
  "products": [
    {
      "name": "Produto Exemplo",
      "sku": "SKU-001",
      "price": 99.90,
      "description": "Descrição do produto",
      "category": "categoria-id-ou-nome",
      "stock": 100,
      "currency": "BRL",
      "image_url": "https://example.com/image.jpg",
      "sede": 1,
      "organization": 1
    },
    {
      "name": "Outro Produto",
      "sku": "SKU-002",
      "price": 149.90,
      "stock": 50,
      "currency": "BRL",
      "sede": 1,
      "organization": 1
    }
  ]
}
```

### Campos do Produto

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `name` | string | ✅ Sim | Nome do produto |
| `sku` | string | ✅ Sim | Código único do produto (SKU) |
| `price` | decimal | ❌ Não | Preço do produto |
| `description` | string | ❌ Não | Descrição detalhada |
| `category` | string/int | ❌ Não | ID ou nome da categoria |
| `stock` | integer | ❌ Não | Quantidade em estoque (padrão: 0) |
| `currency` | string | ❌ Não | Código da moeda (padrão: "BRL") |
| `image_url` | string | ❌ Não | URL da imagem do produto |
| `sede` | integer | ✅ Sim | ID da sede |
| `organization` | integer | ✅ Sim | ID da organização |

---

## 📤 Response

### Sucesso (Status 200)

```json
{
  "success": 150,
  "failed": 5,
  "errors": [
    "Linha 3: SKU 'ABC-001' já existe no sistema",
    "Linha 7: Campo obrigatório 'name' está vazio",
    "Linha 12: SKU 'XYZ-999' já existe no sistema",
    "Linha 18: Preço inválido: 'abc'",
    "Linha 25: Categoria 'InvalidCat' não encontrada"
  ],
  "created_ids": [1, 2, 3, 4, 5, ...] // IDs dos produtos criados
}
```

### Erro (Status 400)

```json
{
  "error": "Dados inválidos",
  "message": "O campo 'products' é obrigatório e deve ser uma lista"
}
```

### Erro de Autenticação (Status 401)

```json
{
  "detail": "Authentication credentials were not provided."
}
```

### Erro de Permissão (Status 403)

```json
{
  "detail": "Você não tem permissão para criar produtos nesta organização/sede."
}
```

---

## 🔍 Validações Necessárias

### 1. Validações de Dados

- ✅ **SKU único**: Verificar se SKU já existe no sistema (por sede/organização)
- ✅ **Campos obrigatórios**: `name`, `sku` devem estar preenchidos
- ✅ **Formato de preço**: Validar se `price` é um número válido
- ✅ **Formato de estoque**: Validar se `stock` é um inteiro não-negativo
- ✅ **Categoria**: Se fornecida, verificar se existe ou criar dinamicamente

### 2. Validações de Contexto

- ✅ **Sede existe**: Verificar se `sede` é válida
- ✅ **Organização existe**: Verificar se `organization` é válida
- ✅ **Permissões**: Usuário tem acesso à sede/organização

### 3. Normalização de Dados

- ✅ **Trim**: Remover espaços extras de strings
- ✅ **SKU uppercase**: Converter SKU para maiúsculas (opcional, conforme padrão)
- ✅ **Preço**: Converter para Decimal com 2 casas decimais
- ✅ **Moeda padrão**: Se não fornecida, usar "BRL"

---

## ⚙️ Implementação Sugerida (Django)

### 1. Serializer

```python
# serializers.py
from rest_framework import serializers
from .models import Product, Category

class BulkProductSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=255, required=True)
    sku = serializers.CharField(max_length=100, required=True)
    price = serializers.DecimalField(max_digits=10, decimal_places=2, required=False, allow_null=True)
    description = serializers.CharField(required=False, allow_blank=True)
    category = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    stock = serializers.IntegerField(default=0, required=False)
    currency = serializers.CharField(max_length=3, default='BRL', required=False)
    image_url = serializers.URLField(required=False, allow_blank=True, allow_null=True)
    sede = serializers.IntegerField(required=True)
    organization = serializers.IntegerField(required=True)

class BulkImportRequestSerializer(serializers.Serializer):
    products = BulkProductSerializer(many=True)
```

### 2. View

```python
# views.py
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db import transaction
from .models import Product, Category, Sede, Organization
from .serializers import BulkImportRequestSerializer

class ProductViewSet(viewsets.ModelViewSet):
    # ... outras configurações ...

    @action(detail=False, methods=['post'], permission_classes=[IsAuthenticated])
    def bulk_import(self, request):
        """
        Importação em lote de produtos
        """
        serializer = BulkImportRequestSerializer(data=request.data)

        if not serializer.is_valid():
            return Response(
                {'error': 'Dados inválidos', 'details': serializer.errors},
                status=status.HTTP_400_BAD_REQUEST
            )

        products_data = serializer.validated_data['products']

        success_count = 0
        failed_count = 0
        errors = []
        created_ids = []

        for index, product_data in enumerate(products_data, start=1):
            try:
                # Validar permissões
                sede = Sede.objects.get(id=product_data['sede'])
                org = Organization.objects.get(id=product_data['organization'])

                # Verificar se usuário tem permissão
                if not request.user.has_perm_for_sede(sede):
                    errors.append(f"Linha {index}: Sem permissão para criar produtos nesta sede")
                    failed_count += 1
                    continue

                # Verificar SKU duplicado
                sku = product_data['sku'].strip().upper()
                if Product.objects.filter(
                    sku=sku,
                    sede=sede,
                    organization=org
                ).exists():
                    errors.append(f"Linha {index}: SKU '{sku}' já existe no sistema")
                    failed_count += 1
                    continue

                # Processar categoria (criar se não existir)
                category = None
                if product_data.get('category'):
                    category_name = product_data['category'].strip()
                    category, _ = Category.objects.get_or_create(
                        name=category_name,
                        sede=sede,
                        organization=org,
                        defaults={'name': category_name}
                    )

                # Criar produto
                with transaction.atomic():
                    product = Product.objects.create(
                        name=product_data['name'].strip(),
                        sku=sku,
                        price=product_data.get('price'),
                        description=product_data.get('description', '').strip(),
                        category=category,
                        stock=product_data.get('stock', 0),
                        currency=product_data.get('currency', 'BRL'),
                        image_url=product_data.get('image_url'),
                        sede=sede,
                        organization=org,
                        created_by=request.user
                    )

                    created_ids.append(product.id)
                    success_count += 1

            except Sede.DoesNotExist:
                errors.append(f"Linha {index}: Sede inválida")
                failed_count += 1
            except Organization.DoesNotExist:
                errors.append(f"Linha {index}: Organização inválida")
                failed_count += 1
            except Exception as e:
                errors.append(f"Linha {index}: {str(e)}")
                failed_count += 1

        return Response({
            'success': success_count,
            'failed': failed_count,
            'errors': errors,
            'created_ids': created_ids
        }, status=status.HTTP_200_OK)
```

### 3. URLs

```python
# urls.py
from rest_framework.routers import DefaultRouter
from .views import ProductViewSet

router = DefaultRouter()
router.register(r'products', ProductViewSet, basename='product')

urlpatterns = router.urls
```

---

## 🔐 Permissões

### Verificações Necessárias

1. **Autenticação**: Usuário deve estar autenticado
2. **Permissão de Organização**: Usuário deve ter acesso à organização
3. **Permissão de Sede**: Usuário deve ter acesso à sede
4. **Permissão de Criação**: Usuário deve ter permissão para criar produtos

### Exemplo de Verificação

```python
def has_perm_for_sede(user, sede):
    """
    Verifica se usuário tem permissão para criar produtos na sede
    """
    # Verificar se é admin
    if user.is_staff or user.is_superuser:
        return True

    # Verificar se é membro da sede
    return SedeMember.objects.filter(
        sede=sede,
        user=user,
        is_active=True
    ).exists()
```

---

## 🚀 Performance

### Otimizações Recomendadas

1. **Bulk Create**: Se possível, usar `bulk_create()` do Django para melhor performance
2. **Select Related**: Carregar sedes e organizações uma vez
3. **Cache de Categorias**: Cache de categorias existentes para evitar queries repetidas
4. **Transações**: Usar transações atômicas para garantir consistência
5. **Limite de Produtos**: Limitar número de produtos por request (ex: máximo 500)

### Exemplo Otimizado

```python
# Otimização com bulk_create
valid_products = []
for product_data in products_data:
    # ... validações ...
    if is_valid:
        valid_products.append(Product(
            name=product_data['name'],
            sku=product_data['sku'],
            # ... outros campos ...
        ))

# Criar todos de uma vez
created = Product.objects.bulk_create(valid_products, batch_size=100)
```

---

## 📊 Logs e Monitoramento

### Eventos a Logar

```python
import logging

logger = logging.getLogger(__name__)

# Log de importação
logger.info(f"Bulk import iniciado por {request.user.username}")
logger.info(f"Total de produtos: {len(products_data)}")
logger.info(f"Sucesso: {success_count}, Falhas: {failed_count}")

# Log de erros específicos
for error in errors:
    logger.warning(f"Bulk import error: {error}")
```

---

## 🧪 Testes

### Casos de Teste Necessários

```python
# tests.py
class BulkImportTestCase(TestCase):

    def test_bulk_import_success(self):
        """Testa importação bem-sucedida"""
        pass

    def test_bulk_import_duplicate_sku(self):
        """Testa rejeição de SKU duplicado"""
        pass

    def test_bulk_import_missing_required_fields(self):
        """Testa validação de campos obrigatórios"""
        pass

    def test_bulk_import_invalid_price(self):
        """Testa validação de preço"""
        pass

    def test_bulk_import_permissions(self):
        """Testa permissões de acesso"""
        pass

    def test_bulk_import_category_creation(self):
        """Testa criação automática de categorias"""
        pass
```

---

## 📝 Exemplos de Request/Response

### Exemplo 1: Importação Bem-Sucedida

**Request:**
```bash
POST /api/products/bulk_import/
Authorization: Bearer <token>
Content-Type: application/json

{
  "products": [
    {
      "name": "Notebook Dell",
      "sku": "NB-DELL-001",
      "price": 3499.90,
      "stock": 10,
      "currency": "BRL",
      "sede": 1,
      "organization": 1
    },
    {
      "name": "Mouse Logitech",
      "sku": "MS-LOG-001",
      "price": 89.90,
      "stock": 50,
      "currency": "BRL",
      "sede": 1,
      "organization": 1
    }
  ]
}
```

**Response:**
```json
{
  "success": 2,
  "failed": 0,
  "errors": [],
  "created_ids": [123, 124]
}
```

### Exemplo 2: Importação com Erros

**Request:**
```bash
POST /api/products/bulk_import/
Authorization: Bearer <token>
Content-Type: application/json

{
  "products": [
    {
      "name": "Produto OK",
      "sku": "PROD-001",
      "price": 99.90,
      "sede": 1,
      "organization": 1
    },
    {
      "name": "Produto Duplicado",
      "sku": "PROD-001",  // SKU duplicado
      "price": 99.90,
      "sede": 1,
      "organization": 1
    },
    {
      "name": "",  // Nome vazio
      "sku": "PROD-002",
      "price": 99.90,
      "sede": 1,
      "organization": 1
    }
  ]
}
```

**Response:**
```json
{
  "success": 1,
  "failed": 2,
  "errors": [
    "Linha 2: SKU 'PROD-001' já existe no sistema",
    "Linha 3: Campo obrigatório 'name' está vazio"
  ],
  "created_ids": [125]
}
```

---

## 🎯 Checklist de Implementação

- [ ] Criar serializers para validação
- [ ] Implementar endpoint `bulk_import`
- [ ] Adicionar validação de SKU único
- [ ] Implementar verificação de permissões
- [ ] Adicionar criação/busca de categorias
- [ ] Implementar normalização de dados
- [ ] Adicionar logs de auditoria
- [ ] Criar testes unitários
- [ ] Documentar endpoint no Swagger/OpenAPI
- [ ] Testar performance com grandes volumes (500+ produtos)
- [ ] Implementar limite de taxa (rate limiting)
- [ ] Adicionar monitoramento de erros (Sentry, etc)

---

## 📚 Documentação Adicional

### Limites Sugeridos

- **Máximo de produtos por request**: 500
- **Timeout**: 60 segundos
- **Rate limit**: 10 requests/minuto por usuário

### Códigos de Status HTTP

- `200 OK`: Importação processada (mesmo com falhas parciais)
- `400 Bad Request`: Dados inválidos no request
- `401 Unauthorized`: Não autenticado
- `403 Forbidden`: Sem permissão
- `429 Too Many Requests`: Limite de taxa excedido
- `500 Internal Server Error`: Erro do servidor

---

## 🔄 Melhorias Futuras

1. **Processamento Assíncrono**: Para grandes volumes, usar Celery/RQ
2. **Webhook de Conclusão**: Notificar frontend quando importação for concluída
3. **Relatório Detalhado**: Gerar CSV com resultados da importação
4. **Importação Incremental**: Permitir atualização de produtos existentes
5. **Preview sem Commit**: Endpoint separado para preview sem criar dados
6. **Validação de Imagens**: Validar URLs de imagens antes de salvar
7. **Integração com ERP**: Permitir importação direta de sistemas ERP

---

**Documentação gerada para**: Catana Platform
**Versão**: 1.0
**Data**: 2025-12-27
**Autor**: Frontend Team
