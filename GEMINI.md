# GEMINI.md — Katana 2.0 (AI-Native Catalog Studio Standalone)

> **ATENÇÃO PARA AGENTES IA**: Este documento é a **fonte única de verdade operacional, arquitetural e histórica** para o desenvolvimento do **Katana 2.0** no repositório `catana-renew`. Antes de realizar qualquer modificação no código, consulte as convenções, o estado das fases e as regras inegociáveis descritas aqui.

---

## 1. Visão Geral & Separação Total do Legado (v0.0 → v2.0)

O Katana 2.0 foi desanexado do Katana 1.0 (editor manual com ferramentas de desenho estilo Canva/Figma). Este repositório (`catana-renew`) é a versão oficial, limpa e dedicada exclusivamente ao **Estúdio Agêntico de Criação e Gestão de Catálogos Comerciais com Inteligência Artificial**.

### Pilares Arquiteturais:
1. **Zero Ferramentas Manuais de Desenho**: Sem caneta, réguas manuais ou arrastar-e-soltar de coordenadas brutas. A diagramação é resolvida por intenção em linguagem natural, agentes especialistas e autolayout algorítmico.
2. **Prancheta Split-Screen A4**: Renderização de lâminas duplas (`SpreadViewport.tsx`) com Click-to-Prompt contextual e edição inline.
3. **Multi-Agentes & Governança de Marca**:
   - Orquestrador (Mestre)
   - Diretor de Arte (Design)
   - Redator Publicitário (Redação)
   - Agente Comercial (B2B)
   - Auditor de Marca (Conformidade WCAG AA)
   - 4 Agentes Especializados captados por `/captar` (nativamente desativados até validação humana).
4. **Trava de Marca (Brand Lock)**: Governança cromática rigorosa que restringe os agentes aos tokens da paleta ativa quando acionada.
5. **Catálogo de 24 Habilidades (Skills)**: Documentação e execução via `/comando`, pílulas rápidas ou modal explicativo.

---

## 2. Padrões de Design e Estética (Design System)

* **Tema**: Dark mode profissional e sóbrio com estética *editorial studio* (`#09090b`, `#111114`, bordas em `zinc-800`). Suporte a light mode sem perda de legibilidade.
* **Monocromático Editorial**:
  - Proibidos degradês genéricos de IA (tons roxos, magentas e gradientes "AI slop").
  - Botões principais em branco puro e cinza zinco (`bg-zinc-100 text-zinc-950 hover:bg-white` e `bg-zinc-800 border-zinc-700`).
* **Zero Emojis**: Rigorosamente nenhum emoji na interface, mensagens do sistema, tooltips ou respostas de agentes.

---

## 3. Estrutura de Diretórios

```
catana-renew/
├── frontend/
│   ├── src/
│   │   ├── components/studio/   # Componentes da suite Katana 2.0
│   │   ├── pages/               # KatanaStudio, Products, Catalogs, Auth
│   │   ├── store/studioStore.ts # Store central
│   │   ├── data/                # editorialCatalog.mock.ts, studioSkills.ts
│   │   └── services/            # API, persistência e exportação PDF
│   └── public/                  # Ativos editoriais e logo v2
└── backend/
    ├── catana_back/             # Settings Django
    └── api/                     # Endpoints e models (Catalog, Page, Product, Media)
```

---

## 4. Regras Inegociáveis

1. **Integridade do Build**: Antes de qualquer commit no frontend, execute `npm run build` dentro de `frontend/`. Erros de tipagem do TypeScript não são tolerados.
2. **Preservação de Spreads**: Toda alteração visual deve respeitar o grid A4 (794×1123 por página) e respiros negativos generosos (mínimo de 96px em páginas editoriais).
3. **Independência**: Nenhuma dependência do editor manual legado (v0.0) deve ser reintroduzida.

---

## 5. Arquitetura de Persistência no PostgreSQL (Prioridade 1)

