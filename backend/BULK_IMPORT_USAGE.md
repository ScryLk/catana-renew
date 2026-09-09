# 📦 Guia de Uso - Importação em Lote de Produtos

## ✅ Implementação Concluída

O endpoint de importação em lote de produtos foi implementado com sucesso!

**Endpoint:** `POST /api/products/bulk_import/`

---

## 🎯 Funcionalidades Implementadas

- ✅ Importação de múltiplos produtos em uma única requisição
- ✅ Validação de SKU único por sede/organização
- ✅ Validação de campos obrigatórios (name, sku)
- ✅ Validação de permissões (usuário deve ter acesso à organização/sede)
- ✅ Criação automática de categorias
- ✅ Limite de 500 produtos por importação
- ✅ Logs detalhados de importação
- ✅ Retorno detalhado com sucessos, falhas e erros
- ✅ Cache de validações para melhor performance
- ✅ Transações atômicas para cada produto

---

## 📝 Exemplo de Uso

### Request

```bash
POST /api/products/bulk_import/
Authorization: Bearer <seu-token>
Content-Type: application/json
```

```json
{
  "products": [
    {
      "name": "Notebook Dell Inspiron",
      "sku": "NB-DELL-001",
      "price": 3499.90,
      "description": "Notebook Dell Inspiron 15 com Intel i7",
      "category": "Eletrônicos",
      "stock": 10,
      "currency": "BRL",
      "sede": 1,
      "organization": 1
    },
    {
      "name": "Mouse Logitech MX Master",
      "sku": "MS-LOG-001",
      "price": 389.90,
      "description": "Mouse sem fio Logitech MX Master 3",
      "category": "Periféricos",
      "stock": 25,
      "currency": "BRL",
      "sede": 1,
      "organization": 1
    }
  ]
}
```

### Response (Sucesso)

```json
{
  "success": 2,
  "failed": 0,
  "errors": [],
  "created_ids": [123, 124]
}
```

### Response (Com Erros)

```json
{
  "success": 1,
  "failed": 1,
  "errors": [
    "Linha 2: SKU 'MS-LOG-001' já existe no sistema"
  ],
  "created_ids": [123]
}
```

---

## 🔍 Validações Implementadas

### 1. Campos Obrigatórios
- `name`: Nome do produto (não pode estar vazio)
- `sku`: Código único do produto
- `sede`: ID da sede
- `organization`: ID da organização

### 2. Campos Opcionais
- `price`: Preço do produto (padrão: 0)
- `description`: Descrição detalhada (padrão: "")
- `category`: Nome da categoria (criada automaticamente se não existir)
- `stock`: Quantidade em estoque (padrão: 0)
- `currency`: Código da moeda (padrão: "BRL")
- `image_url`: URL da imagem (não implementado no modelo atual)

### 3. Validações de Contexto
- ✅ Organização existe e usuário tem acesso
- ✅ Sede existe e pertence à organização
- ✅ SKU único por sede/organização
- ✅ Usuário autenticado com permissões adequadas

---

## 📊 Códigos de Status HTTP

| Código | Significado | Quando Ocorre |
|--------|-------------|---------------|
| `200 OK` | Importação processada | Mesmo com falhas parciais |
| `400 Bad Request` | Dados inválidos | Request malformado ou limite excedido |
| `401 Unauthorized` | Não autenticado | Token ausente ou inválido |
| `403 Forbidden` | Sem permissão | Usuário não tem acesso à org/sede |

---

## ⚡ Limites e Performance

- **Máximo de produtos por request:** 500
- **Timeout:** 60 segundos (configurável no servidor)
- **Rate limiting:** 10 requests/minuto por usuário (recomendado)

### Otimizações Implementadas

1. **Cache de Validações:** Organizações e sedes são validadas apenas uma vez
2. **Cache de Categorias:** Categorias são criadas/buscadas com cache
3. **Transações Atômicas:** Cada produto é criado em transação separada
4. **Processamento Resiliente:** Falha em um produto não afeta os outros

---

## 🧪 Testes Realizados

Todos os testes passaram com sucesso:

- ✅ Importação bem-sucedida de múltiplos produtos
- ✅ Validação de SKU duplicado
- ✅ Validação de nome vazio
- ✅ Validação de organização inválida
- ✅ Importação mista (sucessos + falhas)
- ✅ Limite de 500 produtos
- ✅ Criação automática de categorias

### Executar Testes

```bash
# Teste básico
python3 test_bulk_import.py

# Testes de validação
python3 test_bulk_import_errors.py
```

---

## 📋 Casos de Uso

### 1. Importação de Catálogo Completo

```python
import requests

url = "http://localhost:8000/api/products/bulk_import/"
headers = {
    "Authorization": "Bearer seu-token-aqui",
    "Content-Type": "application/json"
}

data = {
    "products": [
        # ... até 500 produtos
    ]
}

response = requests.post(url, json=data, headers=headers)
print(f"Criados: {response.json()['success']}")
print(f"Erros: {response.json()['failed']}")
```

### 2. Importação de Planilha Excel/CSV

```python
import pandas as pd
import requests

# Ler planilha
df = pd.read_excel("produtos.xlsx")

# Converter para formato do endpoint
products = []
for _, row in df.iterrows():
    products.append({
        "name": row['Nome'],
        "sku": row['SKU'],
        "price": float(row['Preco']),
        "description": row['Descricao'],
        "category": row['Categoria'],
        "stock": int(row['Estoque']),
        "currency": "BRL",
        "sede": 1,
        "organization": 1
    })

# Enviar em lotes de 500
for i in range(0, len(products), 500):
    batch = products[i:i+500]
    response = requests.post(url, json={"products": batch}, headers=headers)
    print(f"Lote {i//500 + 1}: {response.json()['success']} criados")
```

---

## 🔐 Segurança

### Permissões Necessárias

- Usuário deve estar **autenticado**
- Usuário deve ser **editor** ou **admin** da sede/organização
- Validação adicional via sistema de permissões do Django

### Proteções Implementadas

- ✅ Validação de autenticação (JWT)
- ✅ Validação de permissões por organização
- ✅ Validação de permissões por sede
- ✅ Sanitização de dados (trim, uppercase em SKU)
- ✅ Limite de taxa (implementar no nginx/servidor)

---

## 📈 Logs

Os seguintes eventos são logados:

```python
# Início da importação
INFO: Bulk import iniciado por <username>
INFO: Total de produtos: <quantidade>

# Erros específicos
WARNING: Bulk import error: Linha X: <mensagem>

# Conclusão
INFO: Sucesso: X, Falhas: Y
```

---

## 🚀 Melhorias Futuras

1. **Processamento Assíncrono:** Para grandes volumes, usar Celery/RQ
2. **Webhook de Conclusão:** Notificar frontend quando importação for concluída
3. **Relatório Detalhado:** Gerar CSV com resultados da importação
4. **Importação Incremental:** Permitir atualização de produtos existentes
5. **Preview sem Commit:** Endpoint separado para preview sem criar dados
6. **Validação de Imagens:** Validar URLs de imagens antes de salvar
7. **Integração com ERP:** Permitir importação direta de sistemas ERP

---

## 📞 Suporte

- **Documentação API:** http://localhost:8000/api/schema/swagger-ui/
- **Issues:** https://github.com/seu-repo/issues
- **Email:** suporte@catana.com

---

**Desenvolvido para Catana Platform**
**Versão:** 1.0
**Data:** 2025-12-27
