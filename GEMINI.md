# GEMINI.md — Katana 2.0 (AI-Native Catalog Studio Standalone)

> **ATENÇÃO PARA AGENTES IA**: Este documento é a **fonte única de verdade operacional, arquitetural e histórica** para o desenvolvimento do **Katana 2.0** no repositório `catana-renew`. Antes de realizar qualquer modificação no código, consulte as convenções, o estado das fases e as regras inegociáveis descritas aqui.

---

## 1. Visão Geral & Separação Total do Legado (v0.0 → v2.0)

O Katana 2.0 foi desanexado do Katana 1.0 (editor manual com ferramentas de desenho estilo Canva/Figma). Este repositório (`catana-renew`) é a versão oficial, limpa e dedicada exclusivamente ao **Estúdio Agêntico de Criação e Gestão de Catálogos Comerciais com Inteligência Artificial**.

### Pilares Arquiteturais:
1. **Zero Ferramentas Manuais de Desenho**: Sem caneta, réguas manuais ou arrastar-e-soltar de coordenadas brutas. A diagramação é resolvida por intenção em linguagem natural, agentes especialistas e autolayout algorítmico.
2. **Prancheta Split-Screen A4**: Renderização de lâminas duplas (`SpreadViewport.tsx`) com Click-to-Prompt contextual e edição inline.
3. **Multi-Agentes & Governança de Marca**:
   - Orquestrador (Mestre)
   - Diretor de Arte (Design)
   - Redator Publicitário (Redação)
   - Agente Comercial (B2B)
   - Auditor de Marca (Conformidade WCAG AA)
   - 4 Agentes Especializados captados por `/captar` (nativamente desativados até validação humana).
4. **Trava de Marca (Brand Lock)**: Governança cromática rigorosa que restringe os agentes aos tokens da paleta ativa quando acionada.
5. **Catálogo de 24 Habilidades (Skills)**: Documentação e execução via `/comando`, pílulas rápidas ou modal explicativo.

---

## 2. Padrões de Design e Estética (Design System)

* **Tema**: Dark mode profissional e sóbrio com estética *editorial studio* (`#09090b`, `#111114`, bordas em `zinc-800`). Suporte a light mode sem perda de legibilidade.
* **Monocromático Editorial**:
  - Proibidos degradês genéricos de IA (tons roxos, magentas e gradientes "AI slop").
  - Botões principais em branco puro e cinza zinco (`bg-zinc-100 text-zinc-950 hover:bg-white` e `bg-zinc-800 border-zinc-700`).
* **Zero Emojis**: Rigorosamente nenhum emoji na interface, mensagens do sistema, tooltips ou respostas de agentes.

---

## 3. Estrutura de Diretórios

```
catana-renew/
├── frontend/
│   ├── src/
│   │   ├── components/studio/   # Componentes da suite Katana 2.0
│   │   ├── pages/               # KatanaStudio, Products, Catalogs, Auth
│   │   ├── store/studioStore.ts # Store central
│   │   ├── data/                # aureaCatalog.mock.ts, studioSkills.ts
│   │   └── services/            # API, persistência e exportação PDF
│   └── public/                  # Ativos da coleção ÁUREA e logo v2
└── backend/
    ├── catana_back/             # Settings Django
    └── api/                     # Endpoints e models (Catalog, Page, Product, Media)
```

---

## 4. Regras Inegociáveis

1. **Integridade do Build**: Antes de qualquer commit no frontend, execute `npm run build` dentro de `frontend/`. Erros de tipagem do TypeScript não são tolerados.
2. **Preservação de Spreads**: Toda alteração visual deve respeitar o grid A4 (794×1123 por página) e respiros negativos generosos (mínimo de 96px em páginas editoriais).
3. **Independência**: Nenhuma dependência do editor manual legado (v0.0) deve ser reintroduzida.