O Katana Studio 2.0 utiliza um modelo **Híbrido Relacional + Documento por Lâmina**, eliminando qualquer dependência de arquivos mockados ou do `localStorage` como fontes primárias de dados em produção.

### 5.1 Modelagem de Dados

1. **`StudioCatalog` (Tabela Relacional `studio_catalogs`)**:
   - `id`: Chave primária inteira autoincrementada.
   - `title`: Título do catálogo.
   - `brand_name`: Nome da marca associada.
   - `style_preset`: Nome do estilo editorial (ex: `editorial_clean`, `Luxe · Noir & Or`).
   - `primary_color`, `secondary_color`, `accent_color`: Cores fundamentais do tema.
   - `font_family`: Família tipográfica principal.
   - `page_width`, `page_height`: Dimensões em pixels da página A4 (padrão 794×1123).
   - `total_pages`: Quantidade total de páginas no catálogo.
   - `brand_lock`: Booleano que governa se a paleta de cores está travada contra alterações de IA.
   - `palette_data`: JSONField com a definição completa dos tokens cromáticos (`name`, `primary`, `background`, `accent`, `secondary`, `surface`, `contrastRatio`, `locked`).
   - `organization`, `created_by`: Vínculos de governança multi-tenant e autoria.

2. **`CatalogSpread` (Tabela Relacional `catalog_spreads`)**:
   - `catalog`: Chave estrangeira para `StudioCatalog` com `on_delete=CASCADE`.
   - `spread_index`: Índice sequencial da lâmina (0-based: spread 0 = páginas 1 e 2).
   - `title`: Título descritivo do spread.
   - `left_page_elements`: JSONField contendo o objeto estruturado da página esquerda (`CatalogPageData`), incluindo overlays decorativos, produtos alocados, textos e cores.
   - `right_page_elements`: JSONField contendo o objeto estruturado da página direita (`CatalogPageData`).
   - `unique_together`: `('catalog', 'spread_index')`.

### 5.2 Endpoints e Rotas REST (`/api/v2/studio/`)

- `GET /api/v2/studio/catalogs/`: Lista todos os catálogos do usuário/organização com contagem de spreads e metadados.
- `POST /api/v2/studio/catalogs/`: Cria um novo catálogo persistido no banco com spread inicial e thread de orquestração.
- `GET /api/v2/studio/catalogs/<id>/`: Recupera o catálogo completo com todos os spreads ordenados, páginas deserializadas (`left_page`, `right_page`), paleta, travas e histórico de mensagens das threads.
- `PUT /api/v2/studio/catalogs/<id>/`: Atualiza metadados globais (título, descrição, marca, travas, paleta de cores).
- `POST /api/v2/studio/catalogs/<id>/spreads/`: Salva de forma atômica e idempotente a lâmina atual (`spread_index`, `left_page`, `right_page`) com normalização transparente.
- `POST /api/v2/studio/catalogs/<id>/spreads/bulk/`: Sincroniza em lote todos os spreads de um catálogo recém-criado ou gerado pela IA em uma única transação atômica (`transaction.atomic`).

### 5.3 Ciclo de Vida e Hidratação no Zustand (`studioStore.ts`)

