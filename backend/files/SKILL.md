---
name: catana-catalogo-tematico
description: >-
  Gera um catálogo de produtos completo e já estilizado dentro do Catana, a partir de um
  arquivo de produtos (CSV/JSON/planilha), com tema visual coerente com o ramo (confeitaria,
  mercado, açougue, restaurante, festas, boutique, atacado, etc.). Produz um script de seed
  Django que escreve nas tabelas Catalog/Theme/Page/PageComponent/Component — o caminho que
  de fato persiste no Catana, já que o editor não tem save relacional. Monta a estrutura
  macro (capa, sumário, sobre a empresa, divisores, produtos, tabela de preços, como comprar,
  contracapa), perguntando se o usuário quer estrutura Completa, Essencial ou Personalizada.
  Use SEMPRE que pedirem para criar/gerar um catálogo no Catana, fazer um catálogo temático,
  popular o banco com um catálogo, ou transformar uma lista de produtos em catálogo — mesmo
  sem dizer "seed" ou "tema". Específica do repositório Catana (catana-back + catana-front).
---

# Gerador de Catálogo Temático para o Catana

Esta skill cria um catálogo de produtos **demonstrativo** (não interativo), já
visualmente temático, **dentro do Catana**, a partir de uma lista de produtos.

A entrega é um **script de seed Django** que grava o catálogo nas tabelas do banco.
Depois de rodado, o catálogo aparece no Catana e abre no editor normalmente (o
`catalogLoader.service.ts` reconstrói tudo a partir das tabelas).

## Por que seed script, e não "salvar pelo editor" (contexto crítico do Catana)

Leia isto antes de qualquer coisa — é a razão de toda a abordagem:

- O **round-trip do editor está quebrado**: `catalogService.ts` só faz POST/PATCH de
  **metadados** (`title`, `description`, `is_public`). **Não existe** endpoint que grave
  `Page`/`PageComponent`/`Component` a partir do conteúdo do editor.
- Mas o **carregamento funciona**: `catalogLoader.service.ts` reconstrói
  `Page → PageComponent → Component.content` em elementos do editor, e lê
  `Theme.styles.designTokens`.
- Logo, um catálogo só "existe" no Catana se as tabelas foram **populadas por fora**
  (seed/script) — é assim que `seed_database.py` e similares já funcionam.

Por isso esta skill **gera os dados relacionais direto** — ela é, em essência, um gerador
de seed no mesmo padrão dos scripts que o projeto já usa. Não tente criar um fluxo de
"salvar pelo editor": ele não existe.

## Princípio nº1: INSPECIONE o schema real antes de gerar

O formato exato de `Component.content`, o conjunto de `ElementType`, e como o loader mapeia
geometria/estilo **são a fonte da verdade no código** e podem ter mudado desde que esta
skill foi escrita. **Nunca** gere o script a partir de um formato presumido. Sempre:

1. Leia `catana-back/api/models.py` → confirme os campos e nomes de FK de
   `Catalog`, `Theme`, `Page`, `PageComponent`, `Component` (em especial: qual FK liga
   `PageComponent` a `Page` e a `Component`, e os valores válidos de `component_type`).
2. Leia `catana-front/src/types/editor.ts` → veja o tipo `CatalogElement`, os campos
   (`position`, `size`, `style`, `textData`/`productData`/`imageData`) e o enum `ElementType`.
3. Leia `catana-front/src/services/catalogLoader.service.ts` → veja **exatamente** como ele
   lê `PageComponent` (geometria) e `Component.content` para montar cada elemento. O
   `content` deve ter a forma que o loader espera. Esta é a peça mais importante.
4. **Pegue uma amostra real**: encontre um `Component.content` já existente no banco
   (de um catálogo semeado por `seed_database.py`, ou via `python manage.py shell`) e use-o
   como molde do formato. Um exemplo real vale mais que qualquer documentação.

Detalhes do modelo de dados e da forma de `content` em
`references/dados-catana.md` — leia esse arquivo, mas trate-o como mapa, não como verdade
final; o código vence.

