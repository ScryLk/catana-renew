# Estrutura de catálogo: seções, campos e seleção

Referência de domínio sobre como catálogos de produto são estruturados na prática
(com foco em distribuidor / atacado B2B, público típico do Catana, mas aplicável a
qualquer ramo). Use para decidir **quais seções** o catálogo terá e **que dados** cada
uma precisa.

> Lembre: os catálogos do Catana são **demonstrativos**. Seções "interativas" (índice
> clicável, botão de WhatsApp, filtro) entram como **blocos visuais** — desenhadas, não
> funcionais. QR Code é uma imagem real (funciona como imagem). Não construa interatividade.

---

## A. Seleção de estrutura (PERGUNTE ao gerar)

Ao gerar um catálogo, **pergunte ao usuário qual estrutura macro** ele quer:

- **Completa** — todas as seções aplicáveis (institucional + comercial + navegação).
- **Essencial** — só o núcleo que todo catálogo sério tem.
- **Personalizada** — o usuário escolhe da lista quais seções entram.

Mapa de status por seção (base para "essencial" vs "completa"):

| key | Seção | Status | Entra em "Essencial"? |
|-----|-------|--------|----------------------|
| `capa` | Capa | essencial | ✅ |
| `apresentacao` | Carta / apresentação | opcional | — |
| `sobre_empresa` | Sobre a empresa | recomendado (B2B) | — |
| `sumario` | Sumário / índice | essencial se > ~8 páginas | ✅ (condicional ao tamanho) |
| `divisores` | Divisores de categoria | recomendado | — |
| `produtos` | Páginas de produto | essencial | ✅ |
| `secoes_especiais` | Lançamentos / mais vendidos / kits | opcional | — |
| `tabela_precos` | Tabela de preços / condições | essencial em B2B | ✅ (se B2B/atacado) |
| `como_comprar` | Como comprar / pedido | essencial em B2B | ✅ (se B2B/atacado) |
| `termos` | Termos e condições | recomendado (B2B) | — |
| `contracapa` | Contracapa | essencial | ✅ |

Regras de bom senso ao montar cada modo:
- **Essencial** para B2C simples (ex.: confeitaria demonstrativa): `capa`, `produtos`,
  `contracapa` (+ `sumario` se passar de ~8 páginas).
- **Essencial** para B2B/atacado: acima + `tabela_precos` e `como_comprar`.
- **Completa**: todas, omitindo só as que não têm dado (ex.: sem institucional cadastrado,
  pule `sobre_empresa`).
- **Personalizada**: mostre a lista de keys acima e deixe o usuário marcar. Sempre force
  `capa` e `contracapa` como mínimo, e avise se ele tirar `produtos` (catálogo sem núcleo).

A ordem de renderização segue a tabela (capa → … → contracapa). Em atacado denso, uma
ordem alternativa comum é: capa, sumário, (divisor + produtos repetindo por categoria),
tabela de preço consolidada no fim, termos, contracapa.

---

## B. O que cada seção contém e seus campos

Campos no formato `entidade.campo` — é o que o gerador precisa ter (do cadastro ou do
arquivo) para montar a seção. Campos ausentes → a seção se adapta ou é pulada.

### `capa` — essencial
Identifica a marca e dá o tom em segundos. Conter: logo, título do documento
("Catálogo", "Catálogo Atacado", "Linha 2026"), período/edição **visível** (comprador
descarta catálogo antigo), 1–2 fotos fortes de produto, slogan curto (opcional), QR para
versão digital/pedido (opcional). Boas práticas: simplicidade, coerência de marca, poucos
elementos.
```
empresa.logo · empresa.nome
catalogo.titulo · catalogo.periodo/edicao
catalogo.imagem_capa[] · catalogo.slogan? · catalogo.qrcode_url?
catalogo.cores_marca (primaria, secundaria)
```

### `apresentacao` — opcional
Contexto e conexão antes dos produtos. Curto (½ a 1 página). Conter: saudação, quem é a
empresa em 1–2 frases, o que mudou nesta edição, convite à ação.
```
catalogo.apresentacao.titulo · .texto · .assinatura? (nome,cargo) · .imagem?
```