1. **Criação Imediata**: Ao invocar `createBlankCatalog` ou ao finalizar a síntese de IA (`finishCatalogGeneration`), o frontend executa imediatamente uma requisição `POST /api/v2/studio/catalogs/`, recebendo o ID numérico real do PostgreSQL.
2. **Sincronização em Lote**: Logo após a criação, os spreads gerados são enviados via `POST .../spreads/bulk/`, persistindo 100% dos dados na base relacional antes de liberar a edição.
3. **Hidratação Transparente (`loadExistingCatalog`)**: Quando um catálogo é selecionado ou restaurado após F5, o Zustand consulta `GET /api/v2/studio/catalogs/<id>/` no backend, reconstruindo a lista `pages: CatalogPageData[]` com todos os overlays e produtos diretamente do banco.
4. **Autosave Debounced Atômico (`debouncedSaveCurrentSpread`)**: Cada intervenção na prancheta ou alteração realizada pelo Conselho de Agentes aciona o autosave com debounce de 1200ms, enviando apenas a lâmina ativa via `POST .../spreads/`. O status visual de persistência é exposto em `saveStatus` (`saved`, `saving`, `error`).
5. **Papel do `localStorage`**: O `localStorage` atua exclusivamente como cache local de contingência offline e memorização do último catálogo acessado (`katana_studio_last_active_catalog`), nunca como fonte primária da verdade.

---

## 6. Arquitetura de Exportação em Alta Resolução (300 DPI) e Governança Gráfica (Prioridade 2)

O Katana Studio 2.0 entrega um pipeline de renderização gráfica e exportação de PDF de nível profissional, garantindo pré-impressão gráfica (300 DPI) e distribuição digital (150 DPI) com fidelidade absoluta de vetores, produtos e tipografia.

### 6.1 Fidelidade Vetorial Completa nos Snapshots de Exportação
- **Componente `PageOverlayLayer`**: Recebe a propriedade opcional `interactive?: boolean`. No modo de exportação (`interactive={false}`), o componente desativa anéis de foco, contornos de seleção e a barra flutuante de ações, renderizando estritamente as badges, carimbos, callouts, traços decorativos e adesivos gráficos com `pointer-events-none`.
- **Integração em `EditorialPageSnapshot`**: O `<PageOverlayLayer page={page} interactive={false} />` é incorporado no fluxo do `pageInner`, assegurando que todas as lâminas impressas contenham todos os elementos inseridos no editor visual.

### 6.2 Resolução Calibrada de Impressão A4 (300 DPI)
- **Serviço `pdfExportService.ts`**:
  - Calcula a escala em pixels a partir da largura física da norma ISO A4 (210 mm = 8,2677 polegadas): `targetPixelWidth = (210 / 25.4) * dpi`.
  - A 300 DPI (perfil Gráfica), a renderização atinge 2480 px de largura por lâmina (fator de escala ~5.06x sobre a largura base de 490 px).
  - A 150 DPI (perfil Digital), a renderização atinge 1240 px de largura (fator de escala ~2.53x).
  - Pré-carregamento assíncrono rigoroso: o serviço aguarda `document.fonts.ready` e executa um `Promise.all` em todas as tags `<img>` do container com timeout de guarda (4000ms), prevenindo layouts quebrados ou imagens em branco.
  - Limpeza imediata de recursos: libera os buffers de cada página renderizada no `jsPDF` antes de avançar para a lâmina seguinte.

### 6.3 Governança de Cotas e Permissões de Exportação
- **Endpoint Backend `POST /api/v2/studio/export/check-guard/`**:
  - Implementado em `StudioExportGuardCheckView` com chamada a `check_export_guard(user, dpi)`.
  - Permite livremente 150 DPI para todos os planos (incluindo usuários gratuitos ou anônimos).
  - Bloqueia requisições em 300 DPI para usuários no Plano Gratuito com `HTTP 403 Forbidden` e código `export_dpi_restricted`.
  - Libera automaticamente 300 DPI para planos Pro e Enterprise.
- **Interação no Frontend (`ExportCatalogModal.tsx`)**:
  - Ao iniciar a geração de PDF no perfil Gráfica (300 DPI), valida a cota com a API.
  - Em caso de restrição (403), emite uma notificação contextual via toast com ação de upgrade imediata para o Plano Pro através de `openAccountSettings()`.

---

## 7. Arquitetura do Importador de Produtos (CSV/Excel) e Automação Comercial (Prioridade 3)