## Fluxo de trabalho

### 1. Reunir entradas
Confirme com o usuário (ou infira do que ele já deu):
- **Arquivo de produtos** (CSV/JSON/planilha). Identifique as colunas: nome, preço,
  descrição, imagem/URL, categoria, e o que mais houver (SKU, unidade…).
- **Ramo do negócio** → define o tema. Se o usuário não disser, **infira** pelo nome do
  catálogo/produtos (ex.: "bolo", "brigadeiro", "encomenda" → confeitaria; "kg",
  "hortifruti", "promoção" → mercado). Em caso de dúvida, **pergunte** — não chute o visual.
- **Organização / Sede** alvo (FKs obrigatórias na maioria das entidades). Descubra
  qual `organization`/`sede` usar (pergunte, ou use a do primeiro superuser como os
  fallbacks de dev fazem — confira em `views.py`).
- **Título** do catálogo.
- **Estrutura macro** — **SEMPRE pergunte** qual o usuário quer (ver
  `references/estrutura-catalogo.md`, seção A):
  - **Completa** — todas as seções aplicáveis (institucional + comercial + navegação).
  - **Essencial** — só o núcleo (capa, produtos, contracapa; + tabela de preços e
    "como comprar" se for B2B/atacado; + sumário se passar de ~8 páginas).
  - **Personalizada** — mostre a lista de seções e deixe o usuário marcar (force capa +
    contracapa no mínimo; avise se ele tirar `produtos`).
  Se o usuário não tiver dados para uma seção institucional (ex.: sem "sobre a empresa"
  cadastrado), pule-a mesmo no modo Completa — não invente conteúdo institucional.

### 2. Inspecionar o schema real
Execute o Princípio nº1 acima. Não pule.

### 3. Escolher / gerar o tema
Abra `references/temas.md`. Se o ramo casar com um preset, use-o. Se não, use a **receita
de geração** desse mesmo arquivo para montar uma paleta + tipografia + estilo de card
coerentes com o ramo. O tema é só um conjunto de valores concretos (cores hex, nomes de
fonte, raio de borda, sombra).

### 4. Montar as seções escolhidas (demonstrativo)
Monte **as seções selecionadas no passo 1**, na ordem da tabela em
`references/estrutura-catalogo.md` (capa → … → contracapa). Cada seção é uma ou mais
páginas de elementos posicionados. Consulte essa referência para o que cada seção contém e
os campos que precisa. Pontos-chave:

- **Capa** (sempre): título, período/edição **visível**, fundo/cor do tema, logo se houver,
  motivo decorativo do ramo (ver `references/temas.md`), QR opcional.
- **Produtos** (núcleo): cards com foto + nome + preço (+ SKU, especificações escaneáveis,
  unidade de venda/MOQ quando B2B). Dois layouts possíveis — **densidade** (10–20+/página,
  default p/ distribuidor) ou **detalhe** (1–4/página, premium/lançamento). Escolha pela
  densidade do tema e do portfólio, e comente a decisão. Agrupe variações numa tabela, não
  como produtos separados.
- **Divisores** de categoria (se selecionado): uma página de abertura por categoria, antes
  dos produtos dela.
- **Sumário, sobre a empresa, tabela de preços, como comprar, termos, contracapa**: monte
  conforme os campos da referência. Seções "interativas" (índice, botão WhatsApp, formulário)
  entram como **blocos visuais desenhados**, não funcionais; QR Code é imagem real.
- **Posicionamento:** geometria explícita (`position_x/y`, `width`, `height`, `layer`) numa
  grade calculada, sem sobreposição; respeite a dimensão padrão de página do editor
  (descubra em `editor.ts`/`editorStore.ts`).
- Pule seções sem dado (não invente institucional/preço que o usuário não forneceu).

