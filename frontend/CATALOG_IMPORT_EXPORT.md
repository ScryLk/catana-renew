# 📦 Sistema de Importação/Exportação de Catálogos - Catana

## ✅ Implementação Completa

Sistema profissional de portabilidade de catálogos via JSON, permitindo backup, migração e compartilhamento de catálogos entre diferentes ambientes.

---

## 🎯 Funcionalidades Implementadas

### ✅ Exportação de Catálogo

- **Botão "Exportar JSON"** na toolbar do editor (azul, ao lado direito)
- Download automático de arquivo JSON com nome padronizado: `catana-catalog-{nome}-{data}.json`
- Preserva toda a estrutura do catálogo:
  - ✅ Páginas e ordem
  - ✅ Elementos e propriedades
  - ✅ Estilos e posições
  - ✅ Grupos e hierarquias
  - ✅ Headers e footers
  - ✅ Configurações globais (grid, zoom, etc.)
- **IDs Lógicos**: Converte IDs reais para IDs lógicos temporários (segurança)
- **Metadados incluídos**:
  - Nome do catálogo
  - Organização e Sede (se disponíveis)
  - Data de exportação
  - Schema version (1.0)
  - App: "Catana"

### ✅ Importação de Catálogo

- **Botão "Importar JSON"** na Dashboard (ao lado de "Criar novo catálogo")
- **Modal interativo com 5 estados**:
  1. **Upload**: Drag & drop ou clique para selecionar arquivo
  2. **Reading**: Indicador de progresso durante leitura
  3. **Preview**: Visualização detalhada antes de importar
  4. **Importing**: Indicador de progresso durante importação
  5. **Success/Error**: Feedback visual do resultado

- **Validação Rigorosa**:
  - ✅ JSON válido
  - ✅ Schema version compatível (1.0)
  - ✅ Estrutura mínima obrigatória
  - ✅ Campos críticos verificados
  - ⚠️ Warnings para problemas não-críticos

- **Preview Detalhado**:
  - Nome do catálogo
  - Número de páginas
  - Número total de elementos
  - Organização e Sede de origem
  - Data de exportação
  - Avisos (se houver)

### ✅ Segurança

- **Novos IDs gerados**: Todos os elementos recebem IDs únicos na importação
- **Isolamento total**: Importação sempre para organização/sede ativa
- **Sem sobrescrita**: Sempre cria novo catálogo (MVP)
- **Sem dados sensíveis**: Não exporta IDs de banco, permissões, métricas, etc.

---

## 🚀 Como Usar

### Exportar um Catálogo

1. Abra o catálogo no editor
2. Clique no botão **"Exportar JSON"** (azul, canto superior direito)
3. Arquivo será baixado automaticamente
4. Nome do arquivo: `catana-catalog-{nome}-{YYYY-MM-DD}.json`

**Exemplo de nome**: `catana-catalog-catalogo-dipack-2025-12-26.json`

### Importar um Catálogo

1. Na **Dashboard**, clique em **"Importar JSON"**
2. **Arraste o arquivo** ou clique para selecionar
3. **Aguarde a validação** (automática)
4. **Revise o preview**:
   - Verifique nome, páginas e elementos
   - Leia os avisos (se houver)
5. Clique em **"Importar Catálogo"**
6. Aguarde confirmação de sucesso
7. Você será redirecionado para o editor com o catálogo importado

---

## 📋 Estrutura do JSON Exportado

```json
{
  "schemaVersion": "1.0",
  "exportedAt": "2025-12-26T20:53:00.000Z",
  "app": "Catana",
  "catalog": {
    "name": "Catálogo DiPACK 2025",
    "description": "Catálogo oficial de produtos",
    "organization": "DiPACK Embalagens",
    "sede": "Matriz São Paulo",
    "createdAt": "2025-12-26T20:53:00.000Z"
  },
  "settings": {
    "gridSize": 8,
    "snapToGrid": true,
    "defaultZoom": 75
  },
  "pages": [
    {
      "logicalId": "logical-0",
      "name": "Página 1",
      "order": 0,
      "elements": [
        {
          "logicalId": "logical-1",
          "type": "text-title",
          "name": "Título Principal",
          "position": { "x": 100, "y": 100 },
          "size": { "width": 600, "height": 80 },
          "textData": {
            "content": "Catálogo DiPACK",
            "fontSize": 48,
            "fontFamily": "Arial",
            "textAlign": "center"
          }
        }
      ]
    }
  ]
}
```

---

## 🔧 Arquivos Implementados

### Novos Arquivos

1. **`src/types/catalogIO.ts`**
   - Tipos TypeScript para schema de exportação/importação
   - Interfaces de validação
   - Tipos de preview e resultado

2. **`src/services/catalogIO.service.ts`**
   - Serviço centralizado de importação/exportação
   - Funções de validação de schema
   - Conversão entre formatos (real ↔ lógico)
   - Leitura de arquivos JSON

3. **`src/components/editor/ImportCatalogModal.tsx`**
   - Modal interativo de importação
   - Estados: idle → reading → preview → importing → success/error
   - Drag & drop de arquivos
   - Preview detalhado

