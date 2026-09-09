# Resumo Executivo - Implementação Backend: Importação em Lote

## 🎯 O Que Precisa Ser Feito

Criar um endpoint REST que permita criar múltiplos produtos de uma vez através de uma requisição HTTP.

---

## 📍 Endpoint

```
POST /api/products/bulk_import/
```

---

## 📥 O Que o Frontend Envia

```json
{
  "products": [
    {
      "name": "Produto 1",
      "sku": "SKU-001",
      "price": 99.90,
      "description": "Descrição",
      "category": "Categoria",
      "stock": 10,
      "currency": "BRL",
      "image_main": "https://exemplo.com/produto1-capa.jpg",
      "image_gallery": "https://exemplo.com/img1.jpg|https://exemplo.com/img2.jpg",
      "sede": 1,
      "organization": 1
    },
    // ... mais produtos
  ]
}
```

**Campos Obrigatórios**: `name`, `sku`, `sede`, `organization`

**Campos de Imagem**:
- `image_main` (opcional): URL da imagem principal (capa) do produto
  - Deve ser salva em `/media/products/{product_id}/cover/`
  - Define a imagem de destaque do produto
- `image_gallery` (opcional): URLs das imagens adicionais separadas por `|` (pipe)
  - Cada URL deve ser processada individualmente
  - Devem ser salvas em `/media/products/{product_id}/gallery/`
  - Complementam a apresentação do produto
  - **Nunca substitui a imagem principal**

---

## 📤 O Que o Backend Deve Retornar

```json
{
  "success": 150,        // Quantos foram criados
  "failed": 5,           // Quantos falharam
  "errors": [            // Lista de erros
    "Linha 3: SKU 'ABC-001' já existe",
    "Linha 7: Campo 'name' está vazio"
  ],
  "created_ids": [1, 2, 3, ...] // IDs dos produtos criados
}
```

---

## ✅ Validações Necessárias

1. **SKU Único**: Verificar se SKU já existe (por sede/org)
2. **Campos Obrigatórios**: `name` e `sku` devem existir
3. **Preço Válido**: Se fornecido, deve ser número
4. **Permissões**: Usuário pode criar produtos naquela sede/org
5. **Normalização**: Trim em strings, conversão de tipos

---

## 🔐 Segurança

- ✅ Usuário deve estar autenticado
- ✅ Verificar se tem permissão na sede/organização
- ✅ Não permitir SKUs duplicados
- ✅ Validar todos os dados antes de criar

---

## 📊 Comportamento Esperado

- ✅ **Sucesso Parcial**: Se 100 produtos são enviados e 5 falham, criar os 95 válidos
- ✅ **Erro Individual**: Não parar toda importação por causa de 1 produto inválido
- ✅ **Categoria**: Se não existir, criar automaticamente
- ✅ **Feedback Claro**: Informar qual linha tem erro e porquê
- ✅ **Imagens**: Processar imagens de forma assíncrona ou com timeout
  - Se download de imagem falhar, produto ainda é criado
  - Registrar erro de imagem como aviso, não como falha crítica
  - Validar URLs (apenas HTTP/HTTPS permitido)
  - Nunca executar conteúdo remoto

---

## 🖼️ Processamento de Imagens

### Fluxo Recomendado

1. **Criar o produto primeiro** (independente das imagens)
2. **Processar image_main** (se fornecida):
   - Fazer download da URL
   - Salvar em `/media/products/{product_id}/cover/`
   - Definir como `product.coverImage` ou campo equivalente
   - Se falhar: registrar aviso, produto continua válido

3. **Processar image_gallery** (se fornecida):
   - Separar URLs pelo delimitador `|` (pipe)
   - Para cada URL:
     - Fazer download
     - Salvar em `/media/products/{product_id}/gallery/`
     - Associar como mídia secundária do produto
   - Se alguma falhar: registrar aviso, continuar com as outras

### Regras de Segurança para Imagens

