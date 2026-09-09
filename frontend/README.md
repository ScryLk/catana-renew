# 📦 Catana - Sistema de Criação de Catálogos Digitais

> Plataforma moderna e intuitiva para criação, edição e exportação de catálogos digitais profissionais.

![React](https://img.shields.io/badge/React-19.1.1-61DAFB?style=flat-square&logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9.3-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-7.1.7-646CFF?style=flat-square&logo=vite&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4.1.14-38B2AC?style=flat-square&logo=tailwind-css&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)

---

## 📋 Índice

- [Sobre o Projeto](#-sobre-o-projeto)
- [Tecnologias Utilizadas](#-tecnologias-utilizadas)
- [Funcionalidades](#-funcionalidades)
- [Pré-requisitos](#-pré-requisitos)
- [Instalação](#-instalação)
- [Configuração](#-configuração)
- [Uso](#-uso)
- [Scripts Disponíveis](#-scripts-disponíveis)
- [Estrutura do Projeto](#-estrutura-do-projeto)
- [Docker](#-docker)
- [Variáveis de Ambiente](#-variáveis-de-ambiente)
- [Contribuindo](#-contribuindo)
- [Licença](#-licença)

---

## 🎯 Sobre o Projeto

O **Catana** é uma plataforma completa para criação de catálogos digitais profissionais. Com uma interface intuitiva estilo drag-and-drop, permite que empresas criem, editem e exportem catálogos de produtos de forma rápida e eficiente.

### ✨ Principais Diferenciais

- 🎨 **Editor Visual Avançado** - Interface drag-and-drop com canvas infinito
- 📱 **Templates Responsivos** - Biblioteca de templates prontos (DiPack)
- 🖼️ **Gerenciamento de Mídia** - Upload e organização de imagens
- 📦 **Sistema de Categorias** - Hierarquia de categorias com visualização em árvore
- 📄 **Exportação Multi-formato** - PDF, Excel, imagens
- 🎭 **Temas Personalizáveis** - Sistema completo de temas
- 🔄 **Componentes Reutilizáveis** - Salve e reutilize grupos de elementos
- 📊 **Dropshipping** - Campos específicos para produtos de dropshipping

---

## 🛠 Tecnologias Utilizadas

### Core

| Tecnologia | Versão | Descrição |
|------------|--------|-----------|
| **React** | 19.1.1 | Biblioteca para interfaces de usuário |
| **TypeScript** | 5.9.3 | Superset JavaScript com tipagem estática |
| **Vite** | 7.1.7 | Build tool e dev server ultra-rápido |
| **React Router DOM** | 7.9.4 | Roteamento para React |
| **Zustand** | 5.0.8 | Gerenciamento de estado global |

### UI/UX

| Tecnologia | Versão | Descrição |
|------------|--------|-----------|
| **Tailwind CSS** | 4.1.14 | Framework CSS utility-first |
| **Radix UI** | Latest | Componentes acessíveis e não estilizados |
| **Lucide React** | 0.546.0 | Biblioteca de ícones |
| **React Icons** | 5.5.0 | Coleção de ícones populares |
| **class-variance-authority** | 0.7.1 | Variantes de componentes |

### Features Específicas

| Tecnologia | Versão | Descrição |
|------------|--------|-----------|
| **@dnd-kit** | 6.3.1 | Drag and drop toolkit |
| **@react-pdf/renderer** | 4.3.1 | Geração de PDFs |
| **html2canvas** | 1.4.1 | Conversão HTML para Canvas |
| **jsPDF** | 3.0.3 | Biblioteca de geração de PDF |
| **xlsx** | 0.18.5 | Leitura/escrita de Excel |
| **qrcode.react** | 4.2.0 | Geração de QR Codes |
| **@imgly/background-removal** | 1.7.0 | Remoção de fundo de imagens |

### DevTools

| Tecnologia | Versão | Descrição |
|------------|--------|-----------|
| **ESLint** | 9.36.0 | Linter para JavaScript/TypeScript |
| **typescript-eslint** | 8.45.0 | Plugin ESLint para TypeScript |
| **Autoprefixer** | 10.4.21 | Plugin PostCSS para vendor prefixes |

---

## 🚀 Funcionalidades

### Editor de Catálogos

- ✅ Canvas infinito com zoom e pan
- ✅ Drag and drop de elementos
- ✅ Múltiplas páginas
- ✅ Grid e réguas de alinhamento
- ✅ Undo/Redo
- ✅ Atalhos de teclado
- ✅ Context menu com ações rápidas
- ✅ Camadas (layers) gerenciáveis
- ✅ Grupos de elementos

### Elementos Suportados

- 📝 Texto (com estilos customizáveis)
- 🖼️ Imagens
- 🔷 Formas geométricas
- 📦 Produtos
- 📱 QR Codes
- 🎨 Templates DiPack pré-configurados

### Gerenciamento

- 📁 **Biblioteca de Mídia** - Upload e organização de arquivos
- 🗂️ **Categorias de Produtos** - Hierarquia com visualização em árvore
- 💾 **Componentes Salvos** - Reutilize elementos
- 🏢 **Organizações** - Multi-tenancy
- 👥 **Sedes** - Compartilhamento de recursos

### Exportação

- 📄 **PDF** - Alta qualidade com fidelidade de cores
- 📊 **Excel** - Exportação de dados de produtos
- 🖼️ **Imagens** - PNG de alta resolução
- 🖨️ **Impressão** - Direta do navegador

---

## 📋 Pré-requisitos

Antes de começar, certifique-se de ter instalado:

- **Node.js** >= 18.0.0
- **npm** >= 9.0.0 ou **yarn** >= 1.22.0
- **Git** >= 2.30.0

### Verificar instalação

```bash
node --version
npm --version
git --version
```

---

## 📥 Instalação

### 1. Clone o repositório

```bash
git clone https://github.com/seu-usuario/catana-front.git
cd catana-front
```

### 2. Instale as dependências

```bash
npm install
```

ou com yarn:

```bash
yarn install
```

### 3. Configure as variáveis de ambiente

Crie um arquivo `.env` na raiz do projeto:

```bash
cp .env.example .env
```

Edite o arquivo `.env` com suas configurações:

```env
# API Configuration
VITE_API_BASE_URL=http://localhost:8000

# PDFShift API (opcional - para conversão PDF)
VITE_PDFSHIFT_API_KEY=sua-chave-api-aqui
```

### 4. Inicie o servidor de desenvolvimento

```bash
npm run dev
```

O aplicativo estará disponível em: **http://localhost:5173**

---

## ⚙️ Configuração

### Conectando ao Backend

O frontend requer o backend para funcionar completamente. Configure o backend seguindo as instruções em:

📂 `catana-back/README.md`

URL padrão do backend: `http://localhost:8000`

### Configurações Adicionais

#### Tailwind CSS

O projeto usa Tailwind CSS v4 com PostCSS. A configuração está em:

- `@/index.css` - Configuração de temas e cores
- `postcss.config.js` - PostCSS plugins

#### TypeScript

Configuração em `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "Bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedSideEffectImports": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

---

## 🎮 Uso

### Criando um Catálogo

1. **Login/Registro** - Acesse a plataforma
2. **Novo Catálogo** - Clique em "Novo Catálogo"
3. **Selecione um Template** - Escolha um template ou comece do zero
4. **Edite** - Use o editor drag-and-drop
5. **Exporte** - Gere PDF, Excel ou imagens

### Atalhos de Teclado

| Atalho | Ação |
|--------|------|
| `Ctrl/Cmd + Z` | Desfazer |
| `Ctrl/Cmd + Shift + Z` | Refazer |
| `Ctrl/Cmd + C` | Copiar |
| `Ctrl/Cmd + V` | Colar |
| `Ctrl/Cmd + D` | Duplicar |
| `Delete` | Deletar seleção |
| `Ctrl/Cmd + A` | Selecionar tudo |
| `Ctrl/Cmd + G` | Agrupar |
| `Ctrl/Cmd + Shift + G` | Desagrupar |

---

## 📜 Scripts Disponíveis

```bash
# Desenvolvimento
npm run dev          # Inicia servidor de desenvolvimento

# Build
npm run build        # Compila TypeScript e cria build de produção

# Lint
npm run lint         # Executa ESLint

# Preview
npm run preview      # Preview do build de produção
```

---

## 📁 Estrutura do Projeto

```
catana-front/
├── public/              # Arquivos estáticos
├── src/
│   ├── components/      # Componentes React
│   │   ├── auth/       # Autenticação
│   │   ├── catalog/    # Componentes de catálogo
│   │   ├── editor/     # Editor de catálogo
│   │   ├── products/   # Gestão de produtos
│   │   └── ui/         # Componentes UI (shadcn/ui)
│   ├── contexts/        # React Contexts
│   ├── hooks/           # Custom hooks
│   ├── lib/             # Bibliotecas e utilities
│   ├── pages/           # Páginas da aplicação
│   ├── plugins/         # Sistema de plugins
│   ├── services/        # Serviços e API calls
│   ├── store/           # Zustand stores
│   ├── types/           # TypeScript types
│   ├── App.tsx          # Componente principal
│   ├── main.tsx         # Entry point
│   └── index.css        # Estilos globais
├── .env                 # Variáveis de ambiente (criar)
├── .env.example         # Exemplo de variáveis
├── package.json         # Dependências e scripts
├── tsconfig.json        # Configuração TypeScript
├── vite.config.ts       # Configuração Vite
└── README.md            # Este arquivo
```

### Componentes Principais

#### Editor (`src/components/editor/`)

- `InfiniteCanvas.tsx` - Canvas principal
- `EditorToolbar.tsx` - Barra de ferramentas
- `EditorSidebar.tsx` - Sidebar com painéis
- `ProductSelector.tsx` - Seletor de produtos
- `ImageSelector.tsx` - Biblioteca de imagens
- `ComponentsPanel.tsx` - Painel de componentes

#### UI (`src/components/ui/`)

Componentes shadcn/ui:
- `button.tsx`, `card.tsx`, `input.tsx`, `label.tsx`
- `select.tsx`, `checkbox.tsx`, `textarea.tsx`
- `dialog.tsx`, `tabs.tsx`

---

## 🐳 Docker

### Docker Compose (Frontend + Backend)

#### Arquivo `docker-compose.yml`

```yaml
version: '3.8'

services:
  # Backend Django
  backend:
    build: ./catana-back
    container_name: catana-backend
    ports:
      - "8000:8000"
    environment:
      - DEBUG=1
      - DATABASE_URL=postgresql://user:password@db:5432/catana
      - SECRET_KEY=your-secret-key-here
    depends_on:
      - db
    volumes:
      - ./catana-back:/app
      - media_files:/app/media
    command: python manage.py runserver 0.0.0.0:8000

  # Frontend React
  frontend:
    build: ./catana-front
    container_name: catana-frontend
    ports:
      - "5173:5173"
    environment:
      - VITE_API_BASE_URL=http://localhost:8000
    volumes:
      - ./catana-front:/app
      - /app/node_modules
    command: npm run dev -- --host

  # PostgreSQL Database
  db:
    image: postgres:15-alpine
    container_name: catana-db
    environment:
      - POSTGRES_DB=catana
      - POSTGRES_USER=user
      - POSTGRES_PASSWORD=password
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

volumes:
  postgres_data:
  media_files:
```

#### Dockerfile (Frontend)

```dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy project files
COPY . .

# Expose port
EXPOSE 5173

# Start dev server
CMD ["npm", "run", "dev", "--", "--host"]
```

### Comandos Docker

```bash
# Construir e iniciar todos os serviços
docker-compose up -d

# Ver logs
docker-compose logs -f frontend

# Parar todos os serviços
docker-compose down

# Rebuild
docker-compose up -d --build

# Executar comandos no container
docker-compose exec frontend npm install nova-dependencia
```

### Build de Produção com Docker

```dockerfile
# Dockerfile.prod
FROM node:18-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

---

## 🔐 Variáveis de Ambiente

### `.env.example`

```env
# ======================
# API Configuration
# ======================
VITE_API_BASE_URL=http://localhost:8000

# ======================
# PDFShift API
# ======================
# Obtenha sua chave em: https://pdfshift.io/
VITE_PDFSHIFT_API_KEY=

# ======================
# Features Flags
# ======================
VITE_ENABLE_BACKGROUND_REMOVAL=true
VITE_ENABLE_EXCEL_EXPORT=true

# ======================
# Development
# ======================
VITE_DEV_MODE=true
```

### Obtendo API Keys

#### PDFShift (Opcional)

1. Acesse: https://pdfshift.io/
2. Crie uma conta
3. Copie sua API key
4. Cole em `VITE_PDFSHIFT_API_KEY`

---

## 🤝 Contribuindo

Contribuições são sempre bem-vindas!

### Como Contribuir

1. **Fork** o projeto
2. **Clone** seu fork
   ```bash
   git clone https://github.com/seu-usuario/catana-front.git
   ```
3. **Crie** uma branch para sua feature
   ```bash
   git checkout -b feature/minha-feature
   ```
4. **Commit** suas mudanças
   ```bash
   git commit -m '✨ Adiciona minha feature'
   ```
5. **Push** para a branch
   ```bash
   git push origin feature/minha-feature
   ```
6. **Abra** um Pull Request

### Padrões de Commit

Seguimos o [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` Nova funcionalidade
- `fix:` Correção de bug
- `docs:` Documentação
- `style:` Formatação
- `refactor:` Refatoração
- `test:` Testes
- `chore:` Manutenção

---

## 📝 Licença

Este projeto está sob a licença MIT. Veja o arquivo [LICENSE](LICENSE) para mais detalhes.

---

## 👥 Equipe

Desenvolvido com ❤️ pela equipe Catana

---

## 📞 Suporte

- 📧 Email: suporte@catana.com
- 💬 Discord: [Catana Community](https://discord.gg/catana)
- 📖 Docs: [docs.catana.com](https://docs.catana.com)

---

## 🗺️ Roadmap

- [ ] App Mobile (React Native)
- [ ] Colaboração em tempo real
- [ ] IA para sugestões de design
- [ ] Marketplace de templates
- [ ] Integração com e-commerces

---

**Feito com ❤️ e TypeScript**
