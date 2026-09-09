# Biblioteca de temas (presets + receita de geração)

Um **tema** é só um conjunto de valores concretos: paleta, tipografia, estilo de card e
motivo decorativo. Eles são (a) gravados em `Theme.styles.designTokens` e (b) **assados em
cada elemento** como valores concretos (ver `aparencia.md`).

Os presets abaixo cobrem ramos de negócio comuns (confeitaria, mercado/hortifruti, açougue,
restaurante, festas, boutique). **Escolha pelo ramo do negócio.**
Se nenhum encaixar, use a **Receita de geração** no fim.

---

## Como ler um preset

```
Paleta:     primary / secondary / accent / background / surface / text / textMuted
Tipografia: heading (títulos)  ·  body (corpo/preço)
Card:       radius · sombra · borda
Capa:       cor de fundo · motivo decorativo
Vibe:       descrição curta da sensação
```
Fontes: prefira as que o editor já tem disponíveis (confira a lista de `fontFamily` em
`editor.ts`/PropertiesPanel). Se a fonte do preset não existir lá, troque pela equivalente
mais próxima disponível.

---

## Preset: CONFEITARIA / DOCERIA
- **Paleta:** primary `#E8A0BF` · secondary `#B6856A` · accent `#D4AF37` (dourado) ·
  background `#FFF6F0` · surface `#FFFFFF` · text `#4A3B40` · textMuted `#9B8186`
- **Tipografia:** heading = serifada elegante ou script (ex.: "Playfair Display",
  "Cormorant") · body = sans suave (ex.: "Nunito", "Quicksand")
- **Card:** radius alto (16–24px) · sombra suave e difusa · borda 0 ou 1px clara
- **Capa:** fundo rosado/creme · motivo: laços, confeitos, cupcakes, flores delicadas
- **Vibe:** delicado, afetivo, artesanal, "feito com carinho"

## Preset: MERCADO / HORTIFRUTI
- **Paleta:** primary `#3FA34D` (verde) · secondary `#F4A300` (laranja) · accent `#E63946`
  (vermelho promo) · background `#F7FBF5` · surface `#FFFFFF` · text `#1E2A22` ·
  textMuted `#5A6B5E`
- **Tipografia:** heading = sans bold condensada (ex.: "Oswald", "Archivo") ·
  body = sans legível (ex.: "Inter", "Roboto")
- **Card:** radius médio (8–12px) · sombra seca leve · destaque de preço em **badge**
- **Capa:** fundo verde/branco · motivo: frutas/legumes, etiquetas de preço, "OFERTA"
- **Vibe:** fresco, abundante, preço em evidência, alta densidade (grid cheio)

## Preset: AÇOUGUE / FOOD SERVICE
- **Paleta:** primary `#A4161A` (vermelho carne) · secondary `#1A1A1A` (preto) ·
  accent `#F2F2F2` · background `#FAFAFA` · surface `#FFFFFF` · text `#1A1A1A` ·
  textMuted `#6B6B6B`
- **Tipografia:** heading = sans forte/industrial (ex.: "Anton", "Bebas Neue") ·
  body = sans neutra (ex.: "Inter")
- **Card:** radius baixo (4–8px) · sombra discreta · borda 1px cinza
- **Capa:** fundo branco/preto com faixa vermelha · motivo: cortes, selos de qualidade
- **Vibe:** robusto, direto, profissional, masculino/neutro

## Preset: RESTAURANTE / GASTRONOMIA
- **Paleta:** primary `#6F4E37` (café) · secondary `#C19A6B` (caramelo) · accent `#8C2F39`
  (vinho) · background `#FBF7F0` · surface `#FFFFFF` · text `#2B2118` · textMuted `#7A6A58`
- **Tipografia:** heading = serifada com personalidade (ex.: "Playfair Display",
  "Lora") · body = serifada/sans elegante
- **Card:** radius baixo/médio · foto grande no topo · texto generoso (estilo menu)
- **Capa:** fundo terroso · motivo: utensílios, folhas, textura de papel
- **Vibe:** aconchegante, quente, "menu de restaurante", fotos protagonistas

