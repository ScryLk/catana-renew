#!/bin/bash
# Exemplos de teste do endpoint bulk_import usando curl

# Configurações
API_URL="http://localhost:8000/api"
TOKEN="seu-token-jwt-aqui"

echo "=== Exemplos de Teste - Bulk Import ==="
echo ""

# 1. Obter token de autenticação
echo "1. Obter Token de Autenticação:"
echo "curl -X POST $API_URL/auth/token/ \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -d '{\"username\": \"admin\", \"password\": \"sua-senha\"}'"
echo ""
echo "Copie o access token da resposta e substitua no TOKEN acima"
echo ""

# 2. Importação simples (sucesso)
echo "2. Importação Simples (2 produtos):"
echo "curl -X POST $API_URL/products/bulk_import/ \\"
echo "  -H 'Authorization: Bearer $TOKEN' \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -d '{
  \"products\": [
    {
      \"name\": \"Produto Teste 1\",
      \"sku\": \"CURL-001\",
      \"price\": 99.90,
      \"description\": \"Produto de teste via curl\",
      \"category\": \"Teste\",
      \"stock\": 10,
      \"currency\": \"BRL\",
      \"sede\": 1,
      \"organization\": 1
    },
    {
      \"name\": \"Produto Teste 2\",
      \"sku\": \"CURL-002\",
      \"price\": 149.90,
      \"stock\": 5,
      \"currency\": \"BRL\",
      \"sede\": 1,
      \"organization\": 1
    }
  ]
}'"
echo ""

# 3. Teste com erro (SKU duplicado)
echo "3. Teste com SKU Duplicado (execute depois do exemplo 2):"
echo "curl -X POST $API_URL/products/bulk_import/ \\"
echo "  -H 'Authorization: Bearer $TOKEN' \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -d '{
  \"products\": [
    {
      \"name\": \"Produto Duplicado\",
      \"sku\": \"CURL-001\",
      \"price\": 199.90,
      \"sede\": 1,
      \"organization\": 1
    }
  ]
}'"
echo ""

# 4. Teste com nome vazio
echo "4. Teste com Nome Vazio (erro de validação):"
echo "curl -X POST $API_URL/products/bulk_import/ \\"
echo "  -H 'Authorization: Bearer $TOKEN' \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -d '{
  \"products\": [
    {
      \"name\": \"\",
      \"sku\": \"EMPTY-001\",
      \"price\": 99.90,
      \"sede\": 1,
      \"organization\": 1
    }
  ]
}'"
echo ""

# 5. Importação mista (sucesso + erro)
echo "5. Importação Mista (2 sucessos + 1 erro):"
echo "curl -X POST $API_URL/products/bulk_import/ \\"
echo "  -H 'Authorization: Bearer $TOKEN' \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -d '{
  \"products\": [
    {
      \"name\": \"Produto OK 1\",
      \"sku\": \"MIX-001\",
      \"price\": 100.00,
      \"sede\": 1,
      \"organization\": 1
    },
    {
      \"name\": \"\",
      \"sku\": \"MIX-002\",
      \"price\": 200.00,
      \"sede\": 1,
      \"organization\": 1
    },
    {
      \"name\": \"Produto OK 2\",
      \"sku\": \"MIX-003\",
      \"price\": 300.00,
      \"sede\": 1,
      \"organization\": 1
    }
  ]
}'"
echo ""

# 6. Listar produtos criados
echo "6. Listar Produtos Criados:"
echo "curl -X GET '$API_URL/products/?organization=1&sede=1' \\"
echo "  -H 'Authorization: Bearer $TOKEN'"
echo ""

# 7. Excluir produtos de teste
echo "7. Excluir Produto Específico:"
echo "curl -X DELETE $API_URL/products/<ID>/ \\"
echo "  -H 'Authorization: Bearer $TOKEN'"
echo ""

echo "=== Fim dos Exemplos ==="
echo ""
echo "Dicas:"
echo "- Substitua 'seu-token-jwt-aqui' pelo token obtido no exemplo 1"
echo "- Ajuste os IDs de sede e organização conforme seu ambiente"
echo "- Use 'jq' para formatar a resposta JSON: | jq ."
echo "- Adicione -v para ver headers completos da resposta"
