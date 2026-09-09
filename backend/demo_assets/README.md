# Biblioteca de assets dos catálogos demo

Assets **curados à mão** e versionados. O gerador (`api/demo/generator.py`)
consome estes arquivos e copia as imagens para `/media/` em runtime. **Sem API
externa, sem chave, sem download.**

```
demo_assets/
  <tema>/
    manifest.json     # empresa, categorias, produtos, b2b (schema abaixo)
    images/           # fotos referenciadas por produtos[].imagem
```

## ⚠️ Imagens placeholder
As imagens em `padaria/images/` são **PLACEHOLDERS** (cor sólida + nome do
produto, marca "PLACEHOLDER" no canto), geradas via Pillow só para a feature
ser testável ponta a ponta. **Substitua pelas fotos curadas de verdade**
(Unsplash/Pexels, uso comercial livre; evite marcas/rótulos/rostos), mantendo
os mesmos nomes de arquivo do `manifest.json`.

## Schema do `manifest.json`
```jsonc
{
  "tema": "padaria",                         // um dos temas de api/demo/themes.py
  "empresa": {
    "nome": "...", "slogan": "...", "sobre": "...",
    "contato": { "telefone": "...", "endereco": "...", "instagram": "...", "whatsapp": "..." },
    "logo": null                             // opcional (nome de arquivo em images/)
  },
  "categorias": ["Pães", "Doces", ...],
  "b2b": {                                   // opcional (seção atacado)
    "titulo": "...", "faixas": [{ "quantidade": "...", "desconto": "..." }], "observacao": "..."
  },
  "produtos": [
    {
      "nome": "...", "descricao": "...", "preco": "0.00",
      "categoria": "Pães", "imagem": "arquivo.jpg",
      "specs": [{ "label": "...", "value": "..." }]   // opcional -> Product.specs (JSON)
    }
  ]
}
```
