# Aparência: assar o tema por elemento

Este é o passo que **faz o catálogo sair visualmente temático** em vez de cru. Leia antes
de montar o `content` dos componentes.

## O problema (por que não basta o tema global)

O Catana tem 3 camadas de aparência, **mal conectadas**:

1. **Por elemento — a que DE FATO renderiza.** Cada elemento tem `style` + `textData`
   (fontFamily, fontSize, color, background, borderRadius…). É o que aparece na tela.
2. **Design tokens globais — existem, mas desligados da renderização.** O sistema
   (`designTokens.ts`, resolvedor `$tokens.*`) existe, mas começa `undefined`, não tem UI de
   edição, e **os templates não usam tokens** (são hardcoded). Setar só os tokens **não
   garante** que o visual mude.
3. **Templates de plugin — hardcoded, não parametrizáveis.** Quando existem, têm visual
   fixo e não servem para tema dinâmico.

**Conclusão:** para um catálogo gerado sair temático de forma confiável, **grave valores
concretos por elemento**. Não dependa de tokens nem de `$tokens.*` no `content`.

## Regra prática

Para CADA elemento (capa, título, card de produto, preço, texto):

✅ **FAÇA:** colocar valores **concretos** no `style`/`textData` do `content`:
```json
"style": { "backgroundColor": "#FFFFFF", "borderRadius": 20, "boxShadow": "0 4px 16px rgba(0,0,0,0.06)" },
"textData": { "fontFamily": "Playfair Display", "fontSize": 22, "color": "#4A3B40", "fontWeight": 600 }
```

❌ **NÃO FAÇA:** referências de token no conteúdo:
```json
"color": "$tokens.colors.primary"   // pode não resolver na renderização → sai sem cor
```

➕ **TAMBÉM FAÇA (em paralelo, não no lugar):** preencher `Theme.styles.designTokens` com a
mesma paleta/tipografia. Isso deixa o catálogo consistente e pronto para quando o token
global for ligado à UI — mas **não é o que garante o visual hoje**.

## Mapeando o tema → estilos de elemento

Pegue os valores do preset (em `temas.md`) e distribua:

| Elemento | De onde vem o estilo |
|---|---|
| Fundo da página/capa | `background` (capa pode usar `primary` ou um degradê leve) |
| Título do catálogo (capa) | heading font · cor `text` ou `primary` · tamanho grande |
| Subtítulo / motivo | `secondary`/`textMuted` |
| Card do produto (surface) | `surface` de fundo · `radius` do card · sombra do card · borda |
| Nome do produto | heading ou body font · cor `text` · peso semibold |
| Preço | body font bold · cor `accent` (destaque) · opcional badge com fundo `accent` |
| Descrição curta | body font · cor `textMuted` · tamanho menor |
| Categoria (rótulo) | `secondary` ou badge com `primary` claro |

## Coerência de geometria

Lembre que a geometria vive em `PageComponent` (`position_x/y/width/height`) e o `content`
pode ter `position/size` também. **Mantenha os dois iguais.** Veja em
`catalogLoader.service.ts` qual prevalece e não deixe divergir, ou o elemento pode renderizar
em posição/tamanho inesperado.

## Teste rápido de sucesso

Depois de rodar o seed e abrir no front, o catálogo deve mostrar: capa com a cor e fonte do
tema, cards com o raio/sombra do tema, preço em destaque com a cor de accent. Se sair tudo
cinza/sem estilo → o `style`/`textData` não foi assado por elemento (ou o formato de
`content` diverge do que o loader lê). Volte aqui e à inspeção do loader.
