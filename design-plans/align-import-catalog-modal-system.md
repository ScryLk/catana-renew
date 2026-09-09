# Alinhar Modal de Importacao ao Sistema de Design do Catana Studio

Written against: 6e65e6b

## Evidence chain

- Surface: `frontend/src/components/studio/ImportCatalogModal.tsx`
- Problem:
  1. Desalinhamento da casca do modal, elevacao de sombra e backdrop (`bg-[#121215]`, `shadow-2xl` generico e `backdrop-blur-sm`) em comparacao aos modais institucionais do Studio (`PaletteManagerModal` e `EditorialCouncilModal` que usam `bg-[#101013]`, `shadow-[0_30px_70px_rgba(0,0,0,0.95)]` e `backdrop-blur-xs`).
  2. Ausencia do atalho de teclado `Escape` para fechar o modal, contrariando o padrao presente nos modais irmaos.
  3. Contraste incorreto no hover do botao de fechar (X) no modo claro (`hover:bg-zinc-800/60` fixo) e ausencia de indicador visual explicito de selecao ativa (`Check` / ring) nos cartoes de paleta editorial e modos de reconstrucao.
- Design evidence:
  - `frontend/src/components/studio/PaletteManagerModal.tsx` (linhas 29-37, 86-95, 98-101, 150-180)
  - `frontend/src/components/studio/EditorialCouncilModal.tsx` (linhas 83-96)
  - `frontend/src/index.css` (tokens de tema dark do Catana 2.0)
- Owner: `frontend/src/components/studio/ImportCatalogModal.tsx`
- Scope and affected surfaces: `frontend/src/components/studio/ImportCatalogModal.tsx`
- Uncertainty: none.

## Design decision

Harmonizar a apresentacao do `ImportCatalogModal.tsx` com a gramatica visual dominante dos modais do Studio:
1. Adotar a casca nobre `#101013` com elevacao profunda `shadow-[0_30px_70px_rgba(0,0,0,0.95)]` e backdrop `bg-black/75 backdrop-blur-xs`.
2. Adotar a faixa de cabecalho `#151518` (dark) / `bg-zinc-50` (light) com borda `border-zinc-800` / `border-zinc-200`.
3. Implementar o ciclo de vida de fechamento por teclado (`Escape`) enquanto o modal estiver aberto e nao estiver em processamento.
4. Ajustar os estados de hover do botao de fechar para alternancia coerente entre temas claro e escuro.
5. Adicionar indicadores visuais de selecao ativa (icone `Check` e anel de contorno sutil) nos seletores de paleta e modos de reconstrucao.

## Reuse

- Casca do modal: `isDark ? 'bg-[#101013] border-zinc-800 text-zinc-100 shadow-[0_30px_70px_rgba(0,0,0,0.95)]' : 'bg-white border-zinc-200 text-zinc-900 shadow-[0_20px_50px_rgba(0,0,0,0.15)]'`
- Backdrop: `bg-black/75 backdrop-blur-xs`
- Cabecalho: `isDark ? 'border-zinc-800 bg-[#151518]' : 'border-zinc-200 bg-zinc-50'`
- Botao de fechar (X): `isDark ? 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60' : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100'`
- Listener ESC: `useEffect` com listener no `window` para `e.key === 'Escape'`
- Exemplares: `frontend/src/components/studio/PaletteManagerModal.tsx` (linhas 29-37 e 86-101) e `frontend/src/components/studio/EditorialCouncilModal.tsx` (linhas 83-96)

## Changes

1. `frontend/src/components/studio/ImportCatalogModal.tsx`
   - Change: Atualizar a camada externa de backdrop para `bg-black/75 backdrop-blur-xs`.
   - Change: Atualizar a casca principal para `isDark ? 'bg-[#101013] border-zinc-800 text-zinc-100 shadow-[0_30px_70px_rgba(0,0,0,0.95)]' : 'bg-white border-zinc-200 text-zinc-900 shadow-[0_20px_50px_rgba(0,0,0,0.15)]'`.
   - Change: Alinhar a faixa de cabecalho para `isDark ? 'border-zinc-800 bg-[#151518]' : 'border-zinc-200 bg-zinc-50'`.
   - Change: Incluir listener `useEffect` para dispensar o modal ao pressionar a tecla `Escape` quando `isOpen && !isProcessing`.
   - Change: Ajustar o botao de fechar (X) com transicao e hover contextual ao tema ativo (`isDark ? 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60' : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100'`).
   - Change: Adicionar badge discreto com icone `Check` nos cards de paleta selecionada e destacar com anel `ring-1 ring-zinc-600` / borda correspondente.
   - Preserve: Todo o fluxo funcional de upload (PDF/Word), comunicacao com a API de engenharia reversa (`/api/v2/studio/catalogs/import-document/`), steps de progresso e persistencia no `studioStore`.
   - Verify: Modal aberto exibe harmonia visual imediata com `PaletteManagerModal` e `EditorialCouncilModal`, fecha suavemente com a tecla ESC e apresenta excelente contraste em ambos os temas.

## Scope

- Inherit: `ImportCatalogModal.tsx`
- Verify: `StudioHomeChat.tsx` (gatilho de abertura do modal)
- Exclude: Servicos de backend e outros modais estaveis do Studio.

## Validation

- Product: Disparar "Importar Catálogo" no Studio e validar integracao visual, comportamento de fechamento com a tecla ESC e contraste dos controles.
- Interface: Testar o modal em ambos os temas (Dark `#101013` e Light), verificando seletores de paleta, modo de reconstrucao e botao de fechar.
- System: Confirmar estrita adesao aos tokens de zinc, ausencia total de emojis e preservacao do layout responsivo.
- Repository: `npm run build` na pasta `frontend/` retornando codigo 0 sem erros de tipagem.

## Stop conditions

- Stop if o alinhamento visual interferir no envio do payload multipart/form-data ou quebrar o fluxo de processamento SSE.

## Design documentation

- After acceptance and validation: Registrar em DESIGN.md que os modais do Catana Studio seguem a casca `#101013` com sombra `shadow-[0_30px_70px_rgba(0,0,0,0.95)]` e suporte mandatorio a tecla `Escape`.
