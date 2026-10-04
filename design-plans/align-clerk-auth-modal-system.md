# Alinhar Sistema Visual e Internacionalização do Modal de Autenticação Clerk

Written against: 7cf6d375a852f71ec8047dcd5bfebf6db5d6aeb9

## Evidence chain

- Surface: `frontend/src/components/auth/AuthModal.tsx` e `frontend/src/main.tsx` (fluxo de autenticação no desktop e mobile ao clicar em "Entrar" no estúdio).
- Problem:
  1. Contradição linguística: O cabeçalho institucional do modal está em português (*"Acessar o Katana Studio"*, *"Autenticação segura e criptografada."*), enquanto todos os rótulos, botões, campos, divisores e links injetados pelo Clerk estão em inglês (*"Continue with Google"*, *"or"*, *"Email address"*, *"Enter your email address"*, *"Continue ▶"*, *"Don't have an account? Sign up"*).
  2. Peso visual excessivo e glifo estranho no botão de ação: O botão primário renderiza como um retângulo branco sólido chapado (`#FFFFFF`) com texto preto e um ícone de reprodução de mídia (`▶`), criando um foco de luminância desproporcional que ofusca a hierarquia editorial do modal.
  3. Descompasso de proporção, bordas e ritmo vertical: O botão do Google possui fundo cinza escuro pesado, o campo de entrada tem preenchimento diferente e o divisor *"ou"* tem espaçamento vertical comprimido, quebrando a harmonia com o painel direito de orquestração de agentes.
- Design evidence:
  - Captura de tela renderizada fornecida pelo usuário (`media_1791148640408.png`).
  - `frontend/src/types/designTokens.ts` (paleta dark luxury editorial: background `#121214`, escala zinc, radius `rounded-xl` / 12px, acento dourado `#B08D57` / `#C5A880`).
  - `frontend/src/components/auth/AuthModal.tsx` (linhas 250-360: exemplar do formulário nativo do Catana com divisor `ou continue com` em mono `[10px] uppercase tracking-wider`, botão oficial Google e tipografia consistente).
- Owner: `frontend/src/components/auth/AuthModal.tsx`, `frontend/src/main.tsx`, `frontend/src/index.css`.
- Scope and affected surfaces: `frontend/src/components/auth/AuthModal.tsx`, `frontend/src/main.tsx`, `frontend/src/index.css`.
- Uncertainty: none.

## Design decision

1. Integrar a internacionalização nativa oficial `@clerk/localizations` (`ptBR`) no `<ClerkProvider>` em `main.tsx`, garantindo que 100% dos textos do formulário, mensagens de validação e links sejam renderizados em português idiomático alinhado ao produto.
2. Refatorar a estilização do botão de ação primário (`.cl-formButtonPrimary`):
   - Adotar estética editorial de luxo: botão em tom grafite escuro elevado (`bg-zinc-900 hover:bg-zinc-800/90`), borda sutil de precisão (`border border-zinc-700/60`), tipografia branca pura nítida (`text-zinc-100 font-medium text-xs tracking-wide`), e micro-interação de clique suave (`active:scale-[0.99]`).
   - Eliminar o glifo de seta de reprodução (`▶`) injetado via CSS/conteúdo.
3. Equalizar o ritmo vertical e a consistência visual dos campos:
   - Padronizar a altura do botão social do Google e do campo de e-mail em 44px (`h-11`).
   - Aplicar fundo transparente com preenchimento sutil `bg-zinc-900/60`, borda `border-zinc-800` e cantos arredondados de 12px (`rounded-xl`).
   - Expandir a margem vertical do divisor para 16px (`my-4`) com linha sutil `border-zinc-800` e texto em mono discreto `text-zinc-500 text-[10px] uppercase tracking-wider`.
   - Manter o selo *"Secured by clerk"* no rodapé, porém em tipografia atenuada e sem caixas cinzas delimitadoras.

## Reuse

