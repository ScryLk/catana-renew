# 🚀 Instalação e Uso do Script de Seed

## 📋 Passo a Passo

### **1. Copiar o Arquivo**

Copie o arquivo `seed_public_profiles.py` para a pasta de comandos do Django:

```bash
# Estrutura esperada:
your_project/
├── your_app/
│   ├── management/
│   │   ├── __init__.py
│   │   └── commands/
│   │       ├── __init__.py
│   │       └── seed_public_profiles.py  ← AQUI
│   ├── models.py
│   └── ...
└── manage.py
```

**Comandos:**
```bash
# Criar pastas se não existirem
mkdir -p your_app/management/commands

# Criar __init__.py vazios
touch your_app/management/__init__.py
touch your_app/management/commands/__init__.py

# Copiar arquivo
cp seed_public_profiles.py your_app/management/commands/
```

---

### **2. Ajustar Imports no Script**

Abra `seed_public_profiles.py` e ajuste os imports na **linha 22**:

```python
# ANTES (comentado):
# from your_app.models import (
#     PublicProfile,
#     Catalog,
#     ...
# )

# DEPOIS (descomente e ajuste):
from catalogs.models import (  # ou o nome da sua app
    PublicProfile,
    Catalog,
    Product,
    Category,
    Organization,
    Sede,
    ProfileFollow,
    ProfileSave,
    CatalogLike,
    CatalogView,
)
```

---

### **3. Descomentar Código de Criação**

O script tem **código comentado (MOCK)** para você testar sem erros. Você precisa **descomentar** o código real e **comentar/remover os mocks**.

#### **Exemplo - Criar Organização (_create_organization_and_sede):**

```python
def _create_organization_and_sede(self):
    """Cria organização e sede padrão"""
    from catalogs.models import Organization, Sede  # Ajuste o import

    org, _ = Organization.objects.get_or_create(
        name='Catana Demo',
        defaults={
            'description': 'Organização de demonstração para testes',
            'is_active': True,
        }
    )

    sede, _ = Sede.objects.get_or_create(
        name='Sede Principal',
        organization=org,
        defaults={
            'city': 'São Paulo',
            'state': 'SP',
            'is_active': True,
        }
    )

    return org, sede

    # REMOVA ISSO (MOCK):
    # class MockOrg:
    #     id = 1
    #     name = 'Catana Demo'
    # ...
```

#### **Locais para Descomentar:**

Busque por `# MOCK` no arquivo e substitua por código real:

1. **`_create_organization_and_sede`** (linha ~98)
2. **`_create_categories`** (linha ~125)
3. **`_create_users_and_profiles`** (linha ~163)
4. **`_create_catalogs`** (linha ~306)
5. **`_create_products`** (linha ~403)
6. **`_create_interactions`** (linha ~529)

---

### **4. Instalar Faker**

```bash
pip install faker
```

Ou adicione ao `requirements.txt`:
```txt
faker==22.0.0
```

---

### **5. Executar o Script**

```bash
# Criar 50 usuários (padrão)
python manage.py seed_public_profiles

# Criar 100 usuários
python manage.py seed_public_profiles --users=100

# Customizar tudo
python manage.py seed_public_profiles \
    --users=200 \
    --catalogs-per-user=10 \
    --products-per-catalog=30

# Limpar dados anteriores antes de criar
python manage.py seed_public_profiles --clear
```

---

## 📊 O Que Será Criado

### **Configuração Padrão (--users=50)**

```
✅ 50 usuários
   • 17 empresas (ex: "Distribuidora Silva LTDA")
   • 17 criadores (ex: "João da Silva")
   • 16 revendedores (ex: "Revenda Tech")

✅ ~250 catálogos
   • Ex: "Coleção Verão 2025"
   • Ex: "Black Friday 2024"
   • Ex: "Lançamentos Novembro"

✅ ~5.000 produtos
   • SKUs únicos (ex: "SKU-1-00001")
   • Preços: R$ 19,90 - R$ 999,90
   • Com imagens do Unsplash

✅ 14 categorias
   • Moda Feminina, Eletrônicos, Casa, etc.

✅ Interações
   • ~500 follows (usuários seguindo perfis)
   • ~350 saves (perfis salvos)
   • ~1.000 likes em catálogos
   • ~12.500 views nos catálogos
```

**Total de registros: ~18.000**

---

## 🎯 Perfis Criados

### **Tipos**
- **33% Empresas**: Nome de empresa fake (ex: "Silva e Oliveira LTDA")
- **33% Criadores**: Nome de pessoa (ex: "Maria Santos")
- **33% Revendedores**: Nome comercial (ex: "Distribuidora Norte")

