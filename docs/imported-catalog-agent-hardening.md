# Correção de edição por agente em catálogos importados

Validação local de 8 de outubro de 2026 (America/Sao_Paulo). Base: `26ddcb08a4e7db364b7262cccdabc49169c5476d`. Esta entrega prepara código e PR para revisão; não demonstra qual versão está publicada.

## Defeitos e comportamento final

| Defeito reproduzido | Correção |
| --- | --- |
| `altere de ITENS para PRODUTOS` procurava literalmente `de ITENS` em `ITENS DE` | A preposição de roteamento é removida somente fora de aspas. O trecho único vira `PRODUTOS DE`; literais como `"de ITENS"` permanecem literais. |
| Regeneração do PDF trocava programas de fontes com BaseFont igual nas máscaras posteriores | Todas as máscaras de tinta são calculadas antes de qualquer remoção ou regeneração. O limiar de alfa, a exigência de contribuição de cada pixel, o bloqueio de OCR/oclusão e a composição exata permanecem. |
| Peso tipográfico não tinha contrato de revisão e a referência `EMPRESA` era excluída | `update_text_style` altera somente `styleRevision.fontWeight`, mantendo fonte, tamanho extraído, cor, posição e proveniência. Uma referência sem peso visual confiável retorna motivo específico e quatro escolhas explícitas. |
| Mais evidências/fontes esgotavam o orçamento do índice e impediam um alvo único | Comandos determinísticos examinam as páginas de origem e filtram evidências relevantes antes do orçamento de 32 KB; seleção, grupos e ambiguidades continuam validados. Conteúdo suspeito ainda participa da quarentena de contexto. |
| Histórico do servidor permanecia em “Proposta validada” após o resultado local | Save e recibo correlacionam mensagem, request, catálogo, usuário e revisão. O servidor verifica valores persistidos; flags de sucesso do navegador não comprovam execução. |
| Reanálise podia substituir as revisões existentes | Preparação separada reconcilia texto/peso por identidade da origem, preserva páginas autorais e apresenta conflitos. Só uma confirmação revisada e sem divergência de revisão substitui a reconstrução. |

O PDF Plaswill extrai `Rubik-Light/300` mesmo no texto visualmente forte `EMPRESA`, resolvido para fonte alternativa. Esse número não comprova equivalência visual. O pedido exato de comparação retorna `reference_style_unavailable`, sem alterar o título ou o logotipo. Ao escolher “Negrito (700)”, outro turno valida o título, seu texto/peso atual e a revisão do catálogo antes de propor uma alteração.

Um título editado manualmente pode já ter ajustado a fonte alternativa à caixa de origem. A alteração de peso preserva o tamanho então exibido, rejeitando redução adicional ou transbordamento. A função de encaixe também verifica os limites da tinta medida com a fonte carregada; descendentes reservados pela fonte, porém ausentes no texto, não são confundidos com tinta visível.

## Contratos e arquivos

- `shared/studio-actions.json`: capacidade `update_text_style` com `fontWeight`, `expectedFontWeight` e `expectedText`; somente pesos inteiros de 100 a 900, em intervalos de 100.
- `text_commands.py`, `style_commands.py`, provider e policy: parsing limitado, resolução segura, escolhas vinculadas à revisão e revalidação da intenção literal antes de aceitar uma proposta de estilo do modelo.
- `pdf_import_adapter.py`: máscaras anteriores à mutação, com regressão sintética de dois programas TrueType próprios sob o mesmo BaseFont. Nenhum PDF ou programa de fonte do cliente foi adicionado à fixture.
- `imported_text_resolver.py` e `document_reconstructor.py`: índice privado, revisão de peso separada, save/projeção/restore e reconciliação de reanálise. Referência somente de leitura não concede permissão de mutação.
- Executor, renderer e store frontend: fonte carregada, encaixe, aplicação única de patch/done, undo/redo, escolhas explícitas e hidratação do resultado persistido.
- `execution_receipts.py`, views e URLs: POST `/api/v2/studio/catalogs/{id}/chat/execution/`; o bulk save recebe `execution: {client_request_id, message_id}`. Histórico mantém a proposta em `proposal_content` e o resultado em `execution_results`/`execution_receipt`.
- `UpdateDocumentEditability`: revisão explícita com contagens preservadas e bloqueio de conflitos. Os dois requests de reanálise enviam `preserve_edits: true`; descarte implícito é rejeitado.