### `sobre_empresa` — recomendado em B2B
Constrói confiança (pesa mais em B2B; o comprador avalia fornecedor recorrente). Conter
(combinar): missão em 1 frase; história curta (começo → evolução → hoje); **números** que
dão escala (anos de mercado, nº de itens, nº de clientes, cobertura) — sinal de confiança
forte; diferenciais; segmentos atendidos; prova social (clientes, depoimentos,
certificações); foto real da estrutura/equipe (bate stock genérica). Empresa nova sem
números: contar história e valores.
```
empresa.missao · empresa.descricao_curta · empresa.historia (texto|timeline[])
empresa.numeros[] (rotulo,valor) · empresa.diferenciais[] · empresa.segmentos_atendidos[]
empresa.prova_social[] (depoimento,cliente,certificacao) · empresa.imagens[]
```

### `sumario` — essencial acima de ~8 páginas
Navegação. Em digital vira menu (no demonstrativo, lista as categorias com a página —
**não clicável**). Conter: categorias/subcategorias com página, cor por categoria (opcional,
ajuda a escanear).
```
catalogo.indice[] (categoria, pagina, cor?)
```

### `divisores` — recomendado
Abre cada categoria, marca transição. Um por categoria, intercalado antes dos produtos
daquela categoria. Conter: imagem grande da categoria, título em destaque, texto curto
opcional. Manter consistência visual entre divisores.
```
categoria.nome · categoria.imagem_destaque · categoria.descricao_curta? · categoria.cor?
```

### `produtos` — essencial (o núcleo)
Dois layouts coexistem; suporte ambos:
- **Densidade (default p/ distribuidor):** 10–20+ itens/página, grid compacto ou tabela,
  escaneamento e comparação rápidos.
- **Detalhe:** 1–4 itens/página, foto grande, para premium/destaque/lançamento.

Anatomia do card B2B: foto padronizada (mesmo fundo/enquadramento — foto ruim derruba o
catálogo); nome; **SKU/código de pedido** (crítico em B2B); descrição curta escaneável (não
parágrafo); especificações em lista/tabela (dimensão, peso, material, capacidade, cor,
validade); variações (cor/tamanho) **agrupadas numa tabela**, não como produtos separados;
preço e/ou faixa por quantidade; **múltiplo de venda** (qtd por caixa/fardo/pacote); MOQ se
houver; disponibilidade/prazo; CTA de pedido (demonstrativo: botão desenhado).
Boas práticas: template de card consistente; especificação em lista; itens de maior
margem/mais vendidos onde o olho cai primeiro (início da seção, cantos externos).
```
produto.foto[] · produto.nome · produto.sku · produto.descricao_curta
produto.especificacoes[] (rotulo,valor) · produto.variacoes[] (atributo,sku)
produto.preco · produto.precos_por_volume[] (qtd_min,preco_unit)
produto.unidade_venda (caixa/fardo/pacote) · produto.qtd_por_embalagem
produto.pedido_minimo (MOQ) · produto.disponibilidade/prazo
produto.cta? · produto.tags[] (lançamento,mais_vendido,promoção)
```

### `secoes_especiais` — opcional
Transformam lista em ferramenta de venda. Em geral no início ou intercaladas.
Tipos: lançamentos/novidades (alto efeito em atacado BR); mais vendidos (prova social);
kits/combos (sobe ticket); cross-sell/companion (acessórios na página do item principal).
```
secao_especial.tipo (lancamento|mais_vendido|kit|cross_sell) · .titulo · .produtos[](refs)
kit.itens[] (produto,qtd) · kit.preco_combo
```

### `tabela_precos` — essencial em B2B
Dado de compra. Em B2B o preço raramente é único. Conter: preço por faixa de quantidade
(tiered); rótulo do tipo ("Preço Atacado", "Preço Parceiro"); condições de pagamento;
frete/entrega; **validade datada**. Boa prática: manter preço separado do produto (atualiza
sem refazer layout). Catálogo público costuma sair **sem** preço de custo.
```
tabela_preco.tipo_cliente · tabela_preco.faixas[] (qtd_min,qtd_max,preco_unit)
tabela_preco.condicoes_pagamento · tabela_preco.frete_politica · tabela_preco.validade
```

### `como_comprar` — essencial em B2B
Remove atrito operacional. Conter: passo a passo do pedido; canais (WhatsApp — padrão em
atacado BR; e-mail; telefone; portal; representante); pedido mínimo geral e prazos;
formulário de pedido (demonstrativo: representação visual); dados do representante.
```
pedido.passos[] · pedido.canais[] (tipo,valor) · pedido.minimo_geral
pedido.formulario · pedido.representante (nome,contato)
```

### `termos` — recomendado em B2B
Clareza e proteção. Conter: prazos, troca/devolução, pagamento, pedido mínimo, frete,
observações fiscais.
```
termos.texto · termos.politica_troca · termos.politica_frete · termos.observacoes_fiscais
```

