# Catana Back - API REST

API REST desenvolvida com Django REST Framework para gerenciamento de catálogos digitais, mídias, produtos e organizações.

## Tecnologias Utilizadas

### Backend
- **Python**: 3.11+ (Docker) / 3.9+ (Local)
- **Django**: 5.2+ - Framework web de alto nível
- **Django REST Framework**: 3.15+ - Toolkit para construção de Web APIs
- **PostgreSQL**: 15 - Banco de dados relacional

### Bibliotecas e Dependências

```txt
Django                          # Framework web
djangorestframework            # API REST toolkit
psycopg2-binary               # Adaptador PostgreSQL
djangorestframework-simplejwt # Autenticação JWT
drf-spectacular               # Documentação OpenAPI/Swagger
django-environ                # Gerenciamento de variáveis de ambiente
Pillow                        # Processamento de imagens
django-cors-headers           # Configuração CORS
```

### Infraestrutura
- **Docker**: Containerização
- **Docker Compose**: Orquestração de containers
- **PostgreSQL 15**: Banco de dados em container

## Arquitetura do Projeto

O projeto segue a arquitetura padrão do Django com os seguintes módulos principais:

### Modelos Principais

- **Organization**: Gerenciamento de organizações
- **Sede**: Gestão de sedes/filiais
- **User**: Sistema de usuários customizado (AbstractUser)
- **Media/MediaFolder**: Gerenciamento de arquivos e pastas
- **Product**: Catálogo de produtos
- **Catalog/Page**: Sistema de catálogos digitais
- **Component/PageComponent**: Componentes reutilizáveis
- **Theme**: Temas customizáveis
- **Activity**: Log de atividades
- **SedeSharing**: Compartilhamento entre sedes

## Pré-requisitos

### Com Docker (Recomendado)
- Docker 20.10+
- Docker Compose 2.0+

### Sem Docker
- Python 3.9+
- PostgreSQL 15+
- pip

## Instalação e Configuração

### 1. Clone o Repositório

```bash
git clone <repository-url>
cd catana-back
```

### 2. Configuração de Variáveis de Ambiente

Crie um arquivo `.env` na raiz do projeto:

```env
SECRET_KEY='sua-secret-key-aqui'
DATABASE_URL=psql://root:root@localhost:5432/catana_db
DEBUG=True
```

**Nota**: Para produção, gere uma SECRET_KEY segura e configure DEBUG=False.

## Executando com Docker

### Iniciar os Containers

```bash
# Construir e iniciar todos os serviços
docker-compose up --build

# Ou em modo detached (background)
docker-compose up -d --build
```

### Comandos Úteis Docker

```bash
# Ver logs dos containers
docker-compose logs -f

# Parar os containers
docker-compose down

# Parar e remover volumes (ATENÇÃO: Remove dados do banco)
docker-compose down -v

# Executar comandos no container web
docker-compose exec web python manage.py <comando>

# Criar superusuário
docker-compose exec web python manage.py createsuperuser

# Executar migrações manualmente
docker-compose exec web python manage.py migrate

# Acessar shell do Django
docker-compose exec web python manage.py shell

# Acessar banco de dados
docker-compose exec db psql -U root -d catana_db
```

### Acessar a Aplicação

- **API**: http://localhost:8000
- **Admin Django**: http://localhost:8000/admin
- **Documentação API (Swagger)**: http://localhost:8000/api/schema/swagger-ui/
- **PostgreSQL**: localhost:5432

## Executando Localmente (Sem Docker)

### 1. Criar Ambiente Virtual

```bash
# Criar ambiente virtual
python3 -m venv venv

# Ativar ambiente virtual
# No Linux/Mac:
source venv/bin/activate
# No Windows:
venv\Scripts\activate
```

### 2. Instalar Dependências

```bash
pip install --upgrade pip
pip install -r requirements.txt
```

### 3. Configurar Banco de Dados PostgreSQL

```bash
# Criar banco de dados
createdb catana_db

# Ou via psql:
psql -U postgres
CREATE DATABASE catana_db;
CREATE USER root WITH PASSWORD 'root';
GRANT ALL PRIVILEGES ON DATABASE catana_db TO root;
\q
```

### 4. Executar Migrações

```bash
python manage.py migrate
```

### 5. Criar Superusuário

```bash
python manage.py createsuperuser
```

### 6. Iniciar Servidor de Desenvolvimento

```bash
python manage.py runserver
```

A aplicação estará disponível em http://localhost:8000

## Comandos Django Úteis