O Katana Studio 2.0 fornece um mecanismo completo de ingestão e automação comercial para produtos a partir de planilhas nos formatos Microsoft Excel (`.xlsx`, `.xls`) e Comma/Semicolon-Separated Values (`.csv`).

### 7.1 Persistência e Sincronização Relacional
- **Campo `unassigned_products` no `StudioCatalog`**:
  - Tabela `studio_catalogs`: armazena de forma nativa e persistente a lista completa de produtos não alocados pertencentes àquele catálogo (`CatalogPageData` / `ProductItem`).
  - O endpoint `GET /api/v2/studio/catalogs/<id>/` hidrata `unassignedProducts` diretamente do banco no Zustand.
  - O endpoint `PUT /api/v2/studio/catalogs/<id>/` atualiza a lista de produtos não alocados quando itens são removidos, editados ou alocados.
- **Sincronização com o Acervo Global (`Product`)**:
  - Ao importar uma planilha, os produtos válidos também são registrados na tabela relacional `api_product` associados à organização do usuário (`Product.objects.get_or_create(...)`), permitindo busca global, reutilização e gestão centralizada de SKUs.

### 7.2 Sanitização e Normalização de Dados (`StudioProductSheetImportView`)
- **Endpoints**:
  - `POST /api/v2/studio/products/import-sheet/`: Ingestão geral de produtos no acervo.
  - `POST /api/v2/studio/catalogs/<catalog_id>/products/import-sheet/`: Ingestão associada diretamente a um catálogo específico.
- **Normalização Monetária e Textual**:
  - Preços brutos (`120.5`, `"120,50"`, `"R$ 1.200,00"`) são sanitizados para o formato canônico `R$ X.XXX,XX` e float numérico.
  - Geração automática de identificadores e SKUs caso ausentes (`SKU-001`, `prod-sheet-...`).
  - Sanitização de descrições, categorias e URLs de fotos.
- **Robustez de Delimitadores CSV**:
  - Detecção automática de delimitadores de ponto-e-vírgula (`;`), vírgula (`,`) e tabulação (`\t`), garantindo suporte sem atritos a planilhas brasileiras e européias exportadas do Excel.

### 7.3 Fluxos de Operação: "Acervo" vs. "Planilha para Catálogo em 1 Clique"
- **Fluxo 1: Salvar na Gaveta de Produtos**:
  - Envia os produtos sanitizados para a API, popula `unassignedProducts` e abre a gaveta de produtos (`ProductDrawer`) para que o usuário faça a alocação visual nos slots das páginas.
- **Fluxo 2: Gerar Catálogo Automático**:
  - Envia os produtos para o motor generativo (`triggerCatalogGeneration` / `StudioCatalogGenerateView`).
  - O serviço `TemplateRAGService.plan_dynamic_catalog_structure` calcula a quantidade e os tipos de páginas com base na quantidade e nicho de produtos:
    - Capa editorial com monograma e tipografia nobre.
    - Manifesto da coleção.
    - Lâminas de destaque (`hero`), duplas (`duo`), e matrizes comerciais (`grid_4` de 4 produtos) distribuindo os produtos da planilha.
    - Contracapa com canais comerciais e QR Code.
  - O catálogo gerado é persistido imediatamente no PostgreSQL via transação atômica (`spreads/bulk/`).

---

## 8. Arquitetura de Onboarding Interativo e Templates Canônicos de Demonstração (Prioridade 4)

O Katana Studio 2.0 soluciona o cenário de "Zero Data State" (usuário recém-cadastrado ou sem catálogos prévios) por meio de um sistema integrado de onboarding, templates de demonstração canônicos e persistência relacional sob demanda.

