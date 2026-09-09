# 📸 Especificação - Processamento de Imagens no Bulk Import

## ✅ Implementação Concluída

O endpoint de bulk import agora suporta download automático de imagens!

---

## 🎯 Funcionalidades

### 1. Imagem Principal (Cover)
- Campo: `image_main` (ou `image_url` para compatibilidade)
- Salva em: `/media/products/{id}/cover/`
- Atribui a: `Product.cover_image` e `Product.image`

### 2. Galeria de Imagens
- Campo: `image_gallery`
- Formato: URLs separadas por `|` (pipe)
- Salva em: `/media/products/{id}/gallery/`
- Cria registros em: `ProductMedia`

---

## 📝 Exemplo de Request

```json
{
  "products": [
    {
      "name": "Notebook Dell",
      "sku": "NB-001",
      "price": 3499.90,
      "description": "Notebook Dell Inspiron",
      "category": "Eletrônicos",
      "stock": 10,
      "currency": "BRL",
      "sede": 1,
      "organization": 1,

      // Imagem principal
      "image_main": "https://exemplo.com/images/notebook-dell.jpg",

      // Galeria (múltiplas imagens separadas por |)
      "image_gallery": "https://exemplo.com/images/nb-1.jpg|https://exemplo.com/images/nb-2.jpg|https://exemplo.com/images/nb-3.jpg"
    }
  ]
}
```

---

## 🔧 Como Funciona

### Fluxo de Processamento

```
1. Produto é criado primeiro (transação atômica)
   ✅ Produto criado no banco
   ✅ SKU validado
   ✅ Categoria criada/associada

2. Imagens processadas DEPOIS (fora da transação)
   ⬇️ Download da image_main
   💾 Salva em /media/products/{id}/cover/
   🔗 Atribui a Product.cover_image

3. Galeria processada sequencialmente
   ⬇️ Download de cada URL da gallery
   💾 Salva em /media/products/{id}/gallery/
   🔗 Cria ProductMedia com order
```

### Garantias Importantes

✅ **Produto SEMPRE é criado**, mesmo se:
- URL da imagem está inválida
- Imagem não pode ser baixada
- Timeout no download
- Formato de imagem inválido

✅ **Erros de imagem NÃO bloqueiam a importação**

✅ **Logs detalhados** de cada erro

---

## 🛡️ Validações de Segurança

### 1. Tipo de Conteúdo
- Apenas `image/*` é aceito
- Outros tipos são rejeitados

### 2. Tamanho Máximo
- **10MB** por imagem
- Imagens maiores são rejeitadas

### 3. Timeout
- **10 segundos** por download
- Previne travamentos

### 4. User-Agent
- Header customizado: `Mozilla/5.0 (compatible; CatanaBot/1.0)`
- Evita bloqueios por alguns servidores

---

## 📊 Estrutura do Banco

### Modelo Product
```python
class Product(models.Model):
    # ... campos existentes ...

    # Imagens
    image = ForeignKey(Media)          # Legado
    cover_image = ForeignKey(Media)     # Nova imagem principal
```

### Novo Modelo ProductMedia
```python
class ProductMedia(models.Model):
    product = ForeignKey(Product, related_name='gallery')
    media = ForeignKey(Media)
    order = IntegerField(default=0)
    created_at = DateTimeField(auto_now_add=True)
```

---

## 🔍 Logs Gerados

### Sucesso
```
INFO: Imagem salva: products/123/cover/image.jpg (245.32KB)
INFO: Produto 123: Imagem de capa adicionada
INFO: Produto 123: Imagem 1 da galeria adicionada
INFO: Produto 123: Imagem 2 da galeria adicionada
```

### Avisos
```
WARNING: URL não é uma imagem válida: http://exemplo.com/file.pdf (tipo: application/pdf)
WARNING: Imagem muito grande: http://exemplo.com/huge.jpg (15.23MB)
WARNING: Timeout ao baixar imagem: http://slow-server.com/image.jpg
WARNING: Produto 123: Erro ao processar imagem de capa: Connection timeout
```

---

## 📋 Exemplos de Uso

### Apenas Imagem Principal

```json
{
  "products": [
    {
      "name": "Produto Simples",
      "sku": "PROD-001",
      "image_main": "https://exemplo.com/produto.jpg",
      "sede": 1,
      "organization": 1
    }
  ]
}
```

### Apenas Galeria (sem capa)

```json
{
  "products": [
    {
      "name": "Produto com Galeria",
      "sku": "PROD-002",
      "image_gallery": "https://exemplo.com/img1.jpg|https://exemplo.com/img2.jpg",
      "sede": 1,
      "organization": 1
    }
  ]
}
```