### `contracapa` — essencial
Última impressão e contato. Conter: logo; site e redes; contato (e-mail, telefone,
endereço); QR (pedido/WhatsApp/catálogo); CTA final ("Faça seu pedido", "Fale com seu
representante").
```
contracapa.logo · contracapa.site · contracapa.redes[] (rede,handle)
contracapa.contato (email,telefone,endereco) · contracapa.qrcode_url · contracapa.cta_texto
```

---

## C. Especificidades B2B / atacado (tratar como primeira classe quando aplicável)

- **SKU/código de pedido** visível em todo produto.
- **MOQ** por produto e/ou geral.
- **Preço escalonado por volume** (tiered), não único.
- **Múltiplo de venda / case pack** (qtd por caixa/fardo; venda por unidade ou fechada).
- **Lead time** quando varia por item.
- **Tabelas de preço por tipo de cliente** (casa com o multi-tenant do Catana).
- **Densidade** de informação (mais item por página, comparar rápido).
- **Atualizar só o dado** sem refazer layout (argumento de venda do Catana).
- **Versão com e sem preço** (vitrine pública × comercial).

Para B2C simples (confeitaria, boutique demonstrativa), a maioria desses itens não se
aplica — não force SKU/MOQ/tiered onde não há dado.

---

## D. Layout e grid

- **Grid modular variando entre páginas** (repetir a mesma coluna deixa monótono).
- **"Bento box":** bloco grande do herói cercado de blocos menores (specs, ângulos,
  acessórios) — bom para página de destaque.
- **Alta densidade:** 15+ itens/página para referência/pedido rápido.
- **Detalhe:** poucos itens, foto grande, para premium/lançamento.
- **Espaço em branco intencional** mesmo no denso (respiro para ler specs).
- **Hierarquia:** categoria → subcategoria → produto.
- **Maior margem** no começo da seção e cantos externos.
- **Identidade consistente** (logo/paleta/fonte em todas as páginas — encaixa no white-label
  multi-tenant). Foto padronizada (mesmo tamanho/ângulo/fundo).

---

## E. Esquema de dados consolidado (visão de gerador)

```
Empresa (tenant)
 ├─ identidade (logo, cores, fontes)
 ├─ institucional (missão, história, números, diferenciais, segmentos, prova social, imagens)
 └─ contato (site, redes, email, telefone, endereço)

Catálogo
 ├─ meta (titulo, período/edição, capa, slogan, qrcode)
 ├─ apresentação?
 ├─ índice (gerado das categorias)
 ├─ Categorias[]
 │   ├─ divisor (nome, imagem, descrição, cor)
 │   └─ Produtos[] (nome, sku, fotos, tags, descrição, specs[], variações[],
 │                  preço, preços_por_volume[], unidade_venda, qtd_embalagem, MOQ, disp, cta)
 ├─ Seções especiais[] (lançamentos, mais vendidos, kits, cross-sell)
 ├─ Tabela de preços[] (por tipo de cliente)
 ├─ Como comprar (passos, canais, representante, formulário)
 ├─ Termos e condições
 └─ Contracapa (contato, redes, qrcode, cta)
```

Modos de saída (mesmo cadastro): vitrine **sem preço** × comercial **com preço**;
**denso** (referência) × **destaque** (lançamento). (Saída digital navegável e impressão
paginada são evoluções futuras — hoje o gerador entrega o catálogo demonstrativo no Catana.)

---

## F. Checklist de catálogo completo

- [ ] Capa: logo, título, período, QR
- [ ] Apresentação curta (opcional)
- [ ] Sobre a empresa com números e prova (B2B)
- [ ] Sumário (acima de ~8 páginas)
- [ ] Divisores por categoria
- [ ] Cards com SKU, especificação escaneável, foto padronizada
- [ ] Variações agrupadas, não duplicadas
- [ ] Preço por faixa de quantidade (B2B)
- [ ] Unidade de venda e MOQ explícitos (B2B)
- [ ] Seções de lançamento / mais vendidos / kits (opcional)
- [ ] Tabela de preço por tipo de cliente (B2B)
- [ ] "Como comprar" com canais e WhatsApp (B2B)
- [ ] Termos e condições (B2B)
- [ ] Contracapa com contato, redes, QR e CTA
- [ ] Identidade visual consistente em todas as páginas
- [ ] Versão sem preço disponível (se público)