### **Segmentos**
Cada perfil tem 1-2 segmentos:
- Moda e Acessórios
- Eletrônicos e Tecnologia
- Alimentos e Bebidas
- Casa e Decoração
- Esportes e Fitness
- Beleza e Cosméticos
- Arte e Artesanato
- Pets
- Saúde e Bem-estar

### **Localização**
- Cidades brasileiras reais
- Estados brasileiros (SP, RJ, MG, etc.)

---

## 🖼️ Imagens

O script usa **URLs do Unsplash** para imagens:

```
✅ Imagens reais de produtos
✅ Alta qualidade (400x400)
✅ Gratuitas para uso
✅ Loading rápido
```

Exemplos incluídos:
- Relógios e acessórios
- Tênis e calçados
- Produtos eletrônicos
- Roupas e moda

---

## ⚙️ Opções do Comando

```bash
python manage.py seed_public_profiles [opções]

Opções:
  --users INT                 Número de usuários (padrão: 50)
  --catalogs-per-user INT    Catálogos por usuário (padrão: 5)
  --products-per-catalog INT Produtos por catálogo (padrão: 20)
  --clear                    Limpa dados de teste antes
```

### **Exemplos:**

```bash
# Criar poucos dados para teste rápido
python manage.py seed_public_profiles --users=10

# Criar muitos dados para teste de performance
python manage.py seed_public_profiles --users=500

# Criar dados customizados
python manage.py seed_public_profiles \
    --users=100 \
    --catalogs-per-user=15 \
    --products-per-catalog=50

# Limpar e recriar
python manage.py seed_public_profiles --clear --users=100
```

---

## ⏱️ Tempo de Execução

| Usuários | Catálogos | Produtos | Tempo |
|----------|-----------|----------|-------|
| 10       | ~50       | ~1.000   | 5s    |
| 50       | ~250      | ~5.000   | 30s   |
| 100      | ~500      | ~10.000  | 1min  |
| 500      | ~2.500    | ~50.000  | 5min  |

---

## 🧪 Testar Após Seed

### **1. No Django Admin**
```
http://localhost:8000/admin/

Veja:
- Usuários criados
- Perfis públicos
- Catálogos
- Produtos
```

### **2. Na API**
```bash
# Buscar perfis
curl http://localhost:8000/api/public-profiles/search/

# Ver perfil específico
curl http://localhost:8000/api/public-profiles/1/

# Catálogos de um perfil
curl http://localhost:8000/api/public-profiles/1/catalogs/
```

### **3. No Frontend**
```
http://localhost:5173/discover
http://localhost:5173/profile/1
```

### **4. Login de Teste**
```
Usuário: qualquer username criado
Email: [username]@example.com
Senha: demo123
```

---

## 🗑️ Limpar Dados

### **Opção 1: Usar --clear**
```bash
python manage.py seed_public_profiles --clear
```

### **Opção 2: Django Shell**
```bash
python manage.py shell

>>> from django.contrib.auth.models import User
>>> User.objects.filter(email__contains='@example.com').delete()
```

### **Opção 3: Flush Completo**
```bash
python manage.py flush --no-input
```

---

## 🐛 Troubleshooting

### **Erro: "No module named 'faker'"**
```bash
pip install faker
```

### **Erro: "Module 'your_app.models' has no attribute 'PublicProfile'"**
→ Ajuste os imports no script (linha 22)

### **Erro: "CommandError: Unknown command: 'seed_public_profiles'"**
→ Verifique se criou os arquivos `__init__.py` nas pastas `management/` e `management/commands/`

### **Erro: "UNIQUE constraint failed"**
→ Use `--clear` para limpar dados anteriores:
```bash
python manage.py seed_public_profiles --clear
```

### **Script roda mas não cria nada**
→ Você ainda está usando os MOCKS. Descomente o código real (veja passo 3)

---

## 📝 Checklist de Instalação

- [ ] Copiei `seed_public_profiles.py` para `management/commands/`
- [ ] Criei arquivos `__init__.py` vazios
- [ ] Ajustei imports dos models (linha 22)
- [ ] Descomentei código real em todos os métodos
- [ ] Instalei Faker (`pip install faker`)
- [ ] Executei o comando
- [ ] Verifiquei os dados criados
- [ ] Testei no frontend

---

## ✨ Pronto!

Agora você tem um banco de dados completo com:
- ✅ Perfis públicos variados
- ✅ Catálogos temáticos
- ✅ Produtos com imagens
- ✅ Interações sociais
- ✅ Dados brasileiros realistas

**Boa sorte com os testes! 🚀**
