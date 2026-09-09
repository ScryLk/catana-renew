import React, { useState, useEffect, useMemo } from 'react';
import {
  Sparkles,
  Paperclip,
  ArrowRight,
  PanelLeftOpen,
  BookOpen,
  Upload,
  Clock,
  ArrowUpRight,
  Search,
} from 'lucide-react';
import { useStudioStore } from '../../store/studioStore';
import { toast } from 'sonner';

const PROMPT_SUGGESTIONS = [
  'Crie um catálogo de confeitaria de até 5 páginas com fotos e destaques...',
  'Crie um cardápio de restaurante de até 2 páginas com pratos e bebidas...',
  'Crie um catálogo B2B de embalagens com tabela técnica de especificações...',
  'Crie um catálogo editorial de moda e joias com 8 páginas...',
  'Crie uma tabela comercial com produtos, códigos SKU e preços...',
];

interface CatalogEntry {
  id: string;
  title: string;
  category: string;
  totalPages: number;
  updatedAt: string;
  description: string;
  color: string;
}

const RECENT_PROJECTS: CatalogEntry[] = [
  {
    id: 'aurea-2026',
    title: 'ÁUREA — Coleção Inverno 2026',
    category: 'Alta-Costura',
    totalPages: 10,
    updatedAt: 'Hoje',
    description: 'Dossiê editorial com 10 spreads diagramados, paleta Noir & Or e proporção áurea.',
    color: '#b08d57',
  },
  {
    id: 'techgear-2026',
    title: 'TechGear — Setup & Tech',
    category: 'Tecnologia',
    totalPages: 6,
    updatedAt: 'Ontem',
    description: 'Especificações de periféricos, fichas técnicas e tabela de atacado B2B.',
    color: '#3b82f6',
  },
  {
    id: 'confeitaria-artesanal',
    title: 'Confeitaria Artesanal — Festas',
    category: 'Gastronomia',
    totalPages: 4,
    updatedAt: '3 dias atrás',
    description: 'Cardápio gourmet de sobremesas para eventos com foco fotográfico e porções.',
    color: '#ec4899',
  },
  {
    id: 'cristallo-joias',
    title: 'Cristallo — Joalheria & Gemas',
    category: 'Alta Joalheria',
    totalPages: 8,
    updatedAt: 'Semana passada',
    description: 'Coleção de gemas preciosas, tipografia clássica e acabamento de alto luxo.',
    color: '#10b981',
  },
];