- Paleta editorial institucional: `bg-[#121214]`, bordas `border-zinc-800`, textos secundários `text-zinc-400` / `text-zinc-500`.
- Raio de curvatura padrão: `rounded-xl` (12px).
- Altura ergonômica de toque/clique: `h-11` (44px, alinhado à escala touch target de acessibilidade).
- Exemplar do formulário nativo: `AuthModal.tsx:288-326` (estilo do divisor e botão Google adaptativo).

## Changes

1. `frontend/src/main.tsx`
   - Change: Importar `ptBR` de `@clerk/localizations` e passar a propriedade `localization={ptBR}` para o `<ClerkProvider>`.
   - Preserve: Configuração de persistência de chaves, `afterSignOutUrl="/"`, tema escuro `baseTheme: dark` e salvaguarda ativa do `MutationObserver`.
   - Verify: Textos de autenticação do Clerk passam a ser renderizados inteiramente em português do Brasil ("Continuar com Google", "ou", "Endereço de e-mail", "Continuar", "Não tem uma conta? Cadastre-se").

2. `frontend/src/index.css`
   - Change: Refatorar as regras de `.cl-formButtonPrimary` para remover o bloco branco chapado e o glifo `▶`, aplicando botão grafite premium (`bg-zinc-900`, `border border-zinc-700/60`, `text-zinc-100`, cantos de 12px).
   - Change: Estilizar `.cl-socialButtonsBlockButton` e `.cl-formFieldInput` com altura idêntica (`44px`), fundo `rgba(24, 24, 27, 0.6)` e foco suave `border-zinc-500`.
   - Change: Estilizar o divisor `.cl-dividerLine` e `.cl-dividerText` com tipografia mono sutil e respiro vertical equilibrado.
   - Preserve: Supressão ativa de badges e marcadores de desenvolvimento (`.clerk-internal-development-badge`, etc.).
   - Verify: Formulário Clerk com linguagem visual indistinguível de um componente nativo de luxo do Katana Studio.

3. `frontend/src/components/auth/AuthModal.tsx`
   - Change: Garantir que as propriedades `appearance.elements` de `<SignIn />` e `<SignUp />` mantenham o cabeçalho duplo ocultado (`header: 'hidden', headerTitle: 'hidden', headerSubtitle: 'hidden'`) e os containers transparentes.
   - Preserve: Logotipo oficial de caligrafia editorial `catana`, título *"Acessar o Katana Studio"*, e todo o painel direito com a orquestração interativa de agentes do Studio Engine.
   - Verify: Diálogo de login balanceado, sem ruído visual, totalmente em português e harmônico com o painel direito de agentes.

## Scope

- Inherit: `AuthModal.tsx` (modais de login e registro via Clerk).
- Verify: Telas de autenticação, redirecionamentos e visualização responsiva em mobile.
- Exclude: Lógica de cobrança, rotas de estúdio, geração generativa de catálogos e endpoints do backend.

## Validation

- Product: Abrir o modal de login em `https://usecatana.com.br` e verificar que todo o formulário está em português, com botão de alta elegância sem bloco branco chapado e sem setas estranhas.
- Interface: Testar responsividade em viewport desktop (1024px+) e mobile (375px), verificando contraste de cores (WCAG AA 4.5:1 para textos) e alinhamento dos campos.
- System: Zero dependências residuais de texto em inglês no fluxo de entrada.
- Repository: `npm --prefix frontend test` (64/64 aprovados) e `npm --prefix frontend run build` compilando sem advertências de tipagem.

## Stop conditions

- Stop if o pacote `@clerk/localizations` conflitar com a versão instalada do `@clerk/clerk-react` (`^5.61.9`). Nesse caso, utilizar o objeto customizado de dicionário de tradução suportado nativamente pelo `<ClerkProvider localization={{ ... }}>`.

## Design documentation

- After acceptance and validation: Registrar a padronização de internacionalização e estilização dos componentes externos do Clerk em `docs/DESIGN_SYSTEM.md`.