### 5. Assar o tema em CADA elemento (passo que faz o visual aparecer)
**Crítico, leia `references/aparencia.md`.** Resumo: a camada que **de fato renderiza** é o
`style`/`textData` **por elemento**. Os `designTokens` globais existem mas não estão ligados
à renderização (templates de plugin hardcoded ignoram tokens). Portanto:
- Grave **valores concretos** (hex, nome de fonte, px) dentro do `content` de cada
  `Component`. **Não** use referências `$tokens.*` no conteúdo — elas podem não resolver na
  renderização e o catálogo sairia sem tema.
- **Também** preencha `Theme.styles.designTokens` com a mesma paleta/tipografia, por
  consistência e para já deixar pronto quando o token global for ligado à UI. Mas o que
  garante o visual é o valor concreto por elemento.

### 6. Gerar o script de seed
Use `scripts/template_seed.py` como **esqueleto**, adaptando-o ao schema real que você
inspecionou no passo 2. O script deve:
- Ser idempotente quando fizer sentido (ex.: aceitar `--limpar` para apagar um catálogo
  homônimo antes de recriar), e transacional (`@transaction.atomic`).
- Ler o arquivo de produtos, criar `Theme` → `Catalog` → as `Page`(s) **das seções
  selecionadas** (cada seção vira uma ou mais páginas) → para cada elemento um `Component`
  (com `content` temático) + um `PageComponent` (geometria).
- Aceitar a estrutura escolhida (ex.: `--estrutura completa|essencial` ou
  `--secoes capa,produtos,contracapa`), e montar só as seções pedidas.
- Imprimir um resumo no final (id do catálogo, nº de páginas/produtos) e a URL para abrir.
- Seguir o estilo dos scripts existentes do `catana-back` (mesma forma de subir o Django:
  `os.environ['DJANGO_SETTINGS_MODULE']`, `django.setup()`).

Prefira entregar como **script avulso por catálogo** (`gerar_catalogo_<slug>.py` na raiz do
`catana-back`, rodado com `python gerar_catalogo_<slug>.py`). Só promova a um management
command parametrizável fixo (`python manage.py gerar_catalogo --arquivo ... --tema ...`)
quando o formato estabilizar e o usuário pedir.

### 7. Rodar e validar
- Rode o script (no Docker: `docker-compose exec web python gerar_catalogo_<slug>.py`).
- Confirme no banco/admin que `Catalog`, `Page`, `Component`, `PageComponent` foram criados.
- Abra o catálogo no front e verifique que ele **carrega e aparece temático**. Se sair sem
  estilo, o problema quase sempre é o formato de `content` divergindo do que o loader espera
  (volte ao passo 2) ou o tema não ter sido assado por elemento (passo 5).

## Armadilhas específicas do Catana

- **Migrações:** se você precisar tocar em models (não deveria, para esta skill), rode
  `makemigrations && migrate`. Esta skill **não** altera o schema — só insere dados.
- **`component_type` é restrito** (`text|image|product` no banco), mesmo o editor tendo ~40
  `ElementType`. A riqueza visual vai no `content`, não em novos tipos de coluna.
- **FKs obrigatórias** (`organization`, às vezes `sede`, `created_by`): resolva-as antes de
  inserir, ou o seed quebra. Veja como os fallbacks de dev em `views.py` resolvem isso.
- **Geometria em dois lugares:** o `content` pode conter `position/size` E o `PageComponent`
  também (`position_x/y/width/height`). Veja no loader qual delas vale na renderização e
  mantenha as duas coerentes para não dar conflito.
- **Não confie em segredos/permissões:** o backend roda com auth afrouxada em dev; isso não
  afeta o seed, mas não assuma que o ambiente é seguro.

## Referências
- `references/estrutura-catalogo.md` — seções do catálogo, campos por seção e a seleção
  Completa/Essencial/Personalizada. **Leia para o passo 1 e o passo 4.**
- `references/dados-catana.md` — modelo de dados e forma de `Component.content` (mapa).
- `references/temas.md` — biblioteca de presets de tema + receita de geração.
- `references/aparencia.md` — por que e como assar o tema por elemento.
- `scripts/template_seed.py` — esqueleto do script de seed para adaptar.
