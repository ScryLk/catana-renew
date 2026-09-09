# Modelo de dados do Catana (mapa para o seed)

> ⚠️ Este arquivo é um **mapa de orientação**, baseado na leitura do projeto em jun/2026.
> A **fonte da verdade é o código** (`models.py`, `editor.ts`, `catalogLoader.service.ts`).
> Sempre confirme nomes de campos/FK lá antes de gerar o script. Se divergir, o código vence.

## As 5 tabelas que o seed precisa escrever

Todas em `catana-back/api/models.py`. A maioria tem `organization` (+ às vezes `sede`,
`created_by`) — resolva essas FKs antes de inserir.

### `Theme` (≈ linha 197)
- `styles` — **JSONField**. A aparência global mora em `styles.designTokens`.
- Crie o Theme **primeiro**; o `Catalog` aponta para ele.
- Preencha `styles.designTokens` com a paleta/tipografia do tema escolhido (ver
  `temas.md`). Estrutura dos tokens em `catana-front/src/types/designTokens.ts`
  (`colors`, `typography`, `spacing`, `borderRadius`, `shadows` + `DEFAULT_DESIGN_TOKENS`).
  Use `DEFAULT_DESIGN_TOKENS` como ponto de partida e sobrescreva com os valores do tema.

### `Catalog` (≈ linha 205)
- `title`, `description`, `cover_image` (→ Media, opcional), **`theme`** (→ Theme),
  `organization`, `sede` (nullable), `is_public`, `likes`, `saves`.
- **Não guarda geometria nem elementos** — só metadados + tema.

### `Page` (≈ linha 219)
- `catalog` (FK), `order` (int, 0-based), `background_image` (→ Media, opcional).
- Uma por página do catálogo (capa = order 0).

### `Component` (≈ linha 225)
- `component_type` — **restrito a `text | image | product`** (confirme os choices no model).
- **`content`** — **JSONField = o elemento completo** (estilo, dados, possivelmente
  geometria). É aqui que o tema é assado. Ver forma abaixo.
- `is_reusable` (bool) — para esta skill, normalmente `False`.

### `PageComponent` (≈ linha 235)
- Liga uma `Page` a um `Component` com **geometria**: `position_x`, `position_y`,
  `width`, `height`, `layer`.
- Confirme no model os nomes exatos das FKs (provavelmente `page` e `component`).
- Crie **um PageComponent por elemento posicionado** na página.

## Ordem de criação no seed

```
Theme  →  Catalog (→ Theme)  →  para cada página: Page (→ Catalog)
       →  para cada elemento da página: Component (content temático)
                                       + PageComponent (Page, Component, geometria)
```

## A forma de `Component.content` (a peça mais delicada)

O `catalogLoader.service.ts` reconstrói cada elemento do editor a partir de
`PageComponent` (geometria) + `Component.content`. Logo, **`content` precisa ter o formato
que o loader espera** — que espelha `CatalogElement` em `catana-front/src/types/editor.ts`.

**NÃO confie na forma abaixo cegamente.** Faça isto primeiro:
1. Abra `editor.ts` e leia o tipo `CatalogElement` e o enum `ElementType`.
2. Abra `catalogLoader.service.ts` e veja campo a campo o que ele lê de `content`.
3. **Melhor de tudo:** extraia um `Component.content` real de um catálogo já semeado:
   ```bash
   docker-compose exec web python manage.py shell -c \
   "from api.models import Component; import json; \
    c=Component.objects.exclude(content={}).first(); print(json.dumps(c.content, indent=2, ensure_ascii=False))"
   ```
   Use esse JSON real como molde exato.

### Forma provável (a CONFIRMAR contra o código)

Cada `CatalogElement` no editor tem aproximadamente:
- `id` (string), `type` (um `ElementType`)
- `position` `{ x, y }`, `size` `{ width, height }`
- `style` — objeto de estilo (cores, borda, raio, sombra, fundo…)
- dados por tipo: `textData` (`text`, `fontFamily`, `fontSize`, `color`, `fontWeight`,
  `align`…), `imageData` (`src`, `fit`…), `productData` (`name`, `price`, `description`,
  `imageUrl`, `category`…)

Para `component_type='product'`, o `content` provavelmente carrega `productData` com os
campos do produto **mais** o `style`/`textData` que dá o visual do card.

> Atenção à **dupla geometria**: `content` pode ter `position`/`size` e o `PageComponent`
> também tem `position_x/y/width/height`. Veja no loader qual prevalece e **mantenha as duas
> coerentes** (mesmos valores) para evitar conflito de renderização.

## Como descobrir as FKs de organização/sede e o usuário criador

- Veja em `views.py` como os fallbacks de dev resolvem isso (ex.:
  `OrganizationViewSet.perform_create` costuma usar o **primeiro superuser**).
- No seed, replique a mesma lógica de forma explícita:
  ```python
  from django.contrib.auth import get_user_model
  from api.models import Organization, Sede
  User = get_user_model()
  user = User.objects.filter(is_superuser=True).first()
  org  = Organization.objects.first()      # ou filtrar pela do usuário
  sede = Sede.objects.filter(organization=org).first()
  ```
  (Confirme os nomes reais e ajuste; pergunte ao usuário se houver múltiplas orgs/sedes.)
