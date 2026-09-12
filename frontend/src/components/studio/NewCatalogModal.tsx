import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  FileSpreadsheet,
  Layout,
  X,
  ArrowRight,
  Check,
  Palette,
  Layers,
  Home,
} from 'lucide-react';
import { useStudioStore } from '../../store/studioStore';
import { STUDIO_PALETTE_PRESETS } from '../../data/aureaCatalog.mock';

interface SegmentOption {
  id: string;
  label: string;
  defaultPrompt: string;
}

const SEGMENTS: SegmentOption[] = [
  {
    id: 'fashion',
    label: 'Moda & Vestuário',
    defaultPrompt: 'Catálogo editorial sofisticado para coleção de moda contemporânea com cortes minimalistas e alfaiataria premium.',
  },
  {
    id: 'gastronomy',
    label: 'Gastronomia & Food Service',
    defaultPrompt: 'Catálogo de produtos artesanais e packaging para confeitaria fina, café especial e insumos gastronômicos.',
  },
  {
    id: 'tech',
    label: 'Tecnologia & B2B',
    defaultPrompt: 'Catálogo corporativo para equipamentos corporativos, periféricos profissionais e infraestrutura de alta performance.',
  },
  {
    id: 'jewelry',
    label: 'Alta Joalheria & Luxo',
    defaultPrompt: 'Catálogo de gemas nobres, joias autorais e marroquinaria fina com iluminação dramática e acabamento editorial.',
  },
  {
    id: 'architecture',
    label: 'Arquitetura & Decoração',
    defaultPrompt: 'Catálogo de mobiliário autoral, iluminação arquitetural e revestimentos nobres para interiores de alto padrão.',
  },
  {
    id: 'cosmetics',
    label: 'Cosméticos & Bem-Estar',
    defaultPrompt: 'Linha botânica de cuidados pessoais, fragrâncias e formulações orgânicas com embalagens sustentáveis.',
  },
];

const PAGE_COUNT_OPTIONS = [4, 6, 8, 12];

