# 🖼️ Guia de Importação de Imagens - Catana Platform

## 🎯 Visão Geral

A importação de produtos suporta dois campos de imagem:
- **`image_main`**: Imagem principal (capa) do produto
- **`image_gallery`**: Galeria de imagens adicionais

---

## 📋 Como Usar

### Na Planilha XLSX/CSV

```
| name       | sku      | image_main                           | image_gallery                                     |
|------------|----------|--------------------------------------|--------------------------------------------------|
| Produto 1  | SKU-001  | https://site.com/produto1-capa.jpg   | https://site.com/img1.jpg|https://site.com/img2.jpg |
| Produto 2  | SKU-002  | https://site.com/produto2-capa.jpg   |                                                  |
| Produto 3  | SKU-003  |                                      | https://site.com/img3-1.jpg|https://site.com/img3-2.jpg|https://site.com/img3-3.jpg |
```

### Regras

1. **image_main** (opcional):
   - URL da imagem principal do produto
   - Uma única URL
   - Define a imagem de destaque/capa
   - Salva em: `/media/products/{product_id}/cover/`

2. **image_gallery** (opcional):
   - URLs de imagens adicionais
   - Múltiplas URLs separadas por `|` (pipe)
   - Complementam a apresentação do produto
   - Salvos em: `/media/products/{product_id}/gallery/`
   - **Nunca substitui a imagem principal**

---

## ✅ URLs Válidas

```
✅ https://exemplo.com/imagem.jpg
✅ http://site.com/foto.png
✅ https://cdn.exemplo.com/produtos/img1.webp
```

```
❌ ftp://site.com/imagem.jpg          (apenas HTTP/HTTPS)
❌ file:///local/imagem.jpg            (apenas URLs remotas)
❌ javascript:alert('xss')             (segurança)
❌ data:image/png;base64,iVBORw0...    (não suportado no MVP)
```

---

## 🔄 Comportamento do Sistema

### Durante a Importação

1. **Produto é criado primeiro** (independente das imagens)
2. **Imagens são processadas depois**:
   - Sistema tenta fazer download de cada URL
   - Se download falhar: produto continua criado, erro é registrado como aviso
   - Validação de URL acontece no frontend e backend

### Em Caso de Erro

- ✅ Produto é criado mesmo que imagens falhem
- ✅ Erro de imagem aparece como aviso, não como falha crítica
- ✅ Outras imagens continuam sendo processadas
- ❌ Importação nunca é bloqueada por erro de imagem

---

## 📊 Exemplos Práticos

### Exemplo 1: Produto com Capa e Galeria

```json
{
  "name": "Notebook Dell Inspiron",
  "sku": "NB-DELL-001",
  "price": 3499.90,
  "image_main": "https://loja.com/notebook-dell-capa.jpg",
  "image_gallery": "https://loja.com/nb-teclado.jpg|https://loja.com/nb-lateral.jpg|https://loja.com/nb-aberto.jpg"
}
```

**Resultado**:
```
/media/products/123/
  ├── cover/
  │   └── notebook-dell-capa.jpg     ← image_main
  └── gallery/
      ├── nb-teclado.jpg             ← gallery[0]
      ├── nb-lateral.jpg             ← gallery[1]
      └── nb-aberto.jpg              ← gallery[2]
```

### Exemplo 2: Produto Apenas com Capa

```json
{
  "name": "Mouse Logitech MX",
  "sku": "MS-LOG-001",
  "price": 389.90,
  "image_main": "https://loja.com/mouse-principal.jpg",
  "image_gallery": ""
}
```

**Resultado**:
```
/media/products/124/
  └── cover/
      └── mouse-principal.jpg        ← image_main
```

### Exemplo 3: Produto Apenas com Galeria

```json
{
  "name": "Cadeira Gamer",
  "sku": "CAD-001",
  "price": 1299.90,
  "image_main": "",
  "image_gallery": "https://loja.com/cadeira-frente.jpg|https://loja.com/cadeira-costa.jpg"
}
```