### 8.1 Templates Canônicos Multissetoriais (`CANONICAL_DEMO_TEMPLATES`)
Foram modelados 4 catálogos de demonstração de alta fidelidade com 6 páginas A4, fotografias em alta definição, preços formatados e códigos SKU:
1. **Maison Verdana (Moda & Luxo)**:
   - Paleta: *Luxe · Noir & Or* (`#18181B`, `#52525B`, `#B08D57`, `#F5F1EA`).
   - Estrutura: Capa minimalista nobre, Manifesto "A Geometria do Cuidado", Hero Casaco Structural Noir, Duo Alfaiataria (Blazer & Calça Palazzo), Grade 4 Peças Complementares e Contracapa Executiva.
2. **VEKTRON Systems (Hardware & Engenharia B2B)**:
   - Paleta: *Minimaliste · Slate & Pure Ivory* (`#0F0F11`, `#3F3F46`, `#06B6D4`, `#F4F4F5`).
   - Estrutura: Capa técnica industrial, Manifesto de Alta Disponibilidade, Hero Servidor Edge 1U, Duo Infraestrutura (Switches & Racks 42U), Grade 4 Componentes e Contracapa Comercial com canais B2B.
3. **Atelier Sucré (Gastronomia & Confeitaria Fina)**:
   - Paleta: *Édition · Terracotta & Sable* (`#2C1E1A`, `#6A4D45`, `#C86D51`, `#FAF6F0`).
   - Estrutura: Capa gourmet, Manifesto da Confeitaria Artesanal, Hero Macarons Finos, Duo Sobremesas & Potes, Grade 4 Bolos e Geleias, e Contracapa para encomendas.
4. **Cristallo (Alta Joalheria & Gemas Raras)**:
   - Paleta: *Luxe · Noir & Or* (`#121214`, `#4A4846`, `#D4AF37`, `#FDFBF7`).
   - Estrutura: Capa alta joalheria, Manifesto da Ourivesaria, Hero Solitário de Diamante 2.1ct GIA, Duo Esmeraldas & Colares, Grade 4 Alianças e Contracapa Concierge VIP.

### 8.2 Endpoints de Demonstração no Backend
- `GET /api/v2/studio/demo/templates/`:
  - Retorna a lista consolidada dos 4 templates com títulos, metadados, contagem de páginas e especificações da paleta.
- `POST /api/v2/studio/demo/load-template/`:
  - Recebe `template_key` (`maison_verdana`, `vektron_systems`, `atelier_sucre`, `cristallo_joias`).
  - **Para usuários autenticados**: Clona e persiste um registro real de `StudioCatalog` e lâminas `CatalogSpread` associadas à organização do usuário no PostgreSQL com `brand_lock=True` e `unassigned_products` populados na gaveta lateral. Retorna o ID real do banco para ativação do autosave debounced.
  - **Para usuários anônimos / offline**: Retorna a estrutura completa em memória sem quebrar a navegação ou exigir autenticação obrigatória imediata.

### 8.3 Interface Refinada da Home (`StudioHomeChat.tsx` e `CatalogGenerationModal.tsx`)
- **Remoção de Poluição Visual e Foco Total no Chat**:
  - Remoção da barra superior ("Primeiro Acesso"), restaurando a centralidade limpa e direta do prompt de criação abaixo do título herói ("O que vamos criar hoje?").
- **Galeria Visual de Capas Canônicas (A4 Portrait)**:
  - Substituição dos cards de texto 2x2 por uma estante elegante de 4 capas verticais em proporção ISO A4 (1:1.414).
  - Shading tridimensional realista de lombada editorial na borda esquerda, selos tipográficos minimalistas, contracapa com paginação e overlay suave no hover ("Ver como foi gerado").
