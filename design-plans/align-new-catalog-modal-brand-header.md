# Alinhar Identidade Visual do Modal de Novo Catálogo com Logo Catana 2.0

Written against: 04ed6d4

## Evidence chain

- Surface: `frontend/src/components/studio/NewCatalogModal.tsx`
- Problem:
  1. O botão de fechar no canto superior exibe o texto textual `Esc` junto ao `X` (`[X Esc]`), causando poluição visual e quebrando a linguagem minimalista do estúdio.
  2. Ausência da marca Catana no topo do modal de criação, deixando o card flutuando no vazio sem a identidade institucional acolhedora presente na home (`StudioHomeChat.tsx`).
- Design evidence:
  - `frontend/src/components/studio/StudioHomeChat.tsx` (linhas 159-184: logotipo vetorial de assinatura manuscrita com strokeWidth="8", drop-shadow sutil e badge "2.0" font-mono).
  - `frontend/src/components/studio/StudioSidebar.tsx` (linhas 170-193: renderização compacta da marca).
  - `frontend/src/components/studio/StudioExcelImportModal.tsx` e `ImportCatalogModal.tsx` (botão de fechar contendo estritamente o glifo `X` com hover em escala de cinza/zinc).
- Owner: `frontend/src/components/studio/NewCatalogModal.tsx`
- Scope and affected surfaces: `frontend/src/components/studio/NewCatalogModal.tsx`
- Uncertainty: none.

## Design decision

1. Remover o rótulo textual `Esc` do botão de fechar, mantendo exclusivamente o ícone `X` com padding equilibrado, cantos arredondados e transição suave de hover.
2. Inserir a marca oficial Catana 2.0 (vetor SVG manuscrito contínuo acompanhado do badge `2.0`) centralizada logo acima do card de criação.
3. Preservar o atalho de teclado `Escape` e o clique no backdrop para dispensar o modal.

## Reuse

- Logotipo Catana: Vetor SVG com caminhos cúbicos de caligrafia editorial e badge monocromático `2.0` (`StudioHomeChat.tsx:159-184`).
- Botão de fechar (X): `isDark ? 'bg-zinc-900/80 hover:bg-zinc-800 border-zinc-800 text-zinc-400 hover:text-white' : 'bg-white/80 hover:bg-zinc-100 border-zinc-200 text-zinc-600 hover:text-zinc-950'`.
- Paleta Zinc institucional: `#121215` para o card no dark mode, borda `border-zinc-800`, texto `text-zinc-100`.

## Changes

1. `frontend/src/components/studio/NewCatalogModal.tsx`
   - Change: Remover o elemento `<span>Esc</span>` e simplificar o botão de fechar para renderizar unicamente `<X className="size-4" />`.
   - Change: Adicionar o cabeçalho institucional com o logotipo vetorial Catana e badge `2.0` centralizado sobre o card.
   - Preserve: Card de criação contendo o textarea com o placeholder solicitado, botões de anexo de arquivos, importação de catálogo e importação de planilha, e botão "Gerar Catálogo →".
   - Verify: Modal exibe a marca elegante no topo, botão de fechar limpo sem texto, fechamento suave via Esc/clique fora e compilação sem erros.

## Scope

- Inherit: `NewCatalogModal.tsx`
- Verify: `KatanaStudio.tsx` e `StudioSidebar.tsx` (acionamento do modal)
- Exclude: Fluxos de geração de catálogo de backend e modais de importação de terceiros.

## Validation

- Product: Abrir o modal "+ Novo Catálogo · IA" a partir da barra lateral ou atalho flutuante, verificar presença do logo Catana 2.0 e botão X limpo.
- Interface: Testar em modo claro e escuro, conferindo proporção e contraste do logo e do botão X.
- System: Zero emojis, aderência aos tokens de design do Catana Studio.
- Repository: `npm run build` executando com código 0.

## Stop conditions

- Stop if a inclusão do logotipo causar estouro de viewport em telas mobile ou sobrepor o botão de fechar.

## Design documentation

- After acceptance and validation: Registrar em DESIGN.md a padronização dos modais rápidos com logotipo centralizado e botão de fechar icônico.
