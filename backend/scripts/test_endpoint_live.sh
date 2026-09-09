#!/bin/bash

echo "=== Teste do Endpoint Bulk Import (Live) ==="
echo ""

# 1. Obter token
echo "1. Obtendo token de autenticação..."
TOKEN_RESPONSE=$(curl -s -X POST http://localhost:8000/api/auth/token/ \
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

# 2. Testar endpoint
echo "2. Testando endpoint bulk_import..."
RESPONSE=$(curl -s -X POST http://localhost:8000/api/products/bulk_import/ \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "products": [
      {
        "name": "Produto Teste Live",
        "sku": "LIVE-001",
        "price": 99.90,
        "description": "Teste via script",
        "category": "Teste Live",
        "stock": 10,
        "currency": "BRL",
        "sede": 6,
        "organization": 1
      }
    ]
  }')

echo "Resposta:"
echo "$RESPONSE" | python3 -m json.tool

# 3. Verificar resultado
SUCCESS=$(echo $RESPONSE | python3 -c "import sys, json; print(json.load(sys.stdin).get('success', 0))" 2>/dev/null)

echo ""
if [ "$SUCCESS" = "1" ]; then
    echo "✅ SUCESSO! Produto criado via API"
else
    echo "ℹ️ Verifique a resposta acima para detalhes"
fi
