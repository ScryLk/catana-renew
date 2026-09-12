# Minimalismo e Alinhamento Visual do Seletor de Área da Logo (LogoAreaSelectorModal) ao Sistema Catana 2.0

Written against: 018b897

## Evidence chain

- Surface: `frontend/src/components/studio/LogoAreaSelectorModal.tsx` e botão disparador em `frontend/src/components/studio/BrandModal.tsx`
- Problem:
  1. Uso excessivo de tons amarelos/âmbar (`amber-400`, `amber-500`, `amber-300`) no ícone do cabeçalho, botões da barra de ferramentas, moldura de corte, alças de redimensionamento e botão de ação primária (CTA).
  2. O visual destoa da linguagem editorial monocromática do Catana Studio 2.0, que prioriza escala de cinzas `zinc` (`#101013`, `zinc-900`, `zinc-800`, `zinc-300`, `zinc-100`, `white`).
  3. A moldura de recorte em amarelo espesso (`border-2 border-amber-400 bg-amber-400/10`) cria ruído visual que compete com as cores reais do logotipo durante a amostragem.
  4. O botão primário "Aplicar Paleta e Concluir" utiliza preenchimento laranja/âmbar saturado com sombra colorida (`bg-amber-500 shadow-amber-500/20`), em vez do padrão institucional em pílula monocromática (`bg-zinc-100 text-zinc-950`).
- Design evidence:
  - `frontend/src/components/studio/BrandModal.tsx` (linhas 300-308: container monocromático `p-2 rounded-xl border bg-zinc-900 border-zinc-800 text-zinc-300`).
  - `frontend/src/components/studio/PaletteManagerModal.tsx` (linhas 86-105: backdrop `bg-black/75`, elevação neutra `shadow-[0_30px_70px_rgba(0,0,0,0.95)]`).
  - `frontend/src/components/studio/ExportCatalogModal.tsx` (botão de confirmação monocromático `bg-zinc-100 hover:bg-white text-zinc-950 font-semibold px-4 py-1.5 rounded-xl text-xs`).
  - `design-plans/minimal-brand-modal-editorial-system.md` (diretriz de substituição de cores de destaque por escala sóbria `zinc`).
- Owner: `frontend/src/components/studio/LogoAreaSelectorModal.tsx`
- Scope and affected surfaces: `frontend/src/components/studio/LogoAreaSelectorModal.tsx` e `frontend/src/components/studio/BrandModal.tsx`
- Uncertainty: none.

## Design decision

1. **Substituição Total de Amarelo/Âmbar por Tons Neutros do Sistema**:
   - Cabeçalho: container de ícone sóbrio `bg-zinc-900 border-zinc-800 text-zinc-300`.
   - Barra de Ferramentas: botões monocromáticos `bg-zinc-900 border-zinc-800 text-zinc-300 hover:text-white`. Quando a pipeta estiver ativa, realce em `bg-zinc-800 border-zinc-600 text-white`.
   - Checkboxes: estilização neutra `accent-zinc-200 border-zinc-700`.
2. **Moldura de Corte Minimalista e Precisa (Estilo Figma / Apple)**:
   - Contorno fino de 1px com contraste duplo (`border border-white/90 shadow-[0_0_0_1px_rgba(0,0,0,0.7)]`), garantindo nitidez visual sobre qualquer cor de imagem sem adicionar matiz amarelo que interfira na percepção cromática do usuário.
   - Grade de terços delicada e translúcida (`border-white/20`).
   - 8 alças de redimensionamento em branco puro com borda de proteção escura e micro-canto arredondado (`size-2.5 bg-white border border-zinc-900/80 rounded-[2px] shadow-sm`).
3. **Seletores de Cor e Amostras**:
   - Destaque da aba ativa com borda e anel neutros (`border-zinc-300 ring-1 ring-zinc-400/30` no dark mode).
4. **Botão de Ação Primária**:
   - Transição do botão âmbar para o padrão institucional do Catana: `bg-zinc-100 hover:bg-white text-zinc-950 font-semibold px-4 py-2 rounded-xl text-xs shadow-sm`.
5. **Botão Disparador em BrandModal**:
   - Remover classes de texto âmbar do botão "Extrair Cores", adotando `border-zinc-800 text-zinc-300 hover:text-white`.

## Reuse

- Casca e backdrop: `bg-[#0f0f13] border-zinc-800 text-zinc-100` (`BrandModal.tsx:289`).
- Container de ícone no cabeçalho: `p-2 rounded-xl border bg-zinc-900 border-zinc-800 text-zinc-300` (`BrandModal.tsx:302`).
- Botão primário: `bg-zinc-100 hover:bg-white text-zinc-950 font-semibold px-4 py-2 rounded-xl text-xs` (`BrandModal.tsx:832`).
- Checkbox do estúdio: `accent-zinc-300 border-zinc-700` (`StudioSidebar.tsx`).

## Changes

1. `frontend/src/components/studio/LogoAreaSelectorModal.tsx`
   - Change: Substituir todas as classes `text-amber-*`, `bg-amber-*`, `border-amber-*` pela escala de cinzas do sistema (`zinc-900`, `zinc-800`, `zinc-700`, `zinc-400`, `zinc-300`, `zinc-100`, `white`).
   - Change: Redefinir a caixa de seleção com borda fina branca com sombra escura de 1px e alças brancas sutis.
   - Change: Atualizar o botão "Aplicar Paleta e Concluir" para `bg-zinc-100 text-zinc-950`.
   - Verify: O modal adota uma estética cirúrgica, refinada e 100% alinhada ao design system.

2. `frontend/src/components/studio/BrandModal.tsx`
   - Change: Atualizar botão "Extrair Cores" para remover o tom dourado/âmbar, alinhando com a paleta cinza neutra do estúdio.
   - Verify: Integração fluida entre o BrandModal e o LogoAreaSelectorModal.

## Validation

- Build de produção (`tsc -b && vite build`) retornando código 0.
- Auditoria estrita de 0 emojis.
- Concorrência visual neutra: a ferramenta não impõe cores próprias sobre o logotipo examinado.
