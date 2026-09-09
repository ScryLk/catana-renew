# Restaurar Paleta Padrao Catana no Modal de Configuracoes

Written against: 343790e

## Evidence chain

- Surface: `frontend/src/components/studio/AccountSettingsModal.tsx`
- Problem: Uso de classes roxas (`bg-purple-600`, `text-purple-400`, `border-purple-500/20`, `from-purple-500 to-indigo-500`) em abas, avatares, botoes e barras de progresso, desalinhadas com o sistema de design editorial monocromatico do Catana 2.0.
- Design evidence: `frontend/src/index.css` (tokens `--primary: 0 0% 18%`), `frontend/src/components/studio/StudioSidebar.tsx` (tokens de abas, badges e barras em tons zinc), `frontend/src/components/studio/StudioHomeChat.tsx` (botoes de alta taxa de contraste `bg-zinc-100` / `bg-zinc-900`).
- Owner: `frontend/src/components/studio/AccountSettingsModal.tsx`
- Scope and affected surfaces: `AccountSettingsModal.tsx` e qualquer visualizador de configuracoes de conta.
- Uncertainty: none.

## Design decision

Substituir todos os acentos purpura/roxo herdados da identidade visual do Google Gemini pela paleta padrao monocromatica de alta costura editorial do Catana 2.0 (tons de cinza e preto neutros zinc-900 / zinc-800 / zinc-100 / zinc-950), restabelecendo a consistencia com o StudioSidebar e StudioHomeChat.

## Reuse

- Tokens de abas ativas: `isDark ? 'bg-zinc-800 text-white border border-zinc-700/80 shadow-xs' : 'bg-zinc-900 text-white shadow-xs'`
- Tokens de botao primario: `isDark ? 'bg-zinc-100 hover:bg-white text-zinc-950 font-medium' : 'bg-zinc-900 hover:bg-zinc-800 text-white font-medium'`
- Tokens de barra de progresso: `isDark ? 'bg-zinc-200' : 'bg-zinc-800'`
- Tokens de badge do plano: `isDark ? 'bg-zinc-800/80 border-zinc-700 text-zinc-300 font-mono' : 'bg-zinc-200/80 border-zinc-300 text-zinc-700 font-mono'`
- Tokens de avatar fallback e borda: `border-zinc-700/80` e `bg-zinc-800 text-zinc-200`
- Exemplar: `frontend/src/components/studio/StudioSidebar.tsx` (linhas 375-398 e 450-465) e `frontend/src/components/studio/StudioHomeChat.tsx` (linhas 305-310).

## Changes

1. `frontend/src/components/studio/AccountSettingsModal.tsx`
   - Change: Substituir `bg-purple-600` das abas por `isDark ? 'bg-zinc-800 text-white border border-zinc-700/80' : 'bg-zinc-900 text-white'`.
   - Change: Substituir borda e fundo do avatar de `border-purple-500/30` e `bg-purple-600` para `border-zinc-700/80` e `bg-zinc-800 text-zinc-200`.
   - Change: Substituir os botoes primarios de `bg-purple-600 hover:bg-purple-700 text-white` para `isDark ? 'bg-zinc-100 hover:bg-white text-zinc-950' : 'bg-zinc-900 hover:bg-zinc-800 text-white'`.
   - Change: Substituir o badge do plano de `bg-purple-500/10 border-purple-500/20 text-purple-400` para `isDark ? 'bg-zinc-800/80 border-zinc-700 text-zinc-300' : 'bg-zinc-200/80 border-zinc-300 text-zinc-700'`.
   - Change: Substituir o preenchimento da barra de progresso de `from-purple-500 to-indigo-500` para `isDark ? 'bg-zinc-200' : 'bg-zinc-800'`.
   - Preserve: Comportamento de abertura modal, validacoes de senha, upload de foto e consulta a API de cotas.
   - Verify: Modal com aparencia 100% alinhada a linguagem visual do Catana 2.0, sem qualquer presenca de tons purpura.

## Scope

- Inherit: `AccountSettingsModal.tsx`
- Verify: `StudioSidebar.tsx`, `KatanaStudio.tsx`, `Profile.tsx`
- Exclude: Componentes de catalogo ou temas externos de terceiros.

## Validation

- Product: Abrir o modal de configuracoes no Studio e verificar a harmonia visual com o restante da interface.
- Interface: Testar o modal em ambos os temas (escuro e claro) confirmando que botoes, abas e barras usam os tons zinc padrao do Catana.
- System: Confirmar ausencia de classes `purple-*` e preservacao de zero emojis.
- Repository: `npm run build` -> `vite built in ...` com 0 erros de tipo e bundle.

## Stop conditions

- Stop if a chave de tema ou tokens de cor quebrarem o contraste de leitura WCAG AA.

## Design documentation

- After acceptance and validation: Registrar em DESIGN.md que botoes primarios e abas do Studio utilizam o padrao monocromatico de alto contraste (zinc-100 / zinc-900).