export const NewCatalogModal: React.FC = () => {
  const {
    isNewCatalogModalOpen,
    closeNewCatalogModal,
    triggerCatalogGeneration,
    createBlankCatalog,
    openExcelImportModal,
    resetToHome,
    theme,
  } = useStudioStore();

  const isDark = theme === 'dark';

  const [mode, setMode] = useState<'ai' | 'blank'>('ai');
  const [title, setTitle] = useState('');
  const [selectedSegment, setSelectedSegment] = useState<string>(SEGMENTS[0].id);
  const [prompt, setPrompt] = useState<string>(SEGMENTS[0].defaultPrompt);
  const [pageCount, setPageCount] = useState<number>(6);
  const [selectedPalette, setSelectedPalette] = useState<string>(STUDIO_PALETTE_PRESETS[0].name);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isNewCatalogModalOpen) {
        closeNewCatalogModal();
      }
    };
    if (isNewCatalogModalOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isNewCatalogModalOpen, closeNewCatalogModal]);

  if (!isNewCatalogModalOpen) return null;

  const handleSegmentChange = (seg: SegmentOption) => {
    setSelectedSegment(seg.id);
    if (!prompt || SEGMENTS.some((s) => s.defaultPrompt === prompt)) {
      setPrompt(seg.defaultPrompt);
    }
  };

  const handleGenerateWithAI = () => {
    const catalogTitle = title.trim() || 'Coleção Editorial 2026';
    const finalPrompt = prompt.trim() || SEGMENTS.find((s) => s.id === selectedSegment)?.defaultPrompt || 'Catálogo editorial de produtos';
    
    closeNewCatalogModal();
    triggerCatalogGeneration(
      `Título: ${catalogTitle}. ${finalPrompt}. Paleta: ${selectedPalette}. Total de páginas sugerido: ${pageCount}.`
    );
  };

  const handleCreateBlank = () => {
    const catalogTitle = title.trim() || 'Novo Catálogo';
    closeNewCatalogModal();
    createBlankCatalog(catalogTitle, pageCount, selectedPalette);
  };

  const handleOpenExcel = () => {
    closeNewCatalogModal();
    openExcelImportModal();
  };

  const handleGoHome = () => {
    closeNewCatalogModal();
    resetToHome();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="new-catalog-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) closeNewCatalogModal();
      }}
    >
      <div
        className={`w-full max-w-2xl rounded-2xl border shadow-2xl overflow-hidden flex flex-col max-h-[90vh] transition-all animate-in zoom-in-95 duration-200 ${
          isDark
            ? 'bg-[#121215] border-zinc-800 text-zinc-100'
            : 'bg-white border-zinc-200 text-zinc-900'
        }`}
      >
        {/* Header */}
        <div
          className={`px-6 py-4.5 border-b flex items-center justify-between shrink-0 ${
            isDark ? 'border-zinc-800/80 bg-zinc-900/40' : 'border-zinc-100 bg-zinc-50/60'
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`size-10 rounded-xl flex items-center justify-center border shadow-xs ${
                isDark
                  ? 'bg-zinc-800/80 border-zinc-700 text-[#D4AF37]'
                  : 'bg-amber-50 border-amber-200/80 text-[#B08D57]'
              }`}
            >
              <Sparkles className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 id="new-catalog-modal-title" className="text-base font-semibold tracking-tight">
                  Novo Catálogo Editorial
                </h2>
                <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700/80 font-medium">
                  Estúdio 2.0
                </span>
              </div>
              <p className={`text-xs ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>
                Escolha entre geração assistida por IA ou comece do zero em uma prancheta em branco.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={closeNewCatalogModal}
            className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
              isDark
                ? 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
                : 'bg-zinc-100 border-zinc-200 text-zinc-600 hover:text-zinc-950'
            }`}
            aria-label="Fechar modal"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Mode Selector Tabs */}
        <div
          className={`px-6 pt-3 pb-0 border-b flex items-center gap-6 text-xs font-medium shrink-0 ${
            isDark ? 'border-zinc-800/80 bg-zinc-900/20' : 'border-zinc-100 bg-zinc-50/30'
          }`}
        >
          <button
            type="button"
            onClick={() => setMode('ai')}
            className={`pb-3 border-b-2 flex items-center gap-2 cursor-pointer transition-colors ${
              mode === 'ai'
                ? isDark
                  ? 'border-[#D4AF37] text-[#D4AF37] font-semibold'
                  : 'border-[#B08D57] text-[#B08D57] font-semibold'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Sparkles className="size-3.5" />
            <span>Gerar com IA</span>
          </button>

          <button
            type="button"
            onClick={() => setMode('blank')}
            className={`pb-3 border-b-2 flex items-center gap-2 cursor-pointer transition-colors ${
              mode === 'blank'
                ? isDark
                  ? 'border-[#D4AF37] text-[#D4AF37] font-semibold'
                  : 'border-[#B08D57] text-[#B08D57] font-semibold'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Layout className="size-3.5" />
            <span>Prancheta em Branco</span>
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-5 text-xs">
          {/* Campo: Título do Catálogo */}
          <div>
            <label className="block font-medium mb-1.5 text-zinc-300">
              Título ou Nome da Coleção
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={mode === 'ai' ? 'Ex: Coleção Inverno — Maison Éthérée' : 'Ex: Meu Catálogo Comercial 2026'}
              className={`w-full px-3.5 py-2 rounded-xl text-xs outline-none border transition-all ${
                isDark
                  ? 'bg-zinc-900/70 border-zinc-800 text-zinc-100 placeholder:text-zinc-500 focus:border-zinc-600 focus:bg-zinc-900'
                  : 'bg-white border-zinc-300 text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400'
              }`}
            />
          </div>

          {mode === 'ai' && (
            <>
              {/* Segmentos de Mercado */}
              <div>
                <label className="block font-medium mb-2 text-zinc-300">
                  Segmento Comercial
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {SEGMENTS.map((seg) => {
                    const isSelected = selectedSegment === seg.id;
                    return (
                      <button
                        key={seg.id}
                        type="button"
                        onClick={() => handleSegmentChange(seg)}
                        className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                          isSelected
                            ? isDark
                              ? 'bg-amber-950/20 border-[#B08D57]/60 text-amber-100 shadow-xs'
                              : 'bg-amber-50/80 border-[#B08D57] text-amber-950 shadow-xs'
                            : isDark
                              ? 'bg-zinc-900/40 border-zinc-800/80 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
                              : 'bg-zinc-50 border-zinc-200 text-zinc-600 hover:border-zinc-300 hover:text-zinc-900'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium line-clamp-1">{seg.label}</span>
                          {isSelected && <Check className="size-3 text-[#B08D57] shrink-0" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Briefing / Prompt */}
              <div>
                <label className="block font-medium mb-1.5 text-zinc-300">
                  Instruções & Conceito Editorial
                </label>
                <textarea
                  rows={3}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Descreva o tom de voz, estética, público-alvo ou produtos que devem constar no catálogo..."
                  className={`w-full px-3.5 py-2.5 rounded-xl text-xs outline-none border transition-all resize-none ${
                    isDark
                      ? 'bg-zinc-900/70 border-zinc-800 text-zinc-100 placeholder:text-zinc-500 focus:border-zinc-600 focus:bg-zinc-900'
                      : 'bg-white border-zinc-300 text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400'
                  }`}
                />
              </div>
            </>
          )}

          {/* Seleção de Páginas */}
          <div>
            <label className="block font-medium mb-1.5 text-zinc-300 flex items-center gap-1.5">
              <Layers className="size-3.5 text-zinc-400" />
              <span>Número de Páginas (Padrão A4)</span>
            </label>
            <div className="grid grid-cols-4 gap-2">
              {PAGE_COUNT_OPTIONS.map((count) => {
                const isSelected = pageCount === count;
                return (
                  <button
                    key={count}
                    type="button"
                    onClick={() => setPageCount(count)}
                    className={`py-2 px-3 rounded-xl border text-center transition-all cursor-pointer ${
                      isSelected
                        ? isDark
                          ? 'bg-zinc-100 border-zinc-100 text-zinc-950 font-semibold shadow-xs'
                          : 'bg-zinc-900 border-zinc-900 text-white font-semibold shadow-xs'
                        : isDark
                          ? 'bg-zinc-900/50 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
                          : 'bg-zinc-50 border-zinc-200 text-zinc-600 hover:border-zinc-300 hover:text-zinc-900'
                    }`}
                  >
                    <div className="text-xs font-mono font-bold">{count} Páginas</div>
                    <div className="text-[10px] opacity-75 font-normal">
                      {count === 4
                        ? 'Díptico / Encarte'
                        : count === 6
                        ? 'Editorial Clássico'
                        : count === 8
                        ? 'Coleção Completa'
                        : 'Lookbook Amplo'}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Paleta Editorial Inicial */}
          <div>
            <label className="block font-medium mb-1.5 text-zinc-300 flex items-center gap-1.5">
              <Palette className="size-3.5 text-zinc-400" />
              <span>Paleta Cromática Inicial</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {STUDIO_PALETTE_PRESETS.slice(0, 4).map((p) => {
                const isSelected = selectedPalette === p.name;
                return (
                  <button
                    key={p.name}
                    type="button"
                    onClick={() => setSelectedPalette(p.name)}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                      isSelected
                        ? isDark
                          ? 'bg-zinc-800/80 border-zinc-500 text-zinc-100'
                          : 'bg-zinc-100 border-zinc-400 text-zinc-950'
                        : isDark
                          ? 'bg-zinc-900/40 border-zinc-800/80 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
                          : 'bg-white border-zinc-200 text-zinc-600 hover:border-zinc-300 hover:text-zinc-900'
                    }`}
                  >
                    <div className="min-w-0 pr-2">
                      <div className="font-medium truncate">{p.name}</div>
                      <div className="text-[10px] text-zinc-500 font-mono mt-0.5">
                        Contraste {p.contrastRatio || 'AA'}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <span
                        className="size-4 rounded-full border border-black/20 shadow-xs"
                        style={{ backgroundColor: p.primary }}
                        title="Dominante"
                      />
                      <span
                        className="size-4 rounded-full border border-black/20 shadow-xs"
                        style={{ backgroundColor: p.accent }}
                        title="Acento"
                      />
                      <span
                        className="size-4 rounded-full border border-black/20 shadow-xs"
                        style={{ backgroundColor: p.background }}
                        title="Fundo"
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Action Footer */}
        <div
          className={`px-6 py-4 border-t flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0 ${
            isDark ? 'border-zinc-800/80 bg-zinc-900/40' : 'border-zinc-100 bg-zinc-50/60'
          }`}
        >
          {/* Ações alternativas */}
          <div className="flex items-center gap-2 w-full sm:w-auto justify-start">
            <button
              type="button"
              onClick={handleOpenExcel}
              className={`px-3 py-1.5 rounded-xl border text-xs flex items-center gap-1.5 transition-colors cursor-pointer ${
                isDark
                  ? 'border-zinc-800 hover:bg-zinc-800/80 text-zinc-400 hover:text-zinc-200'
                  : 'border-zinc-200 hover:bg-zinc-100 text-zinc-600 hover:text-zinc-900'
              }`}
              title="Importar dados de planilha Excel ou CSV"
            >
              <FileSpreadsheet className="size-3.5 text-emerald-500" />
              <span>Importar Planilha</span>
            </button>

            <button
              type="button"
              onClick={handleGoHome}
              className={`px-3 py-1.5 rounded-xl border text-xs flex items-center gap-1.5 transition-colors cursor-pointer ${
                isDark
                  ? 'border-zinc-800 hover:bg-zinc-800/80 text-zinc-400 hover:text-zinc-200'
                  : 'border-zinc-200 hover:bg-zinc-100 text-zinc-600 hover:text-zinc-900'
              }`}
              title="Ir para a tela inicial de conversa com o Editor"
            >
              <Home className="size-3.5 text-zinc-400" />
              <span>Chat Inicial</span>
            </button>
          </div>

          {/* Botão de ação principal */}
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={closeNewCatalogModal}
              className={`px-4 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                isDark
                  ? 'text-zinc-400 hover:text-zinc-200'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              Cancelar
            </button>

            {mode === 'ai' ? (
              <button
                type="button"
                onClick={handleGenerateWithAI}
                className="px-5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 bg-[#B08D57] hover:bg-[#9A7B4C] text-white shadow-md transition-all cursor-pointer"
              >
                <Sparkles className="size-3.5" />
                <span>Gerar Catálogo com IA</span>
                <ArrowRight className="size-3.5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleCreateBlank}
                className="px-5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:hover:bg-zinc-200 dark:text-zinc-950 shadow-md transition-all cursor-pointer"
              >
                <Layout className="size-3.5" />
                <span>Criar Prancheta em Branco</span>
                <ArrowRight className="size-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