## Preset: FESTAS / EMBALAGENS FESTIVAS
- **Paleta:** primary `#7B2CBF` (roxo) · secondary `#FF6B6B` · accent `#FFD23F` ·
  background `#FFFDF7` · surface `#FFFFFF` · text `#2D2438` · textMuted `#8A7E97`
  (paleta multicolor/divertida — pode variar a cor por categoria)
- **Tipografia:** heading = display divertida/arredondada (ex.: "Baloo 2",
  "Fredoka") · body = sans amigável (ex.: "Nunito")
- **Card:** radius alto (16–24px) · sombra colorida suave · confete/poás opcionais
- **Capa:** fundo vibrante · motivo: balões, confete, estrelas
- **Vibe:** alegre, colorido, lúdico

## Preset: BOUTIQUE / MODA / MINIMAL
- **Paleta:** primary `#111111` · secondary `#888888` · accent `#C9A227` (ou nenhum) ·
  background `#FFFFFF` · surface `#FAFAFA` · text `#111111` · textMuted `#9A9A9A`
- **Tipografia:** heading = sans fina/elegante (ex.: "Montserrat" light, "Jost") ·
  body = sans fina
- **Card:** radius 0–4px · sem sombra ou sombra mínima · muito espaço em branco · foto grande
- **Capa:** fundo branco · motivo: nenhum ou linha fina; tipografia é o protagonista
- **Vibe:** minimalista, sofisticado, editorial, "menos é mais"

---

## Receita de geração (quando nenhum preset encaixa)

Monte um tema novo coerente com o ramo:

1. **Âncora de cor:** escolha 1 cor primária que o público associa ao ramo
   (ex.: floricultura → verde/rosa; pet → turquesa/coral; farmácia → azul/branco;
   construção → amarelo/cinza). Derive: secondary (análoga ou neutra), accent (complementar
   para destaque/preço), background (versão bem clara/desaturada da primary), surface
   (branco), text (quase-preto com leve tom da primary), textMuted (cinza com o mesmo tom).
2. **Contraste:** garanta legibilidade — text sobre background e sobre surface deve ter bom
   contraste (mire AA). Preço/CTA usam accent.
3. **Tipografia:** combine **1 fonte de heading com personalidade** + **1 fonte de corpo
   neutra e legível**. Regra rápida por vibe: elegante → serifada no heading; moderno/varejo
   → sans bold/condensada no heading; lúdico → display arredondada. Só use fontes que o
   editor tem.
4. **Card e raio:** delicado/lúdico → radius alto + sombra suave; varejo/robusto → radius
   baixo + sombra seca; minimal → radius ~0 + sem sombra.
5. **Motivo de capa:** 1 elemento decorativo simples e reconhecível do ramo (não exagere —
   o catálogo é demonstrativo, não um cartaz).
6. **Densidade:** varejo de volume (mercado) → mais cards por página; sofisticado
   (boutique/restaurante) → menos cards, mais respiro.

Confirme a escolha do tema com o usuário em 1 linha antes de gerar
("vou usar um tema [ramo]: paleta X, fonte Y — ok?"), salvo se ele já tiver especificado.

---

## Inferência de ramo a partir dos produtos (quando não informado)

Pistas no nome do catálogo/produtos/categorias:
- **confeitaria:** bolo, torta, brigadeiro, doce, cupcake, encomenda, "kg" de bolo
- **mercado/hortifruti:** kg, hortifruti, cesta, promoção, mercearia, frutas, legumes
- **açougue:** picanha, corte, carne, bovino, suíno, kg de carne
- **restaurante:** prato, porção, menu, entrada, sobremesa, combo
- **festas:** kit festa, descartável, copo, prato, embalagem, lembrancinha
- **moda/boutique:** tamanho P/M/G, coleção, peça, roupa, acessório

Se as pistas forem ambíguas ou conflitantes, **pergunte** — não arrisque o visual errado.