- **Modal de Detalhes da Geração por IA (`CatalogGenerationModal.tsx`)**:
  - Ao clicar sobre qualquer capa, abre-se um modal dedicado que detalha:
    - **Prompt de Geração pela IA**: Prompt integral orquestrado para aquele segmento, com botões para "Copiar Prompt" (com feedback sonner) e "Usar este Prompt no Chat" (preenche o input da home e fecha o modal).
    - **Agentes Especialistas Envolvidos**: Pílulas interativas com os papéis de cada agente (Orquestrador Chefe, Diretor de Arte Editorial, Copywriter de Luxo, Curador Comercial, etc.).
    - **Diretrizes de Design & Diagramação**: Especificação de tipografia (Display, Body, Mono), sistema de grid suíço ou modular A4, e amostras da paleta cromática com razão de contraste WCAG (AAA/AA).
    - **Ações Imediatas**: "Folhear Revista (Flipbook)" (`/view/:id`) em nova aba e "Abrir e Editar na Prancheta" (clona e carrega na prancheta com spinner de carregamento).
- **Acesso Permanente na Barra Lateral (`StudioSidebar.tsx`)**:
  - Seção colapsável "Templates Demo" que permite aos usuários alternar ou recarregar os templates canônicos a qualquer momento, mesmo após terem projetos próprios salvos.


---

## 9. Arquitetura de Compartilhamento Público e Visualizador Interativo Web (Digital Flipbook - Prioridade 5)

A experiência de entrega e distribuição comercial do Katana Studio 2.0 foi expandida para além do download de arquivos estáticos, introduzindo o **Visualizador Interativo Web (Digital Flipbook)** e compartilhamento público instantâneo sem necessidade de autenticação.

### 9.1 Endpoint Público Seguro no Backend (`StudioPublicCatalogView`)
- **Rota**: `GET /api/v2/studio/public/catalogs/<str:catalog_id>/`
- **Permissão**: `AllowAny` (acessível anonimamente por qualquer navegador ou crawler de indexação).
- **Resolução Híbrida de Identificadores**:
  - **IDs Numéricos do Banco**: Localiza a publicação no PostgreSQL (`StudioCatalog`), extrai as lâminas ordenadas (`CatalogSpread`), compõe páginas esquerda/direita e metadados visuais.
  - **Chaves de Demonstração Canônicas**: Resolve chaves diretas (`maison_verdana`, `vektron_systems`, `atelier_sucre`, `cristallo_joias`) ou variantes com hífen/prefixo (`demo-vektron-systems`), retornando a publicação completa em tempo real.
- **Sanitização Estrita de Privacidade**:
  - Expõe apenas informações editoriais públicas (título, marca, lâminas, paleta cromática, páginas, produtos e folios).
  - Omite e-mails de criadores, IDs organizacionais internos, histórico de chat e relatórios de faturamento.

### 9.2 Visualizador Editorial Web (`PublicCatalogReader.tsx`)
- **Rotas Registradas no Frontend**:
  - `/view/:id` (rota canônica do leitor público).
  - `/c/:id` (alias curto otimizado para mensagens e links compartilhados).
- **Modos de Exibição Dinâmicos**:
  - **Modo Lâmina Dupla (Open Book Spread)**:
    - Exibe páginas esquerda e direita lado a lado em proporção ISO A4 (490px x 693px por página).
    - Integra sombra volumétrica de lombada central (`linear-gradient`) simulando a dobra de uma publicação impressa de luxo.
  - **Modo Página Individual (Single Page)**:
    - Otimizado para telas estreitas (smartphones e tablets) ou para leitura vertical focada.
    - Alternância automática via `window.innerWidth < 1024` com opção de override manual no cabeçalho.
- **Controles de Leitura e Ambiência**:
  - **Ambiência de Leitura**: Alternância entre *Dark Cinema* (`#09090b` / `#0c0c0f`) e *Light Paper* (`#EFECE6` / `#FFFFFF`).
  - **Zoom Suave**: Níveis de 60% a 160% com atalho de redefinição imediata para 100%.
  - **Navegação Multimodal**: Setas direcionais no teclado (`ArrowLeft` / `ArrowRight`), botões flutuantes, slider scrubber contínuo e atalho numérico de lâminas.
  - **Modo Tela Cheia (Fullscreen)**: Integração com a Fullscreen API nativa com atalho de teclado `F`.