```bash
# Criar novas migrações baseadas nas alterações dos models
python manage.py makemigrations

# Aplicar migrações
python manage.py migrate

# Criar superusuário
python manage.py createsuperuser

# Coletar arquivos estáticos
python manage.py collectstatic

# Executar shell interativo do Django
python manage.py shell

# Executar testes
python manage.py test

# Verificar problemas no projeto
python manage.py check
```

## Estrutura de Diretórios

```
catana-back/
├── api/                        # App principal da API
│   ├── migrations/            # Migrações do banco de dados
│   ├── models.py             # Modelos de dados
│   ├── serializers.py        # Serializers DRF
│   ├── views.py              # Views/ViewSets
│   ├── urls.py               # Rotas da API
│   └── admin.py              # Configuração do Django Admin
├── catana_back/               # Configurações do projeto
│   ├── settings.py           # Configurações principais
│   ├── urls.py               # URLs principais
│   ├── wsgi.py               # WSGI config
│   └── asgi.py               # ASGI config
├── media/                     # Arquivos de mídia (uploads)
├── docker-compose.yml         # Configuração Docker Compose
├── Dockerfile                 # Configuração Docker
├── requirements.txt           # Dependências Python
├── manage.py                  # CLI do Django
├── .env                       # Variáveis de ambiente
├── .dockerignore             # Arquivos ignorados pelo Docker
└── README.md                  # Este arquivo
```

## Endpoints da API

A API fornece endpoints RESTful para:

- **Autenticação**: Login, registro, refresh token (JWT)
- **Organizações**: CRUD de organizações
- **Sedes**: Gerenciamento de sedes e compartilhamento
- **Usuários**: Gestão de usuários e permissões
- **Mídias**: Upload e organização de arquivos
- **Produtos**: Catálogo de produtos
- **Catálogos**: Criação e edição de catálogos digitais
- **Componentes**: Componentes reutilizáveis
- **Temas**: Personalização visual
- **Atividades**: Log de ações dos usuários

Para documentação completa dos endpoints, acesse: http://localhost:8000/api/schema/swagger-ui/

## Autenticação

A API utiliza **JWT (JSON Web Tokens)** para autenticação.

### Obter Token

```bash
POST /api/token/
Content-Type: application/json

{
  "username": "seu_usuario",
  "password": "sua_senha"
}
```

### Usar Token nas Requisições

```bash
Authorization: Bearer <seu_token_aqui>
```

### Refresh Token

```bash
POST /api/token/refresh/
Content-Type: application/json

{
  "refresh": "seu_refresh_token"
}
```

## Desenvolvimento

### Boas Práticas

1. Sempre crie migrações após alterar models: `python manage.py makemigrations`
2. Teste as migrações antes de commitar: `python manage.py migrate`
3. Use ambiente virtual para isolamento de dependências
4. Mantenha o arquivo `requirements.txt` atualizado
5. Não commite o arquivo `.env` com dados sensíveis
6. Use DEBUG=False em produção

### Adicionar Novas Dependências

```bash
# Instalar pacote
pip install nome-do-pacote

# Atualizar requirements.txt
pip freeze > requirements.txt
```

## Solução de Problemas

### Erro de Conexão com o Banco de Dados

```bash
# Verificar se o PostgreSQL está rodando
docker-compose ps

# Reiniciar container do banco
docker-compose restart db

# Verificar logs
docker-compose logs db
```

### Erro de Migrações

```bash
# Resetar migrações (CUIDADO: perde dados)
docker-compose exec web python manage.py migrate --fake api zero
docker-compose exec web python manage.py migrate
```

### Problemas com Permissões de Arquivos

```bash
# Dar permissão para pasta media
chmod -R 755 media/
```

## Segurança

**IMPORTANTE**: Antes de colocar em produção:

1. Gere uma SECRET_KEY forte e única
2. Configure DEBUG=False
3. Configure ALLOWED_HOSTS adequadamente
4. Use HTTPS
5. Configure CORS_ALLOW_ALL_ORIGINS=False
6. Implemente rate limiting
7. Use variáveis de ambiente para dados sensíveis
8. Configure backup do banco de dados
9. Implemente logging adequado

## Contribuindo

1. Crie uma branch para sua feature: `git checkout -b feature/nova-feature`
2. Commit suas mudanças: `git commit -m 'Adiciona nova feature'`
3. Push para a branch: `git push origin feature/nova-feature`
4. Abra um Pull Request

## Licença

[Adicione informações de licença aqui]

## Contato

[Adicione informações de contato aqui]

---

Desenvolvido com Django REST Framework
