# Alinhar Gaveta de Produtos a Paleta Editorial Catana 2.0

Written against: 5388ec2

## Design language

- Audited surface: frontend/src/components/studio/ProductDrawer.tsx
- Design sources: frontend/src/index.css, design-plans/restore-catana-palette-settings-modal.md, frontend/src/components/studio/StudioHomeChat.tsx, frontend/src/components/studio/StudioSidebar.tsx.
- Documented decisions:
  - Fundo editorial marfim/papel quente: #F8F6F1 / #F5F1EA (Light) e #0D0D0D / #121214 (Dark).
  - Texto e off-black nobre: #1A1817 / #211E1C (Light) e #F4F4F5 / zinc-100 (Dark).
  - Acento Ouro Editorial: #B08D57 / 38 40% 50%.
  - Tons neutros / muted: #736E65 / zinc-500 e bordas #E4E0D6 / stone-200 / zinc-200.
  - Acoes primarias monocromaticas de alto contraste: bg-zinc-900 hover:bg-zinc-800 text-white (Light) e bg-zinc-100 hover:bg-white text-zinc-950 (Dark), ou ouro editorial #B08D57 para destaque de alocacao.
  - Zero emojis em todo o sistema.
- Governing owners and consumers: ProductDrawer.tsx, StudioTopBar.tsx, KatanaStudio.tsx.
- Explicit exceptions: None documented.

## Findings

| # | Problem | Evidence | Proposed change | Scope | Confidence |
|---|---|---|---|---|---|
| 1 | Proliferacao de tons ambar (amber-700, amber-600, amber-50, amber-200, amber-900) e verde esmeralda (emerald-50, emerald-700) estranhos a paleta do sistema | ProductDrawer.tsx:359, 461-464, 468, 481-482, 498-499, 521, 642, 746, 761, 838-839, 882, 966, 981-982 | Substituir ambar e esmeralda pelos tokens editoriais: marfim #F5F1EA, borda #E4E0D6, ouro #B08D57 e alto contraste zinc-900/zinc-100 | ProductDrawer.tsx | High |
| 2 | Duplicacao de glifo de adicao no botao de acao (+ + Alocar neste Slot) | ProductDrawer.tsx:842-844: <Plus className="size-3.5" /> <span>+ Alocar neste Slot</span> | Remover o caracter + textual e manter apenas o icone <Plus /> com rotulo limpo <span>Alocar neste Slot</span> | ProductDrawer.tsx | High |
| 3 | Banner de alocacao ativa e slots exibidos com estetica de alerta amarelo/laranja em vez de card editorial nobre | ProductDrawer.tsx:459-505 (bg-amber-50/90 border-amber-200/90 text-amber-900) | Reestilizar o banner com fundo marfim #F5F1EA, filete ouro editorial #B08D57, borda neutra e tipografia refinada | ProductDrawer.tsx | High |

## Improve first

Finding 1 e 2: Unificar a gaveta de produtos com a paleta editorial nobre do Catana 2.0 (marfim, ouro editorial, off-black) e corrigir o botao de alocacao para padrao de alta costura com um unico icone limpo.

## Reuse

- Acoes primarias: isDark ? 'bg-zinc-100 hover:bg-white text-zinc-950 font-semibold' : 'bg-zinc-900 hover:bg-zinc-800 text-white font-semibold'
- Badge de status neutro: isDark ? 'bg-zinc-800/70 text-zinc-400 border-zinc-700/80 font-mono' : 'bg-[#F5F1EA] text-[#736E65] border-[#E4E0D6] font-mono'
- Banners e cards ativos: borda esquerda destacada em Ouro Editorial (border-l-2 border-l-[#B08D57])
- Precos editoriais: isDark ? 'text-zinc-100 font-mono font-bold' : 'text-[#1A1817] font-mono font-bold'
