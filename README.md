# Katana 2.0 — AI-Native Catalog Studio (`catana-renew`)

Estúdio agêntico de criação, diagramação e gestão de catálogos comerciais com Inteligência Artificial.

Repositório oficial desanexado da versão legada (v0.0 / 1.0), contendo a aplicação nativa focada em diagramação automatizada, orquestração de especialistas e fidelidade editorial de alta-costura.

---

## Estrutura da Aplicação

```
catana-renew/
├── frontend/                # Aplicação React 19 + Vite 7 + Tailwind CSS 4 + TypeScript
│   ├── src/
│   │   ├── components/
│   │   │   └── studio/      # Suite completa do Studio v2.0
│   │   │       ├── KatanaSplashScreen.tsx     # Animação vetorial oficial (usecatana.com.br)
│   │   │       ├── StudioHomeChat.tsx         # Entrada estilo Antigravity
│   │   │       ├── StudioHeader.tsx           # Barra superior com navegador de spreads
│   │   │       ├── CatalogCanvasWorkspace.tsx # Prancheta split-screen
│   │   │       ├── SpreadViewport.tsx         # Lâminas duplas A4 (Click-to-Prompt)
│   │   │       ├── CanvasTopToolbar.tsx       # Modos, zoom e Trava de Marca
│   │   │       ├── PageFilmstrip.tsx          # Fita de navegação por lâminas
│   │   │       ├── AgentCoPilot.tsx           # Painel de conversas e governança
│   │   │       ├── EditorialCouncilModal.tsx  # Mesa Redonda do Conselho Editorial
│   │   │       ├── RoleManagerModal.tsx       # Gestão dos Agentes da Marca (/captar)
│   │   │       ├── PaletteManagerModal.tsx    # Brand Lock e Paletas Semânticas
│   │   │       └── SkillsCatalogModal.tsx     # Catálogo de 24 Skills especializadas
│   │   ├── store/studioStore.ts               # Estado central reativo do estúdio
│   │   ├── data/aureaCatalog.mock.ts          # Dataset da coleção ÁUREA
│   │   └── data/studioSkills.ts               # Documentação das 24 habilidades ativas
│   └── public/                                # Ativos de alta resolução e monogramas
└── backend/                 # API Django 5 + Django REST Framework + SimpleJWT
    ├── catana_back/         # Configurações de settings, ASGI e WSGI
    └── api/                 # Endpoints de catálogos, páginas, produtos e mídias
```

---

## Funcionalidades Principais do Katana 2.0

1. **Prancheta Split-Screen & Lâminas Duplas A4**:
   - Visualização contínua de páginas espelhadas (spreads) em proporção A4 (794×1123).
   - Recurso **Click-to-Prompt**: interação direta com qualquer elemento da prancheta para micro-ajustes com IA.
   - Navegação fluida por spreads via fita inferior de miniaturas.

2. **Gabinete de Agentes Especializados**:
   - **Mestre / Orquestrador**: Coordenação geral e engenharia reversa de catálogos legados.
   - **Diretor de Arte**: Proporção áurea, respiro negativo de 96px e paleta cromática.
   - **Redator Publicitário**: Manifestos conceituais, claims aristocráticos e versalete serifado.
   - **Comercial & Vendas B2B**: Tabelas SKU, cálculos de markup e regras de pedido mínimo.
   - **Auditor de Marca**: Conformidade WCAG AA (≥4.5:1), área de monograma e fidelidade tipográfica.

3. **Engenharia Reversa com `/captar`**:
   - Extrai automaticamente cores, pesos tipográficos, arquétipos de tom de voz e produtos de catálogos antigos em PDF ou manuais de marca.
   - Gera instantaneamente 4 novos agentes especializados da marca captada (nativamente desativados para aprovação humana).

4. **Trava de Marca (Brand Lock)**:
   - Alternador de rigor editorial: modo travado (agentes restritos aos hexadecimais homologados) vs. modo flexível/exploratório.

5. **Catálogo de 24 Habilidades (Skills)**:
   - Modal detalhado com documentação de parâmetros, funcionamento interno, exemplos de invocação e execução em 1 clique.

---

## Como Executar

### Frontend
```bash
cd frontend
npm install
npm run dev
```

Acesse: `http://localhost:5173/` (ou rota demo: `http://localhost:5173/studio-demo`)

### Backend
```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver 8000
```