- **Inspeção de Produto & Conversão Comercial**:
  - O leitor pode clicar em qualquer item nas páginas para abrir o modal de detalhes do produto.
  - Exibe foto em alta resolução, preço formatado, especificações técnicas e o botão de conversão direta **"Consultar via WhatsApp"** com mensagem estruturada pré-formatada.
- **Distribuição e Integração com o Studio**:
  - O `ExportCatalogModal.tsx` gera links apontando diretamente para `${origin}/view/${catalogId}`, permitindo cópia de link, abertura direta em nova aba e geração de QR Code vetorial SVG para aplicações físicas.

---

## 10. Arquitetura da Sidebar de Navegação (Padrão Antigravity IDE)

A barra lateral de navegação e histórico (`StudioSidebar.tsx` e `studioStore.ts`) foi alinhada à arquitetura de navegação do **Antigravity IDE**, estruturando a gestão de conversas e projetos em 3 seções hierárquicas e complementares:

### 10.1 Seção 1: Marcas (Workspaces & Pastas de Marca)
- **Cabeçalho com Ação Direta**: Rótulo em tipografia mono `MARCAS {count}` acompanhado do botão `FolderPlus` para criação imediata de novos Brand Kits.
- **5 Marcas Canônicas**: `VEKTRON Systems`, `Maison Éthérée`, `Atelier Sucré`, `Nexus Core` e `Cristallo`.
- **Destaque Visual da Marca Ativa**: Borda e background estilo pill refinado (`bg-zinc-800/60 border-zinc-700/80 text-zinc-100 font-medium`), com ícone de pasta e atalho contextual de configurações `Settings` exibido no hover.
- **Hierarquia em Árvore Indentada**: Ao expandir uma marca, seus catálogos são apresentados com linha-guia vertical (`border-l border-zinc-800/80 ml-4 pl-3`), título legível e timestamps relativos em tipografia mono (`1d`, `5d`, `12d`).
- **Tratamento de Marcas Vazias**: Caso uma marca não possua catálogos vinculados, a expansão exibe o estado descritivo *"Nenhum projeto cadastrado"* e o botão de ação rápida `+ Criar`, que define a marca ativa e abre o modal de criação já contextualizado.

### 10.2 Seção 2: Projetos Não Vinculados (Conversas Independentes)
- **Gestão Desacoplada**: Projetos e catálogos iniciados sem vínculo a uma marca específica são armazenados em `unlinkedCatalogs` no Zustand (`katana_studio_unlinked_catalogs`), evitando contaminação indesejada nos kits de marca.
- **Cabeçalho com Criação Instantânea**: Rótulo `PROJETOS {count}` com botão de adição `Plus` (`Novo Catálogo / Conversa`).
- **Lista Plana com Marcadores de Status**: Exibição limpa dos projetos recentes com tempo decorrido (`60m`) ou ponto indicador de atividade (`bg-sky-500`), com fallback de *"Nenhum projeto avulso"* quando vazia.
- **Sincronização com o Backend**: Em `syncUserCatalogs`, qualquer catálogo retornado pelo PostgreSQL sem `brand_id` é direcionado de forma inteligente para a lista de projetos não vinculados.

### 10.3 Seção 3: Templates de Demonstração
- **Acesso Permanente Inferior**: Separador sutil com ícone `BookOpen`, contador canônico `4` e chevron de colapso.
- **Catálogos Canônicos Multissetoriais**: Carregamento instantâneo de `Maison Verdana`, `VEKTRON Systems`, `Atelier Sucré` e `Cristallo Joias`.

---

## 11. Seletor de Marca & Criação de Projetos Avulsos / Não Vinculados

O modal de novo catálogo (`NewCatalogModal.tsx`) e o cabeçalho de briefing da home (`StudioHomeChat.tsx`) integram o componente unificado **`BrandSelectorPill.tsx`**:

### 11.1 Desvinculação Rápida com Botão X (Hover Trigger)
- Ao repousar o cursor do mouse sobre a pílula da marca ativa (`group-hover/brand-pill:opacity-100`), surge um botão sutil com ícone `X`.
- Ao clicar no `X`, o sistema desvincula imediatamente a marca ativa (`setActiveBrandId(null)`), fechando o menu caso esteja aberto e emitindo notificação toast informativa.
- A pílula transiciona suavemente para o estado neutro: **`Sem Marca (Avulso)`** com indicador circular cinza (`bg-zinc-500`).

### 11.2 Seletor em Dropdown com Seta para Baixo (`ChevronDown`)
- Ao lado do nome da marca, uma seta para baixo rotaciona suavemente (180°) ao ser clicada, abrindo o menu suspenso suspenso com efeito *glassmorphism* (`backdrop-blur-md`):
  - **Opção Direta de Projeto Avulso**: *"Sem marca (Projeto Avulso)"* com ícone de marcação `Check` ativo caso nenhuma marca esteja vinculada.
  - **Lista de Marcas Cadastradas**: Exibe todas as marcas de `brands` no Zustand com ponto indicador, nome e segmento de mercado.
  - **Atalho de Criação**: Botão `+ Nova Marca` para abrir instantaneamente o modal de Brand Kit.
  - **Suporte a Acessibilidade**: Fechamento automático ao clicar fora (`handleClickOutside`) ou ao pressionar a tecla `Escape`.

### 11.3 Persistência Garantida de Projetos Avulsos
- Tanto na criação de catálogos em branco (`createBlankCatalog`) quanto na síntese generativa via IA (`finishCatalogGeneration`):
  - Quando `activeBrandId` for `null`, o novo catálogo é automaticamente registrado em `unlinkedCatalogs` no Zustand e salvo no `localStorage` (`katana_studio_unlinked_catalogs`).
  - Ele passa a figurar diretamente na seção **"PROJETOS"** da barra lateral, sem poluir nem se misturar com os kits de marcas estabelecidas.

---

## 12. Gaveta de Produtos Unificada (Opção 1) & Co-Pilot Editorial

A Gaveta de Produtos (`ProductDrawer.tsx`) reúne o inventário completo do usuário em uma experiência integrada e minimalista:

### 12.1 Origem Híbrida e Unificada
- Reúne produtos importados por planilhas (CSV/Excel) e itens cadastrados no acervo da marca/sistema.
- Identificação precisa de proveniência através da função canônica `isSheetProduct(prod)`.

### 12.2 Navegação por Abas de Origem e Estado
- **Todos**: Mostra o acervo unificado do projeto.
- **Planilha**: Filtra os itens ingeridos via arquivo de planilha (`FileSpreadsheet`).
- **Cadastrados**: Filtra os itens adicionados no acervo permanente (`Package`).
- **Pendentes**: Filtra os produtos ainda não alocados a nenhuma lâmina.
- **Alocados**: Filtra os produtos presentes no catálogo, com jump direto para a lâmina correspondente.
- Filtro complementar por categoria com dropdown dinâmico.

### 12.3 Badges Visuais e Ações Rápidas nos Cards
- **Selo de Origem**: `Planilha` (verde/esmeralda) vs. `Acervo` (zinco neutro).
- **Selo de Alocação**: `Pág. XX` (com link de salto) ou `Pendente` (âmbar).
- **Ações no Toolbar**:
  - Edição inline instantânea de nome e preço (`Edit3`).
  - Geração generativa de fotos de estúdio com IA (`Sparkles`).
  - Envio direto para o Co-Pilot (`MessageSquare`): preenche o prompt com dados do produto e foca o agente.
  - Alocação direta em slots da lâmina ativa (`activeTargetSlot`) ou modal de alocação de página.