- ✅ Apenas URLs HTTP/HTTPS são permitidas
- ✅ Implementar timeout de download (ex: 30 segundos por imagem)
- ✅ Validar tamanho máximo (ex: 10MB por imagem)
- ✅ Validar tipo MIME (apenas imagens: jpeg, png, webp, etc)
- ❌ Nunca executar ou processar conteúdo não-imagem
- ❌ Nunca bloquear toda importação por erro de imagem
- ❌ Nunca sobrescrever imagens existentes sem confirmação

### Estrutura de Pastas

```
/media/
  └── products/
      ├── 1/                    # product_id = 1
      │   ├── cover/
      │   │   └── image.jpg     # image_main
      │   └── gallery/
      │       ├── img1.jpg      # primeira imagem do gallery
      │       ├── img2.jpg      # segunda imagem do gallery
      │       └── img3.jpg      # terceira imagem do gallery
      ├── 2/                    # product_id = 2
      │   ├── cover/
      │   │   └── main.jpg
      │   └── gallery/
      │       └── detail.jpg
      ...
```

### Exemplo de Processamento

```python
# Pseudocódigo do processamento de imagens

def process_product_images(product, image_main_url, image_gallery_urls):
    warnings = []

    # Processar imagem principal
    if image_main_url:
        try:
            image_path = download_image(
                url=image_main_url,
                destination=f"/media/products/{product.id}/cover/",
                timeout=30
            )
            product.coverImage = image_path
            product.save()
        except Exception as e:
            warnings.append(f"Falha ao baixar imagem principal: {str(e)}")

    # Processar galeria
    if image_gallery_urls:
        gallery_urls = image_gallery_urls.split('|')
        for idx, url in enumerate(gallery_urls):
            try:
                image_path = download_image(
                    url=url.strip(),
                    destination=f"/media/products/{product.id}/gallery/",
                    timeout=30
                )
                ProductMedia.objects.create(
                    product=product,
                    image=image_path,
                    order=idx
                )
            except Exception as e:
                warnings.append(f"Falha ao baixar imagem {idx+1} da galeria: {str(e)}")

    return warnings
```

---

## 🚀 Performance

- Processar até **500 produtos por request**
- Usar transações do banco para garantir consistência
- Considerar `bulk_create()` para otimizar

---

## 📝 Exemplo Prático

### Cenário: Usuário importa 3 produtos

**Input:**
- Produto 1: ✅ Válido
- Produto 2: ❌ SKU duplicado
- Produto 3: ✅ Válido

**Output Esperado:**
```json
{
  "success": 2,
  "failed": 1,
  "errors": [
    "Linha 2: SKU 'ABC-001' já existe no sistema"
  ],
  "created_ids": [101, 103]
}
```

**Resultado**: Produtos 1 e 3 foram criados. Produto 2 foi rejeitado.

---

## 🎯 Próximos Passos

1. Criar o endpoint em `views.py`
2. Adicionar serializer para validação
3. Implementar validação de SKU único
4. Testar com poucos produtos (5-10)
5. Testar com muitos produtos (100+)
6. Documentar no Swagger

---

## 📚 Documentação Técnica Completa

Veja o arquivo `BACKEND_BULK_IMPORT_SPEC.md` para:
- Código de exemplo completo (Django)
- Validações detalhadas
- Casos de teste
- Otimizações de performance
- Exemplos de requests/responses

---

## ❓ Dúvidas Comuns

**P: E se o usuário enviar 1000 produtos?**
R: Limitar a 500 por request. Retornar erro 400 se exceder.

**P: E se uma categoria não existir?**
R: Criar automaticamente com o nome fornecido.

**P: Precisa validar se imagem existe?**
R: Não no MVP. Apenas salvar a URL.

**P: E se dois produtos no mesmo arquivo tiverem o mesmo SKU?**
R: Marcar ambos como erro "SKU duplicado no arquivo".

**P: Precisa processar de forma assíncrona?**
R: Não no MVP. Processar síncrono até 500 produtos.

---

**Tempo Estimado de Implementação**: 4-6 horas

**Prioridade**: Alta

**Status**: Aguardando Implementação