**Resultado**:
```
/media/products/125/
  └── gallery/
      ├── cadeira-frente.jpg         ← gallery[0]
      └── cadeira-costa.jpg          ← gallery[1]
```

---

## 🧠 Conceito Fundamental

> **"Uma imagem representa o produto, as demais complementam."**

- **image_main** = A primeira impressão, a imagem que representa o produto
- **image_gallery** = Detalhes adicionais, ângulos diferentes, contexto de uso

---

## 🚫 Limitações do MVP

### O que NÃO é suportado:

- ❌ Embutir imagens no arquivo XLSX (apenas URLs)
- ❌ Upload direto de arquivos (apenas URLs remotas)
- ❌ Data URIs (base64 embutido)
- ❌ Sobrescrever imagens existentes automaticamente
- ❌ Redimensionamento automático
- ❌ Processamento de vídeos

### Melhorias Futuras:

- [ ] Upload direto de imagens (sem URLs)
- [ ] Processamento em batch assíncrono (Celery)
- [ ] Redimensionamento e otimização automática
- [ ] Validação avançada (reconhecimento de imagem)
- [ ] Suporte a múltiplas resoluções
- [ ] CDN integration

---

## 📝 Template de Importação

O template XLSX gerado automaticamente já inclui:

```
Coluna H: image_main
Coluna I: image_gallery

Exemplos:
Linha 2: https://exemplo.com/produto1-capa.jpg | https://exemplo.com/img1-1.jpg|https://exemplo.com/img1-2.jpg
Linha 3: https://exemplo.com/produto2-capa.jpg | https://exemplo.com/img2-1.jpg|https://exemplo.com/img2-2.jpg|https://exemplo.com/img2-3.jpg
Linha 4: https://exemplo.com/produto3-capa.jpg | (vazio)
```

Instruções completas estão incluídas no próprio template.

---

## 🔒 Segurança

### Validações Implementadas

**Frontend**:
- ✅ Verifica se URL começa com http:// ou https://
- ✅ Valida formato de URL
- ✅ Mostra avisos para URLs inválidas

**Backend** (recomendado):
- ✅ Validar protocolo (apenas HTTP/HTTPS)
- ✅ Timeout de download (30 segundos)
- ✅ Limite de tamanho (10MB por imagem)
- ✅ Validação de tipo MIME
- ✅ Proteção contra SSRF (Server-Side Request Forgery)
- ❌ Nunca executar conteúdo remoto
- ❌ Nunca processar arquivos não-imagem

---

## 💡 Boas Práticas

### Para Usuários

1. **Use URLs permanentes**: Evite links temporários que expiram
2. **Prefira HTTPS**: Mais seguro e confiável
3. **Teste URLs**: Abra no navegador antes de importar
4. **Organize imagens**: Mantenha uma estrutura clara de pastas
5. **Tamanho adequado**: Evite imagens muito grandes (> 5MB)

### Para Desenvolvedores

1. **Sempre criar produto primeiro**: Não bloquear por erro de imagem
2. **Processar assíncronamente**: Para grandes volumes
3. **Log detalhado**: Registrar todos os erros de download
4. **Retry com backoff**: Tentar novamente em caso de falha temporária
5. **Monitoramento**: Acompanhar taxa de sucesso de downloads

---

## 📞 Suporte

**Dúvidas Comuns:**

**P: O que acontece se a URL de imagem estiver quebrada?**
R: O produto é criado normalmente, mas um aviso é registrado nos logs.

**P: Posso usar imagens locais?**
R: Não no MVP. As imagens precisam estar em URLs públicas (HTTP/HTTPS).

**P: Quantas imagens posso ter na galeria?**
R: Tecnicamente ilimitado, mas recomendamos até 10 imagens por produto.

**P: As imagens são validadas antes da importação?**
R: Sim, o frontend valida o formato da URL. O backend valida durante o download.

**P: E se eu não quiser imagens?**
R: Ambos os campos são opcionais. Deixe em branco se não tiver imagens.

---

**Versão**: 1.0
**Data**: 2025-12-27
**Plataforma**: Catana
