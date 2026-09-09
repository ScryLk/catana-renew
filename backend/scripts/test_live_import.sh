#!/bin/bash

PORT=8000
API_URL="http://localhost:$PORT/api"

echo "=== Teste do Endpoint Bulk Import (Porta $PORT) ==="
echo ""

# 1. Obter token
echo "1. Obtendo token de autenticação..."
TOKEN_RESPONSE=$(curl -s -X POST $API_URL/auth/token/ \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "admin123"}')

TOKEN=$(echo $TOKEN_RESPONSE | python3 -c "import sys, json; print(json.load(sys.stdin)['access'])" 2>/dev/null)

if [ -z "$TOKEN" ]; then
    echo "❌ Erro ao obter token"
    echo "Resposta: $TOKEN_RESPONSE"
    exit 1
fi

echo "✅ Token obtido!"
echo ""

# 2. Testar endpoint bulk_import com imagens
echo "2. Testando importação com imagens..."
RESPONSE=$(curl -s -X POST $API_URL/products/bulk_import/ \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "products": [
      {
        "name": "Produto Teste com Imagem",
        "sku": "TEST-IMG-001",
        "price": 99.90,
        "description": "Teste completo com imagens",
        "category": "Teste",
        "stock": 10,
        "currency": "BRL",
        "sede": 6,
        "organization": 1,
        "image_main": "https://picsum.photos/800/600",
        "image_gallery": "https://picsum.photos/800/601|https://picsum.photos/800/602"
      }
    ]
  }')

echo "Resposta:"
echo "$RESPONSE" | python3 -m json.tool

# 3. Verificar resultado
SUCCESS=$(echo $RESPONSE | python3 -c "import sys, json; print(json.load(sys.stdin).get('success', 0))" 2>/dev/null)

echo ""
if [ "$SUCCESS" = "1" ]; then
    echo "✅ SUCESSO! Produto criado"

    # Verificar se o produto tem imagens
    PRODUCT_ID=$(echo $RESPONSE | python3 -c "import sys, json; ids=json.load(sys.stdin).get('created_ids', []); print(ids[0] if ids else '')" 2>/dev/null)

    if [ ! -z "$PRODUCT_ID" ]; then
        echo ""
        echo "3. Verificando produto criado..."
        PRODUCT=$(curl -s -X GET $API_URL/products/$PRODUCT_ID/ \
          -H "Authorization: Bearer $TOKEN")

        echo "Produto ID: $PRODUCT_ID"
        echo "$PRODUCT" | python3 -c "
import sys, json
p = json.load(sys.stdin)
print(f'Nome: {p.get(\"name\")}')
print(f'SKU: {p.get(\"sku\")}')
print(f'Imagem: {\"Sim\" if p.get(\"cover_image\") or p.get(\"image\") else \"Não\"}')
" 2>/dev/null
    fi
else
    echo "❌ Falha ao criar produto"
    echo "Erros: $(echo $RESPONSE | python3 -c 'import sys, json; print(json.load(sys.stdin).get(\"errors\", []))' 2>/dev/null)"
fi

echo ""
echo "=== Teste Concluído ==="
