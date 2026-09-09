#!/bin/bash

PORT=8000
API_URL="http://localhost:$PORT/api"

echo "=== Teste do Sistema de Perfis Públicos ==="
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

# 2. Verificar se usuário já tem perfil público
echo "2. Verificando se já existe perfil público..."
PROFILE_CHECK=$(curl -s -X GET $API_URL/public-profiles/me/ \
  -H "Authorization: Bearer $TOKEN")

echo "Resposta: $PROFILE_CHECK" | python3 -m json.tool 2>/dev/null || echo "$PROFILE_CHECK"
echo ""

# 3. Criar perfil público (se não existir)
echo "3. Criando perfil público..."
CREATE_RESPONSE=$(curl -s -X POST $API_URL/public-profiles/me/create/ \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin_test",
    "display_name": "Admin Test Store",
    "bio": "Loja de teste para desenvolvimento",
    "description": "Esta é uma loja de teste completa com vários produtos",
    "profile_type": "empresa",
    "segments": ["Eletrônicos", "Moda"],
    "city": "São Paulo",
    "state": "SP"
  }')

echo "Resposta:"
echo "$CREATE_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$CREATE_RESPONSE"
echo ""

# 4. Buscar perfil criado
echo "4. Buscando meu perfil público..."
MY_PROFILE=$(curl -s -X GET $API_URL/public-profiles/me/ \
  -H "Authorization: Bearer $TOKEN")

echo "Resposta:"
echo "$MY_PROFILE" | python3 -m json.tool
echo ""

# 5. Testar busca de perfis
echo "5. Testando busca de perfis..."
SEARCH_RESPONSE=$(curl -s -X GET "$API_URL/public-profiles/search/?query=test" \
  -H "Authorization: Bearer $TOKEN")

echo "Resposta:"
echo "$SEARCH_RESPONSE" | python3 -m json.tool
echo ""

# 6. Verificar disponibilidade de username
echo "6. Verificando disponibilidade de username..."
USERNAME_CHECK=$(curl -s -X GET "$API_URL/public-profiles/check-username/?username=novo_usuario" \
  -H "Authorization: Bearer $TOKEN")

echo "Resposta: $USERNAME_CHECK" | python3 -m json.tool
echo ""

# 7. Testar perfis sugeridos
echo "7. Buscando perfis sugeridos..."
SUGGESTED=$(curl -s -X GET "$API_URL/public-profiles/suggested/" \
  -H "Authorization: Bearer $TOKEN")

echo "Resposta:"
echo "$SUGGESTED" | python3 -m json.tool
echo ""

# 8. Testar perfis em destaque
echo "8. Buscando perfis em destaque..."
FEATURED=$(curl -s -X GET "$API_URL/public-profiles/featured/" \
  -H "Authorization: Bearer $TOKEN")

echo "Resposta:"
echo "$FEATURED" | python3 -m json.tool
echo ""

echo "=== Teste Concluído ==="
