# Minimalismo e Alinhamento Visual do Modal de Marca (BrandModal) ao Sistema Catana 2.0

Written against: 2168ce3

## Evidence chain

- Surface: `frontend/src/components/studio/BrandModal.tsx`
- Problem:
  1. O cabeçalho utiliza um container de ícone com cor de destaque dourada contrastante (`bg-zinc-800 border-zinc-700 text-[#D4AF37]`), desviando do padrão monocromático e discreto dos modais mestres do sistema (`ExportCatalogModal`, `PaletteManagerModal`).
  2. O seletor de "Segmento de Atuação" exibe uma nuvem de 7 botões pill com quebra de linha dupla, consumindo espaço vertical excessivo e gerando poluição visual.
  3. A área de logotipo é excessivamente densa, combinando caixa tracejada vertical com múltiplos botões de ação e texto redundante.
  4. Os cards de paleta ocupam altura vertical elevada com rótulos repetitivos de taxa de contraste sob WCAG.
  5. As cores de fundo e borda não utilizam com rigor a casca canônica do estúdio (`bg-[#101013]`, `border-zinc-800`, `shadow-[0_30px_70px_rgba(0,0,0,0.95)]`).
- Design evidence:
  - `frontend/src/components/studio/ExportCatalogModal.tsx` (linhas 270-320: casca `#101013`, ícones monocromáticos com container `bg-zinc-900 border-zinc-800 text-zinc-300`, tipografia `text-sm font-semibold`).
  - `frontend/src/components/studio/PaletteManagerModal.tsx` (linhas 86-105: backdrop `bg-black/75 backdrop-blur-xs`, elevação `shadow-[0_30px_70px_rgba(0,0,0,0.95)]`).
  - `frontend/src/components/studio/NewCatalogModal.tsx` (card minimalista com inputs limpos e botões em pílula monocromática `bg-zinc-100 text-zinc-950`).
- Owner: `frontend/src/components/studio/BrandModal.tsx`
- Scope and affected surfaces: `frontend/src/components/studio/BrandModal.tsx`
- Uncertainty: none.

## Design decision

1. Alinhar a casca e elevação externa aos tokens canônicos: `bg-[#101013]` (dark) / `bg-white` (light), com `border-zinc-800`, backdrop `bg-black/75 backdrop-blur-xs` e sombra `shadow-[0_30px_70px_rgba(0,0,0,0.95)]`.
2. Tornar o cabeçalho neutro e sóbrio: container monocromático `bg-zinc-900 border-zinc-800 text-zinc-300` com ícone `Building2` proporcional.
3. Unificar "Nome da Marca" e "Segmento de Atuação" em uma grade de duas colunas, utilizando um `<select>` nativo e refinado para o segmento, eliminando a nuvem vertical de 7 pills.
4. Simplificar o upload de logotipo em uma linha horizontal fluida com miniatura de 40px, rótulo descritivo e botão de ação compacto.
5. Compactar os seletores de paleta cromática em cartões de altura reduzida, preservando as amostras de cores e nome.
6. Ajustar o rodapé com o botão primário monocromático do sistema (`bg-zinc-100 hover:bg-white text-zinc-950` no dark mode).

## Reuse

- Casca e sombra: `bg-[#101013] border-zinc-800 shadow-[0_30px_70px_rgba(0,0,0,0.95)]` (`PaletteManagerModal.tsx:93-96`).
- Container de ícone no cabeçalho: `p-2 rounded-xl border bg-zinc-900 border-zinc-800 text-zinc-300` (`ExportCatalogModal.tsx:282-289`).
- Botão de fechar (X): `p-1.5 rounded-lg border bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white` (`ExportCatalogModal.tsx:313-320`).
- Botão de ação primário: `bg-zinc-100 hover:bg-white text-zinc-950 font-semibold px-4 py-2 rounded-xl text-xs shadow-sm` (`NewCatalogModal.tsx:286-289`).

## Changes

1. `frontend/src/components/studio/BrandModal.tsx`
   - Change: Atualizar casca externa para `bg-[#101013] border-zinc-800 shadow-[0_30px_70px_rgba(0,0,0,0.95)]` e backdrop para `bg-black/75 backdrop-blur-xs`.
   - Change: Substituir o ícone amarelo do cabeçalho por container monocromático sóbrio `bg-zinc-900 border-zinc-800 text-zinc-300`.
   - Change: Agrupar "Nome da Marca" e "Segmento" em grade de 2 colunas com `<select>` estilizado, eliminando a lista de pills.
   - Change: Redesenhar a linha de logotipo para padrão horizontal compacto com preview de 40x40px.
   - Change: Compactar o grid de paletas cromáticas com amostras de cor limpas.
   - Change: Alinhar o botão de submissão ao estilo do sistema (`bg-zinc-100 text-zinc-950` no tema escuro).
   - Preserve: Todas as funções de edição, exclusão, persistência e contatos comerciais.
   - Verify: O modal fica sensivelmente mais compacto, elegante, visualmente equilibrado e estritamente aderente ao sistema de design Catana 2.0.

## Scope

- Inherit: `BrandModal.tsx`
- Verify: `StudioSidebar.tsx` (abertura e edição das marcas)
- Exclude: Lógica do store e outros modais já alinhados.

## Validation

- Product: Abrir a edição de uma marca existente (ex: Cristallo) e cadastrar uma nova marca, verificando legibilidade e compactação visual.
- Interface: Testar no modo Dark e Light, certificando-se de que não há sobreposição, quebra de layout ou cores fora do sistema de tokens.
- System: Zero emojis e conformidade com WCAG AA.
- Repository: `npm run build` retornando código 0.

## Stop conditions

- Stop if a compactação comprometer o upload de arquivos de imagem ou truncar dados comerciais.