### Arquivos Modificados

1. **`src/types/editor.ts`**
   - Adicionadas funções ao `EditorStore`:
     - `exportCatalogToJSON()`
     - `importCatalogFromJSON()`
     - `loadCatalogState()`

2. **`src/store/editorStore.ts`**
   - Implementadas funções de import/export
   - Integração com localStorage (organização/sede)
   - Reset de histórico na importação

3. **`src/components/editor/EditorToolbar.tsx`**
   - Botão "Exportar JSON" (azul, ícone de download)
   - Integração com `exportCatalogToJSON()`

4. **`src/pages/Dashboard.tsx`**
   - Botão "Importar JSON" (cinza escuro, ícone de upload)
   - Modal de importação integrado

---

## ⚠️ Validações e Erros

### Erros Críticos (bloqueiam importação)

- ❌ JSON inválido ou corrompido
- ❌ Arquivo não gerado pelo Catana (`app !== "Catana"`)
- ❌ Schema version incompatível (suportada: `1.0`)
- ❌ Catálogo sem nome
- ❌ Estrutura de páginas inválida

### Avisos (não bloqueiam)

- ⚠️ Catálogo sem páginas
- ⚠️ Página sem nome
- ⚠️ Elementos com URLs externas (imagens)

---

## 🧪 Testando o Sistema

### Teste 1: Exportação Básica

1. Crie um catálogo no editor
2. Adicione alguns elementos (texto, imagens, linhas)
3. Clique em "Exportar JSON"
4. Verifique o arquivo baixado
5. Abra o JSON e confirme estrutura válida

### Teste 2: Importação Simples

1. Exporte um catálogo (Teste 1)
2. Vá para a Dashboard
3. Clique em "Importar JSON"
4. Selecione o arquivo exportado
5. Revise o preview
6. Confirme a importação
7. Verifique se todos os elementos foram preservados

### Teste 3: Validação de Erros

1. Tente importar um JSON inválido
2. Tente importar JSON de outro app
3. Verifique mensagens de erro claras

---

## 🎨 Design e UX

### Botões

- **Exportar JSON**: Azul (`bg-blue-600`), ícone FiDownload
- **Importar JSON**: Cinza escuro (`bg-zinc-800`), ícone de upload

### Modal de Importação

- **Header**: Título + descrição + botão fechar
- **Upload Area**: Drag & drop interativo
- **Preview**: Cards informativos com ícones
- **Estados visuais**: Loading spinners, ícones de sucesso/erro
- **Cores**:
  - Sucesso: Verde (`bg-green-100`)
  - Erro: Vermelho (`bg-red-50`)
  - Aviso: Amarelo (`bg-yellow-50`)
  - Info: Azul (`bg-blue-50`)

---

## 🔒 Segurança Implementada

✅ **IDs Lógicos**: Nunca expõe IDs reais do banco de dados
✅ **Sem Permissões**: Não exporta dados de acesso ou roles
✅ **Sem Métricas**: Não exporta analytics ou dados financeiros
✅ **Validação Rigorosa**: Schema validation antes de processar
✅ **Isolamento**: Importação sempre no contexto ativo (org/sede)
✅ **Novos IDs**: Gera IDs únicos na importação (sem conflitos)

---

## 📊 Status da Implementação

| Funcionalidade | Status | Comentário |
|---|---|---|
| Exportação de catálogo | ✅ Completo | Funcional no editor |
| Download de JSON | ✅ Completo | Nome padronizado |
| Validação de schema | ✅ Completo | Schema 1.0 |
| Preview de importação | ✅ Completo | Modal interativo |
| Importação de catálogo | ✅ Completo | Gera novos IDs |
| Botão na toolbar | ✅ Completo | Exportar JSON (azul) |
| Botão na dashboard | ✅ Completo | Importar JSON (cinza) |
| Tratamento de erros | ✅ Completo | Mensagens claras |
| Estados visuais | ✅ Completo | 5 estados no modal |
| Segurança | ✅ Completo | IDs lógicos, validação |

---

## 🚀 Próximas Melhorias (Futuro)

### V2 - Melhorias Planejadas

- [ ] **Importação de imagens**: Download automático de URLs externas
- [ ] **Sobrescrita de catálogo**: Opção de atualizar catálogo existente
- [ ] **Histórico de importações**: Log de arquivos importados
- [ ] **Migração de schema**: Suporte para versões futuras (2.0, 3.0)
- [ ] **Compressão**: Exportar como `.catana` (JSON comprimido)
- [ ] **Importação em lote**: Múltiplos catálogos de uma vez
- [ ] **Templates públicos**: Marketplace de catálogos compartilhados

---

## 🎯 Conclusão

Sistema de importação/exportação **100% funcional** e **production-ready**:

✅ Exportação simples e rápida
✅ Importação segura com preview
✅ Validação rigorosa de schema
✅ UX profissional e intuitiva
✅ Segurança e isolamento garantidos
✅ Portabilidade total de catálogos

**"Exportar e importar catálogos é tão simples quanto salvá-los."** ✨