export const StudioHomeChat: React.FC = () => {
  const [prompt, setPrompt] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'create' | 'edit'>('all');
  const [catalogSearch, setCatalogSearch] = useState('');
  const {
    startSession,
    theme,
    loadExistingCatalog,
    isStudioSidebarOpen,
    toggleStudioSidebar,
  } = useStudioStore();

  const isDark = theme === 'dark';

  // Typewriter effect para alternar sugestões no placeholder
  const [currentText, setCurrentText] = useState('');
  const [suggestionIndex, setSuggestionIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const fullText = PROMPT_SUGGESTIONS[suggestionIndex];
    let timeout: NodeJS.Timeout;

    if (!isDeleting) {
      if (currentText.length < fullText.length) {
        timeout = setTimeout(() => {
          setCurrentText(fullText.slice(0, currentText.length + 1));
        }, 40);
      } else {
        timeout = setTimeout(() => {
          setIsDeleting(true);
        }, 2200);
      }
    } else {
      if (currentText.length > 0) {
        timeout = setTimeout(() => {
          setCurrentText(fullText.slice(0, currentText.length - 1));
        }, 20);
      } else {
        timeout = setTimeout(() => {
          setIsDeleting(false);
          setSuggestionIndex((prev) => (prev + 1) % PROMPT_SUGGESTIONS.length);
        }, 350);
      }
    }

    return () => clearTimeout(timeout);
  }, [currentText, isDeleting, suggestionIndex]);

  const handleStart = (customP?: string) => {
    const promptToUse =
      customP ||
      prompt.trim() ||
      'Crie um catálogo editorial de moda e acessórios de luxo com 10 páginas (Coleção ÁUREA 2026)';
    startSession(promptToUse);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleStart();
    }
  };

  const handleChipClick = (chipPrompt: string) => {
    setPrompt(chipPrompt);
    handleStart(chipPrompt);
  };

  const filteredProjects = useMemo(() => {
    const q = catalogSearch.trim().toLowerCase();
    if (!q) return RECENT_PROJECTS;
    return RECENT_PROJECTS.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q)
    );
  }, [catalogSearch]);

  const handleUploadJson = () => {
    toast.info('Selecione um arquivo de catálogo (.json) para restaurar a edição.');
  };

  return (
    <div
      className={`flex-1 h-dvh overflow-y-auto custom-scrollbar flex flex-col items-center p-6 select-none relative transition-colors ${
        isDark ? 'bg-[#09090b]' : 'bg-[#f8f9fa]'
      }`}
    >
      {/* Floating Sidebar Toggle when sidebar is closed */}
      {!isStudioSidebarOpen && (
        <button
          type="button"
          onClick={toggleStudioSidebar}
          className={`absolute top-4 left-4 px-2.5 py-1.5 rounded-xl border flex items-center gap-2 text-xs z-20 cursor-pointer shadow-xs transition-all ${
            isDark
              ? 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-800'
              : 'bg-white border-zinc-200 text-zinc-700 hover:text-zinc-950 hover:bg-zinc-100'
          }`}
          title="Expandir barra lateral de catálogos (Ctrl+B)"
          aria-label="Expandir barra lateral"
        >
          <PanelLeftOpen className="size-3.5" />
          <span className="font-medium">Catálogos</span>
        </button>
      )}

      <div className="w-full max-w-3xl flex flex-col items-center text-center relative z-10 my-auto py-8">
        {/* Cursive Brand Icon */}
        <div className="flex items-center gap-3 mb-3">
          <svg
            viewBox="40 10 640 170"
            className={`h-9 fill-none stroke-current transition-colors ${
              isDark
                ? 'text-white drop-shadow-[0_2px_12px_rgba(255,255,255,0.15)]'
                : 'text-zinc-950 drop-shadow-[0_2px_12px_rgba(0,0,0,0.08)]'
            }`}
            strokeWidth="8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-label="Logo Katana"
          >
            <path d="M 132 96 C 124 82 104 76 88 86 C 70 97 62 122 74 138 C 84 150 104 148 116 136 C 128 148 146 142 158 120 C 170 100 190 90 206 90 C 194 78 172 80 160 94 C 148 108 148 128 160 140 C 170 149 186 145 196 132 C 202 124 206 108 208 92 C 206 112 206 130 214 142 C 222 152 236 146 244 128 C 256 102 270 66 282 44 C 280 70 276 110 278 132 C 280 148 294 152 308 138 C 322 124 344 100 384 90 C 370 78 348 80 336 94 C 324 108 324 128 336 140 C 346 149 362 145 372 132 C 378 124 382 108 384 92 C 382 112 382 130 390 142 C 398 152 412 146 420 128 C 428 110 438 96 446 88 C 448 106 446 128 448 142 C 458 116 472 94 486 88 C 494 84 498 92 498 104 C 498 120 496 132 502 142 C 508 150 520 146 528 128 C 536 112 560 92 592 90 C 578 78 556 80 544 94 C 532 108 532 128 544 140 C 554 149 570 145 580 132 C 586 124 590 108 592 92 C 590 112 590 130 598 142 C 608 154 626 148 640 124" />
            <path d="M 250 76 C 272 68 300 64 328 70" />
          </svg>
          <span
            className={`text-xs font-mono tracking-wider font-semibold px-2 py-0.5 rounded-full border ${
              isDark
                ? 'bg-zinc-800/80 border-zinc-700/60 text-zinc-300'
                : 'bg-zinc-100 border-zinc-200 text-zinc-700'
            }`}
          >
            2.0
          </span>
        </div>

        {/* Hero Title & Subtitle */}
        <h1
          className={`text-3xl sm:text-4xl font-semibold tracking-tight mb-2 text-balance transition-colors ${
            isDark ? 'text-white' : 'text-zinc-900'
          }`}
        >
          O que vamos criar ou editar hoje?
        </h1>
        <p
          className={`text-xs sm:text-sm max-w-xl mx-auto mb-6 leading-relaxed ${
            isDark ? 'text-zinc-400' : 'text-zinc-500'
          }`}
        >
          Inicie um novo projeto editorial guiado por agentes ou selecione um catálogo existente para continuar a diagramação na prancheta.
        </p>

        {/* Mode Selector Tabs */}
        <div
          className={`p-1 rounded-xl border flex items-center gap-1 mb-6 text-xs font-medium transition-colors ${
            isDark ? 'bg-zinc-900/60 border-zinc-800' : 'bg-zinc-100 border-zinc-200'
          }`}
        >
          <button
            type="button"
            onClick={() => setActiveTab('all')}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              activeTab === 'all'
                ? isDark
                  ? 'bg-zinc-800 text-white shadow-2xs font-semibold'
                  : 'bg-white text-zinc-950 shadow-2xs border border-zinc-200 font-semibold'
                : isDark
                ? 'text-zinc-400 hover:text-zinc-200'
                : 'text-zinc-600 hover:text-zinc-950'
            }`}
          >
            Visão Geral
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('create')}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'create'
                ? isDark
                  ? 'bg-zinc-800 text-white shadow-2xs font-semibold'
                  : 'bg-white text-zinc-950 shadow-2xs border border-zinc-200 font-semibold'
                : isDark
                ? 'text-zinc-400 hover:text-zinc-200'
                : 'text-zinc-600 hover:text-zinc-950'
            }`}
          >
            <Sparkles className="size-3" />
            <span>Criar com IA</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('edit')}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'edit'
                ? isDark
                  ? 'bg-zinc-800 text-white shadow-2xs font-semibold'
                  : 'bg-white text-zinc-950 shadow-2xs border border-zinc-200 font-semibold'
                : isDark
                ? 'text-zinc-400 hover:text-zinc-200'
                : 'text-zinc-600 hover:text-zinc-950'
            }`}
          >
            <BookOpen className="size-3" />
            <span>Editar Existente</span>
          </button>
        </div>

        {/* SECTION 1: AI Prompt Creation Box */}
        {(activeTab === 'all' || activeTab === 'create') && (
          <div className="w-full mb-8">
            <div
              className={`w-full rounded-2xl border transition-colors p-3.5 text-left ${
                isDark
                  ? 'bg-[#121215] border-zinc-800 focus-within:border-zinc-600 shadow-xl'
                  : 'bg-white border-zinc-200 focus-within:border-zinc-400 shadow-lg'
              }`}
            >
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={3}
                aria-label="Instrução para criação do catálogo"
                placeholder={currentText ? `Ex: ${currentText}` : 'Ex: Crie um catálogo de confeitaria de até 5 páginas...'}
                className={`w-full bg-transparent text-sm resize-none outline-none leading-relaxed ${
                  isDark
                    ? 'text-zinc-100 placeholder:text-zinc-500'
                    : 'text-zinc-900 placeholder:text-zinc-400'
                }`}
              />

              <div
                className={`flex items-center justify-between pt-2.5 border-t mt-2 ${
                  isDark ? 'border-zinc-800/80' : 'border-zinc-100'
                }`}
              >
                <div className={`flex items-center gap-2 ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>
                  <button
                    type="button"
                    onClick={() => toast.info('Anexe fotos, PDF ou tabela de produtos...')}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
                      isDark
                        ? 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/80'
                        : 'text-zinc-600 hover:text-zinc-950 hover:bg-zinc-100'
                    }`}
                    aria-label="Anexar arquivos"
                  >
                    <Paperclip className="size-3.5" />
                    <span>Anexar arquivos</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => toast.info('Seletor de estilo e paleta de cores')}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
                      isDark
                        ? 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/80'
                        : 'text-zinc-600 hover:text-zinc-950 hover:bg-zinc-100'
                    }`}
                    aria-label="Estilo visual"
                  >
                    <Sparkles className="size-3.5" />
                    <span>Estilo visual</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => handleStart()}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold shadow-sm transition-all cursor-pointer ${
                    isDark
                      ? 'bg-zinc-100 hover:bg-white text-zinc-950'
                      : 'bg-zinc-900 hover:bg-zinc-800 text-white'
                  }`}
                  aria-label="Gerar catálogo"
                >
                  <span>Gerar Catálogo</span>
                  <ArrowRight className="size-3.5" />
                </button>
              </div>
            </div>

            {/* Quick Starter Templates */}
            <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => handleChipClick('Criar catálogo editorial de moda e acessórios de luxo (Coleção ÁUREA 2026)')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs transition-colors cursor-pointer border ${
                  isDark
                    ? 'bg-zinc-900/90 border-zinc-800 text-zinc-300 hover:border-amber-500/50 hover:text-amber-400'
                    : 'bg-white border-zinc-200 text-zinc-700 hover:border-amber-600/50 hover:text-amber-700 shadow-xs'
                }`}
              >
                <span>ÁUREA — Boutique de Luxo (10 págs)</span>
              </button>

              <button
                type="button"
                onClick={() => handleChipClick('Criar catálogo de confeitaria de 4 páginas com fotos artesanais')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs transition-colors cursor-pointer border ${
                  isDark
                    ? 'bg-zinc-900/90 border-zinc-800 text-zinc-300 hover:border-zinc-700 hover:text-zinc-100'
                    : 'bg-white border-zinc-200 text-zinc-700 hover:border-zinc-300 hover:text-zinc-900 shadow-xs'
                }`}
              >
                <span>Confeitaria Artesanal (4 págs)</span>
              </button>

              <button
                type="button"
                onClick={() => handleChipClick('Criar catálogo TechGear de acessórios e gadgets com especificações técnicas')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs transition-colors cursor-pointer border ${
                  isDark
                    ? 'bg-zinc-900/90 border-zinc-800 text-zinc-300 hover:border-zinc-700 hover:text-zinc-100'
                    : 'bg-white border-zinc-200 text-zinc-700 hover:border-zinc-300 hover:text-zinc-900 shadow-xs'
                }`}
              >
                <span>TechGear — Setup & Tech (6 págs)</span>
              </button>
            </div>
          </div>
        )}

        {/* SECTION 2: Existing Catalogs for Direct Editing */}
        {(activeTab === 'all' || activeTab === 'edit') && (
          <div className="w-full text-left">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3 px-1">
              <div>
                <h2
                  className={`text-sm font-semibold tracking-tight ${
                    isDark ? 'text-zinc-200' : 'text-zinc-800'
                  }`}
                >
                  Continuar Editando Catálogo Existente
                </h2>
                <p className="text-[11px] text-zinc-500">
                  Clique em qualquer projeto abaixo para carregar imediatamente na prancheta interativa.
                </p>
              </div>

              {/* Search input for existing catalogs */}
              <div className="relative w-full sm:w-56">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3 text-zinc-500 pointer-events-none" />
                <input
                  type="text"
                  value={catalogSearch}
                  onChange={(e) => setCatalogSearch(e.target.value)}
                  placeholder="Filtrar por nome..."
                  className={`w-full pl-7 pr-2.5 py-1 rounded-lg text-xs outline-none border transition-all ${
                    isDark
                      ? 'bg-zinc-900/70 border-zinc-800 text-zinc-200 placeholder:text-zinc-500 focus:border-zinc-600'
                      : 'bg-white border-zinc-200 text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400'
                  }`}
                />
              </div>
            </div>

            {/* Catalog Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {filteredProjects.map((project) => (
                <div
                  key={project.id}
                  onClick={() => loadExistingCatalog(project.id)}
                  className={`group p-4 rounded-xl border transition-all cursor-pointer flex flex-col justify-between text-left relative overflow-hidden ${
                    isDark
                      ? 'bg-[#111114] hover:bg-[#16161a] border-zinc-800/80 hover:border-zinc-700'
                      : 'bg-white hover:bg-zinc-50 border-zinc-200 hover:border-zinc-300 shadow-xs'
                  }`}
                >
                  {/* Subtle top color bar */}
                  <div
                    className="absolute top-0 left-0 right-0 h-0.5 opacity-60 group-hover:opacity-100 transition-opacity"
                    style={{ backgroundColor: project.color }}
                  />

                  <div>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <span
                        className={`text-[10px] font-mono uppercase tracking-wider font-semibold px-2 py-0.5 rounded border ${
                          isDark
                            ? 'bg-zinc-900 border-zinc-800 text-zinc-400'
                            : 'bg-zinc-100 border-zinc-200 text-zinc-600'
                        }`}
                      >
                        {project.category}
                      </span>
                      <span className="flex items-center gap-1 text-[11px] text-zinc-500">
                        <Clock className="size-3" />
                        <span>{project.updatedAt}</span>
                      </span>
                    </div>

                    <h3
                      className={`text-sm font-semibold tracking-tight mb-1 group-hover:text-amber-500 transition-colors ${
                        isDark ? 'text-zinc-100' : 'text-zinc-900'
                      }`}
                    >
                      {project.title}
                    </h3>
                    <p
                      className={`text-xs line-clamp-2 leading-relaxed mb-3 ${
                        isDark ? 'text-zinc-400' : 'text-zinc-600'
                      }`}
                    >
                      {project.description}
                    </p>
                  </div>

                  <div
                    className={`pt-2.5 border-t flex items-center justify-between text-xs font-medium ${
                      isDark ? 'border-zinc-800/80 text-zinc-400' : 'border-zinc-100 text-zinc-500'
                    }`}
                  >
                    <span>{project.totalPages} páginas diagramadas</span>
                    <span className="flex items-center gap-1 text-zinc-300 group-hover:text-white transition-colors">
                      <span>Editar agora</span>
                      <ArrowUpRight className="size-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                    </span>
                  </div>
                </div>
              ))}

              {/* Import from JSON Card */}
              <div
                onClick={handleUploadJson}
                className={`p-4 rounded-xl border border-dashed transition-all cursor-pointer flex flex-col justify-between text-left ${
                  isDark
                    ? 'border-zinc-800 hover:border-zinc-700 bg-zinc-900/20 hover:bg-zinc-900/40 text-zinc-400 hover:text-zinc-200'
                    : 'border-zinc-300 hover:border-zinc-400 bg-zinc-50 hover:bg-zinc-100 text-zinc-600 hover:text-zinc-950'
                }`}
              >
                <div>
                  <div className="size-8 rounded-lg border border-inherit flex items-center justify-center mb-2">
                    <Upload className="size-4" />
                  </div>
                  <h3 className="text-sm font-semibold tracking-tight mb-1 text-inherit">
                    Importar Catálogo (.json)
                  </h3>
                  <p className="text-xs leading-relaxed text-zinc-500">
                    Abra arquivos salvos ou backups locais para retomar a diagramação imediatamente.
                  </p>
                </div>
                <div className="pt-2.5 mt-2 flex items-center justify-between text-xs font-medium text-zinc-500">
                  <span>Suporte a JSON / Backup Catana</span>
                  <span>Importar</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