Recibos verificam texto individual, grupos, peso e sequência de páginas. Operações sem verificador independente permanecem `unverified`, mesmo com revisão salva. Recibos confirmados são históricos e idempotentes; replay não pode sobrescrever uma edição posterior. Diagnósticos limitados do navegador podem explicar uma falha de aplicação, mas nunca confirmam sucesso.

## PDF real: medição independente do navegador

Anexo processado somente localmente: 5.601.050 bytes, SHA-256 `4dd5a20ec09b301ba47a03ca1819a925ee6aaeceb031468bf6089a431b35adea`. Não foi commitado nem enviado a um modelo externo.

| Métrica | Antes | Depois |
| --- | ---: | ---: |
| Páginas preservadas | 8 | 8 |
| Objetos de texto nativos extraídos | 119 | 119 |
| Objetos de texto admitidos como editáveis | 24 | 96 |
| Caracteres de texto com visibilidade comprovada e editáveis | 233 | 1.799 |
| Composições iniciais idênticas pixel a pixel | 8/8 | 8/8 |

Contagem de editáveis por página: `2,1,4,4,4,3,4,2` → `3,9,16,19,14,15,13,7`. Todos os oito hashes de snapshots originais permaneceram iguais. `EMPRESA` (`p2-o16`) passou a `sourceVisible` e editável.

O documento contém 2.592 caracteres nativos extraídos, incluindo ocorrências não admitidas. Isso não é um denominador de “todos os caracteres visíveis”. Os 1.799 caracteres são o conjunto cuja contribuição visual foi comprovada e admitida pelo adaptador; os demais continuam protegidos. Aumento de cobertura não significa OCR ou editabilidade integral.

O adaptador continua em `pypdfium2==5.14.0`; não houve atualização de PDFium nem atribuição do defeito a uma confirmação upstream.

## Validação

Resultados locais finais. Logs e arquivos de execução ficam fora do Git.

- Backend: 599 executados; 595 passaram e quatro foram ignorados por dependerem de locks/concorrência ausentes no SQLite. Os dez testes de recibo passaram novamente após o ajuste final de diagnóstico/no-op estrutural.
- Frontend: 247 testes passaram em 27 arquivos.
- TypeScript/build, paridade do contrato e registro de fontes: passaram. O aviso existente de tamanho de bundle permanece.
- ESLint nos componentes/helpers/testes novos ou alterados com escopo isolado: passou. Não foi feita uma limpeza do lint global do store legado.
- Browser com PDF real: passou em 60 segundos. Comprova as duas edições manuais salvas, comando exato, undo/redo/reload, histórico confirmado, limitação específica da referência, escolha 700, tinta dentro da caixa com fonte carregada, oito páginas/ordem/snapshots, no-op sem undo, reanálise preservando texto/peso e restauração.
- Suíte browser completa: 65 testes passaram em 5,9 minutos, em servidor Vite iniciado do zero e diretório isolado de artefatos. O teste existente de página de encerramento também passou separadamente após preservar os campos vazios autorizados.

```sh
# No backend, usando o ambiente virtual preparado:
AUTH_PROVIDER=mixed DEBUG=True ENVIRONMENT=development ../.venv/bin/python manage.py test --noinput

# No frontend:
npm test
npm run build
CATANA_TEST_PYTHON=/workspace/catana-renew/.venv/bin/python PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium npm run test:e2e

# Validação local opcional do anexo; o caminho é fornecido pelo operador.
CATANA_TEST_PDF='/caminho/local/catalogo.pdf' CATANA_TEST_PYTHON=/workspace/catana-renew/.venv/bin/python PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium npm exec -- playwright test e2e/document-import.spec.ts --grep 'manual cover edits' --output /tmp/catana-real-pdf-playwright --reporter list
```

O bridge usa APIs Django reais, banco temporário e ativos privados isolados; não adiciona rotas de teste à aplicação. O provider é controlado e sem SDK externo. O caminho determinístico de comandos, transporte, autorização e persistência é validado; isso não comprova interpretação de Gemini ou funcionamento da versão de produção. Não havia credencial de Gemini configurada neste ambiente.
