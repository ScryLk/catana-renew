# 🌱 Seed Database - Catana Embalagens

Script profissional para popular o banco de dados com dados mockados realistas de demonstração.

## 📋 O que o script faz

O script `seed_database.py` realiza as seguintes operações:

1. **Limpa o banco de dados** - Remove todos os dados existentes (exceto usuários)
2. **Cria categorias** - 4 categorias principais com 11 subcategorias
3. **Cria produtos** - 31 produtos profissionais com especificações técnicas
4. **Cria pastas de mídia** - Estrutura organizada de pastas
5. **Cria temas** - 3 temas profissionais para catálogos
6. **Cria catálogos** - 5 catálogos completos com páginas
7. **Adiciona comentários** - Comentários em catálogos públicos

## 🚀 Como usar

### Executar o script

```bash
cd catana-back
python3 seed_database.py
```

### Pré-requisitos

- Banco de dados PostgreSQL configurado
- Usuário admin criado (superuser)
- Migrações aplicadas

Se não tiver um usuário admin, crie com:

```bash
python3 manage.py createsuperuser
```

## 📊 Dados Criados

### Categorias (15 total)

**Principais:**
- **Embalagens para Alimentos**
  - Potes e Tampas
  - Bandejas
  - Sacos e Sacolas

- **Food Service**
  - Marmitas
  - Copos e Tampas
  - Talheres

- **Confeitaria**
  - Caixas de Bolo
  - Potes de Doce
  - Embalagens Personalizadas

- **Linha Festa**
  - Copos Personalizados
  - Pratos Descartáveis

### Produtos (31 total)

Exemplos de produtos criados:

| Produto | Categoria | Preço | Estoque |
|---------|-----------|-------|---------|
| Pote Redondo 250ml | Potes e Tampas | R$ 0,45 | 5.000 |
| Pote Redondo 500ml | Potes e Tampas | R$ 0,65 | 4.500 |
| Pote Redondo 1000ml | Potes e Tampas | R$ 0,95 | 3.500 |
| Marmitex 500ml | Marmitas | R$ 0,80 | 4.500 |
| Marmitex 750ml | Marmitas | R$ 1,05 | 4.200 |
| Copo 200ml Transparente | Copos e Tampas | R$ 0,15 | 10.000 |
| Caixa Bolo Baixa G | Caixas de Bolo | R$ 3,50 | 1.500 |
| Pote Brigadeiro 30ml | Potes de Doce | R$ 0,25 | 8.000 |

**Todos os produtos incluem:**
- ✅ Descrições profissionais
- ✅ SKU único (formato: CAT-XXX-0001)
- ✅ Especificações técnicas (material, temperatura, certificações)
- ✅ Informações de dropshipping (fornecedor, dimensões, peso)
- ✅ Estoque realista
- ✅ Badges (Mais Vendido, Lançamento)

### Catálogos (5 total)

| Catálogo | Páginas | Visibilidade |
|----------|---------|--------------|
| Catálogo Geral Catana 2025 | 12 | Público |
| Linha Food Service Premium | 8 | Público |
| Embalagens para Confeitaria | 6 | Público |
| Soluções para Açougues e Hortifruti | 5 | Público |
| Linha Festa - Eventos Especiais | 4 | Privado |

### Pastas de Mídia (11 total)

```
📁 Produtos
  📁 Embalagens
  📁 Food Service
  📁 Confeitaria
📁 Catálogos
  📁 2024
  📁 2025
📁 Marketing
  📁 Banners
  📁 Redes Sociais
  📁 Email Marketing
```

### Temas (3 total)

1. **Catana Corporativo** - Tema profissional com cinza e verde
2. **Catana Clean** - Tema minimalista com branco e azul
3. **Catana Elegante** - Tema sofisticado com preto e dourado

## 🔍 Verificando os Dados

### Via API

```bash
# Listar produtos
curl http://localhost:8000/api/products/?organization=1

# Listar catálogos
curl http://localhost:8000/api/catalogs/?organization=1

# Listar categorias
curl http://localhost:8000/api/categories/?organization=1

# Listar pastas de mídia
curl http://localhost:8000/api/mediafolders/?organization=1
```

### Via Admin Django

Acesse: `http://localhost:8000/admin`

## ⚠️ Atenção

- Este script **REMOVE TODOS OS DADOS** antes de inserir os novos
- Mantém apenas usuários e a estrutura básica (Organization, Sede)
- **NÃO execute em produção!**
- Use apenas em ambiente de desenvolvimento/demonstração

## 🎯 Casos de Uso

- **Demonstrações** - Apresentar o sistema com dados realistas
- **Testes** - Testar funcionalidades com dados variados
- **Desenvolvimento** - Resetar banco para estado inicial conhecido
- **Onboarding** - Treinar novos usuários com dados de exemplo

## 📝 Personalização

Para adicionar mais produtos, edite a lista `PRODUCTS_DATA` no script:

```python
PRODUCTS_DATA = [
    {
        'name': 'Nome do Produto',
        'category': 'Nome da Categoria',
        'price': '1.50',
        'stock': 1000,
        'description': 'Descrição detalhada do produto...'
    },
    # Adicione mais produtos aqui
]
```

## 🔄 Re-executando o Script

Você pode executar o script quantas vezes quiser. Ele sempre:
1. Limpa os dados antigos
2. Cria dados novos do zero
3. Mantém a consistência do banco

## 📞 Suporte

Em caso de problemas:
1. Verifique se o banco de dados está rodando
2. Confirme se existe um usuário superuser
3. Execute as migrações: `python3 manage.py migrate`
4. Verifique as variáveis de ambiente no `.env`

---

**Desenvolvido para Catana Embalagens** 🎯