### Capa + Galeria

```json
{
  "products": [
    {
      "name": "Produto Completo",
      "sku": "PROD-003",
      "image_main": "https://exemplo.com/capa.jpg",
      "image_gallery": "https://exemplo.com/det1.jpg|https://exemplo.com/det2.jpg|https://exemplo.com/det3.jpg",
      "sede": 1,
      "organization": 1
    }
  ]
}
```

### Usando image_url (Compatibilidade)

```json
{
  "products": [
    {
      "name": "Produto Legado",
      "sku": "PROD-004",
      "image_url": "https://exemplo.com/produto.jpg",  // Funciona igual ao image_main
      "sede": 1,
      "organization": 1
    }
  ]
}
```

---

## 🧪 Testes

### Executar Testes de Imagens

```bash
python3 test_bulk_import_images.py
```

### Casos de Teste Cobertos

- ✅ Download e processamento de imagem principal
- ✅ Download e processamento de galeria (múltiplas imagens)
- ✅ Produto criado mesmo com URL inválida
- ✅ Timeout não bloqueia criação do produto
- ✅ Validação de tipo de conteúdo
- ✅ Validação de tamanho

---

## 📦 Estrutura de Arquivos

### Organização no Sistema de Arquivos

```
media/
└── products/
    ├── 123/
    │   ├── cover/
    │   │   └── produto-capa.jpg          # Imagem principal
    │   └── gallery/
    │       ├── produto-1.jpg              # Galeria imagem 1
    │       ├── produto-2.jpg              # Galeria imagem 2
    │       └── produto-3.jpg              # Galeria imagem 3
    └── 124/
        └── cover/
            └── outro-produto.jpg
```

---

## 🔄 Migração de Dados Legados

Para migrar produtos antigos que usam apenas `image`:

```python
from api.models import Product

# Copiar image para cover_image em produtos existentes
products = Product.objects.filter(image__isnull=False, cover_image__isnull=True)
for product in products:
    product.cover_image = product.image
    product.save(update_fields=['cover_image'])
    print(f"Migrado: {product.name}")
```

---

## ⚙️ Configurações Recomendadas

### settings.py

```python
# Tamanho máximo de upload (para futura implementação de upload direto)
DATA_UPLOAD_MAX_MEMORY_SIZE = 10485760  # 10MB

# Configuração de media files
MEDIA_URL = '/media/'
MEDIA_ROOT = os.path.join(BASE_DIR, 'media')
```

### nginx (Produção)

```nginx
location /media/ {
    alias /path/to/catana-back/media/;
    expires 30d;
    add_header Cache-Control "public, immutable";
}
```

---

## 🚀 Melhorias Futuras

### Próximas Implementações

1. **✅ FEITO**: Download automático de imagens
2. **✅ FEITO**: Estrutura de galeria
3. **Pendente**: Processamento assíncrono com Celery
4. **Pendente**: Redimensionamento automático (thumbnails)
5. **Pendente**: Compressão de imagens
6. **Pendente**: Suporte a CDN
7. **Pendente**: Detecção de imagens duplicadas
8. **Pendente**: Conversão automática para WebP

---

## 🐛 Troubleshooting

### Imagens não são baixadas

**Problema**: Produto criado mas sem imagens

**Causas possíveis**:
- URL inacessível (firewall, DNS, etc)
- Timeout (servidor lento)
- Tipo de conteúdo inválido
- Tamanho excede 10MB

**Solução**: Verificar logs do servidor

```bash
# Ver logs em tempo real
tail -f logs/django.log | grep "Imagem"
```

### Como verificar se funcionou

```python
from api.models import Product, ProductMedia

product = Product.objects.get(sku='PROD-001')

# Verificar capa
print(f"Capa: {product.cover_image.file.url if product.cover_image else 'Sem capa'}")

# Verificar galeria
gallery = ProductMedia.objects.filter(product=product)
print(f"Galeria: {gallery.count()} imagens")
for pm in gallery:
    print(f"  - {pm.media.file.url}")
```

---

## 📚 Referências

- [Django File Uploads](https://docs.djangoproject.com/en/4.2/topics/http/file-uploads/)
- [Requests Library](https://requests.readthedocs.io/)
- [PIL/Pillow](https://pillow.readthedocs.io/) (para futuras otimizações)

---

**Desenvolvido para:** Catana Platform
**Versão:** 2.0 (com suporte a imagens)
**Data:** 2025-12-27
**Autor:** Claude Code
