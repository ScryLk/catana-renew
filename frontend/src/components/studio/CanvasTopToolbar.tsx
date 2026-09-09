import React, { useState, useEffect } from 'react';
import {
  BookOpen,
  FileText,
  Grid3X3,
  Minus,
  Plus,
  Palette,
  Lock,
  ChevronLeft,
  ChevronRight,
  Edit2,
  Share2,
  Download,
  Undo2,
  Redo2,
  Check,
  Loader2,
  Cloud,
  CloudOff,
  Sparkles,
} from 'lucide-react';
import { useStudioStore } from '../../store/studioStore';
import { toast } from 'sonner';

export const CanvasTopToolbar: React.FC = () => {
  const {
    viewMode,
    setViewMode,
    zoomLevel,
    setZoomLevel,
    activePalette,
    setIsPalettePanelOpen,
    catalogTitle,
    setCatalogTitle,
    currentSpread,
    totalPages,
    nextSpread,
    prevSpread,
    theme,
    undo,
    redo,
    canUndo,
    canRedo,
    saveStatus,
    isCoPilotOpen,
    toggleCoPilot,
  } = useStudioStore();

  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState(catalogTitle);

  const isDark = theme === 'dark';

  const handleZoomIn = () => {
    setZoomLevel((prev) => Math.min(200, prev + 10));
  };

  const handleZoomOut = () => {
    setZoomLevel((prev) => Math.max(50, prev - 10));
  };

  const handleResetZoom = () => {
    setZoomLevel((prev) => (prev === 100 ? 75 : 100));
  };

  const handleTitleSubmit = () => {
    if (titleInput.trim()) {
      setCatalogTitle(titleInput.trim());
    }
    setIsEditingTitle(false);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInput =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable);
      if (isInput) return;

      const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
      const modifier = isMac ? e.metaKey : e.ctrlKey;

      if (modifier && !e.shiftKey && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault();
        if (canUndo) undo();
      } else if (
        (modifier && e.shiftKey && (e.key === 'z' || e.key === 'Z')) ||
        (modifier && !e.shiftKey && (e.key === 'y' || e.key === 'Y'))
      ) {
        e.preventDefault();
        if (canRedo) redo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo, canUndo, canRedo]);

  return (
    <div
      className={`h-11 w-full border-b px-3 flex items-center justify-between text-xs select-none z-20 transition-colors gap-2 ${
        isDark ? 'bg-[#0e0e11] border-zinc-800 text-zinc-300' : 'bg-white border-zinc-200 text-zinc-700'
      }`}
    >
      {/* LEFT: Catalog Title + Spread Navigator + Undo/Redo + Autosave */}
      <div className="flex items-center gap-2 min-w-0">
        {!isCoPilotOpen && (
          <button
            type="button"
            onClick={toggleCoPilot}
            className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border transition-colors cursor-pointer shrink-0 ${
              isDark
                ? 'bg-zinc-900 border-zinc-800 hover:border-zinc-700 text-zinc-300 hover:text-white'
                : 'bg-zinc-100 border-zinc-200 hover:border-zinc-300 text-zinc-700 hover:text-zinc-950'
            }`}
            title="Abrir painel de IA (CoPilot) - Ctrl+J"
            aria-label="Abrir painel de IA (CoPilot)"
          >
            <Sparkles className="size-3 text-amber-500" />
            <span className="text-[11px] font-medium hidden sm:inline">IA CoPilot</span>
          </button>
        )}

        {/* Editable Title */}
        <div className="flex items-center gap-1.5 truncate max-w-[130px] sm:max-w-[180px] md:max-w-[220px]">
          {isEditingTitle ? (
            <input
              type="text"
              value={titleInput}
              onChange={(e) => setTitleInput(e.target.value)}
              onBlur={handleTitleSubmit}
              onKeyDown={(e) => e.key === 'Enter' && handleTitleSubmit()}
              autoFocus
              className={`text-xs font-semibold px-2 py-0.5 rounded border outline-none ${
                isDark
                  ? 'bg-zinc-900 border-zinc-700 text-zinc-100'
                  : 'bg-white border-zinc-300 text-zinc-900'
              }`}
            />
          ) : (
            <button
              type="button"
              onClick={() => {
                setTitleInput(catalogTitle);
                setIsEditingTitle(true);
              }}
              className="group flex items-center gap-1.5 text-xs font-semibold hover:opacity-80 transition-opacity truncate cursor-pointer"
              title="Clique para renomear o catálogo"
            >
              <span className="truncate">{catalogTitle}</span>
              <Edit2 className="size-3 opacity-0 group-hover:opacity-60 transition-opacity shrink-0" />
            </button>
          )}
        </div>

        {/* Spread Navigation Pill (Compact) */}
        <div
          className={`flex items-center rounded-lg border p-0.5 shrink-0 transition-colors ${
            isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-zinc-100 border-zinc-200'
          }`}
          title={`Spread atual: páginas ${currentSpread[0]} e ${currentSpread[1]} de ${totalPages}`}
        >
          <button
            type="button"
            onClick={prevSpread}
            className={`p-1 rounded transition-colors cursor-pointer ${
              isDark ? 'hover:text-white hover:bg-zinc-800 text-zinc-400' : 'hover:text-zinc-950 hover:bg-zinc-200 text-zinc-600'
            }`}
            title="Spread anterior"
            aria-label="Spread anterior"
          >
            <ChevronLeft className="size-3.5" />
          </button>
          <span className="px-1.5 font-mono text-[10px] tracking-tight font-medium text-inherit">
            {String(currentSpread[0]).padStart(2, '0')}-{String(currentSpread[1]).padStart(2, '0')} / {totalPages}
          </span>
          <button
            type="button"
            onClick={nextSpread}
            className={`p-1 rounded transition-colors cursor-pointer ${
              isDark ? 'hover:text-white hover:bg-zinc-800 text-zinc-400' : 'hover:text-zinc-950 hover:bg-zinc-200 text-zinc-600'
            }`}
            title="Próximo spread"
            aria-label="Próximo spread"
          >
            <ChevronRight className="size-3.5" />
          </button>
        </div>

        {/* Undo / Redo Controls */}
        <div
          className={`flex items-center rounded-lg border p-0.5 shrink-0 transition-colors ${
            isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-zinc-100 border-zinc-200'
          }`}
        >
          <button
            type="button"
            onClick={undo}
            disabled={!canUndo}
            className={`p-1 rounded transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed ${
              isDark ? 'hover:text-white hover:bg-zinc-800 text-zinc-400' : 'hover:text-zinc-950 hover:bg-zinc-200 text-zinc-600'
            }`}
            title="Desfazer alteração (Ctrl+Z / Cmd+Z)"
            aria-label="Desfazer"
          >
            <Undo2 className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={redo}
            disabled={!canRedo}
            className={`p-1 rounded transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed ${
              isDark ? 'hover:text-white hover:bg-zinc-800 text-zinc-400' : 'hover:text-zinc-950 hover:bg-zinc-200 text-zinc-600'
            }`}
            title="Refazer alteração (Ctrl+Shift+Z / Cmd+Shift+Z)"
            aria-label="Refazer"
          >
            <Redo2 className="size-3.5" />
          </button>
        </div>

        {/* Autosave Status Indicator (Icon with tooltip) */}
        <div className="flex items-center px-1 py-1 rounded-md shrink-0">
          {saveStatus === 'saving' && (
            <div title="Salvando alterações na nuvem...">
              <Loader2 className="size-3.5 animate-spin text-amber-500" />
            </div>
          )}
          {saveStatus === 'saved' && (
            <div title="Todas as alterações foram salvas na nuvem">
              <Check className="size-3.5 text-emerald-500" />
            </div>
          )}
          {saveStatus === 'error' && (
            <div title="Erro ao salvar alterações na nuvem">
              <CloudOff className="size-3.5 text-red-500" />
            </div>
          )}
          {saveStatus === 'unsaved' && (
            <div title="Alterações pendentes de sincronização">
              <Cloud className="size-3.5 text-zinc-400 opacity-60" />
            </div>
          )}
        </div>
      </div>

      {/* RIGHT: View Modes (Icons only) + Zoom + Palette (Compact) + Share (Icon) + PDF (Icon) */}
      <div className="flex items-center gap-1.5 shrink-0">
        {/* View Mode Tabs - Icons Only with Tooltips */}
        <div
          className={`flex items-center p-0.5 rounded-lg border transition-colors ${
            isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-zinc-100 border-zinc-200'
          }`}
        >
          <button
            type="button"
            onClick={() => setViewMode('spread')}
            className={`p-1.5 rounded transition-colors cursor-pointer ${
              viewMode === 'spread'
                ? isDark
                  ? 'bg-zinc-800 text-white shadow-2xs'
                  : 'bg-white text-zinc-950 shadow-2xs border border-zinc-200'
                : isDark
                ? 'text-zinc-400 hover:text-zinc-200'
                : 'text-zinc-600 hover:text-zinc-950'
            }`}
            title="Visualização em Lâmina Dupla (Spread)"
            aria-label="Visualização em Lâmina Dupla"
          >
            <BookOpen className="size-3.5" />
          </button>

          <button
            type="button"
            onClick={() => setViewMode('single')}
            className={`p-1.5 rounded transition-colors cursor-pointer ${
              viewMode === 'single'
                ? isDark
                  ? 'bg-zinc-800 text-white shadow-2xs'
                  : 'bg-white text-zinc-950 shadow-2xs border border-zinc-200'
                : isDark
                ? 'text-zinc-400 hover:text-zinc-200'
                : 'text-zinc-600 hover:text-zinc-950'
            }`}
            title="Visualização em Página Única"
            aria-label="Visualização em Página Única"
          >
            <FileText className="size-3.5" />
          </button>

          <button
            type="button"
            onClick={() => setViewMode('grid')}
            className={`p-1.5 rounded transition-colors cursor-pointer ${
              viewMode === 'grid'
                ? isDark
                  ? 'bg-zinc-800 text-white shadow-2xs'
                  : 'bg-white text-zinc-950 shadow-2xs border border-zinc-200'
                : isDark
                ? 'text-zinc-400 hover:text-zinc-200'
                : 'text-zinc-600 hover:text-zinc-950'
            }`}
            title="Visualização em Grade de Páginas"
            aria-label="Visualização em Grade de Páginas"
          >
            <Grid3X3 className="size-3.5" />
          </button>
        </div>

        {/* Zoom Controls */}
        <div
          className={`flex items-center rounded-lg border p-0.5 transition-colors ${
            isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-zinc-100 border-zinc-200'
          }`}
        >
          <button
            type="button"
            onClick={handleZoomOut}
            className={`p-1 rounded transition-colors cursor-pointer ${
              isDark ? 'hover:text-white hover:bg-zinc-800 text-zinc-400' : 'hover:text-zinc-950 hover:bg-zinc-200 text-zinc-600'
            }`}
            title="Reduzir zoom (-10%)"
            aria-label="Reduzir zoom"
          >
            <Minus className="size-3" />
          </button>
          <button
            type="button"
            onClick={handleResetZoom}
            className={`px-1.5 font-mono text-[10px] cursor-pointer bg-transparent border-none ${
              isDark ? 'text-zinc-300 hover:text-white' : 'text-zinc-700 hover:text-zinc-950'
            }`}
            title="Clique para alternar zoom (100% / 75%)"
            aria-label="Alternar zoom entre 100% e 75%"
          >
            {zoomLevel}%
          </button>
          <button
            type="button"
            onClick={handleZoomIn}
            className={`p-1 rounded transition-colors cursor-pointer ${
              isDark ? 'hover:text-white hover:bg-zinc-800 text-zinc-400' : 'hover:text-zinc-950 hover:bg-zinc-200 text-zinc-600'
            }`}
            title="Aumentar zoom (+10%)"
            aria-label="Aumentar zoom"
          >
            <Plus className="size-3" />
          </button>
        </div>

        {/* Active Theme Palette Indicator - Compact Icon + Swatches with Tooltip */}
        <button
          type="button"
          onClick={() => setIsPalettePanelOpen(true)}
          className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg border cursor-pointer transition-colors ${
            isDark
              ? 'bg-zinc-900 border-zinc-800 hover:border-zinc-700'
              : 'bg-zinc-50 border-zinc-200 hover:border-zinc-300'
          }`}
          title={`Sistema de Cores & Design Tokens: ${activePalette.name} (Clique para gerenciar)`}
          aria-label={`Sistema de Cores: ${activePalette.name}`}
        >
          <Palette className="size-3.5 text-zinc-400 shrink-0" />
          <div className="flex items-center gap-1">
            <span
              className="size-2.5 rounded-full border border-zinc-600/40"
              style={{ backgroundColor: activePalette.primary }}
            />
            <span
              className="size-2.5 rounded-full border border-zinc-600/40"
              style={{ backgroundColor: activePalette.accent }}
            />
          </div>
          {activePalette.locked && (
            <Lock className="size-2.5 text-amber-400 shrink-0" />
          )}
        </button>

        {/* Quick Export Action: Compartilhar (Icon only with Tooltip) */}
        <button
          type="button"
          onClick={() => toast.success('Link do catálogo copiado para a área de transferência!')}
          className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
            isDark
              ? 'bg-zinc-900 border-zinc-800 hover:border-zinc-700 text-zinc-300 hover:text-white'
              : 'bg-zinc-50 border-zinc-200 hover:border-zinc-300 text-zinc-700 hover:text-zinc-950'
          }`}
          title="Compartilhar catálogo (copiar link público)"
          aria-label="Compartilhar catálogo"
        >
          <Share2 className="size-3.5" />
        </button>

        {/* Quick Export Action: Exportar PDF (Icon only with Tooltip) */}
        <button
          type="button"
          onClick={() => toast.info('Gerando PDF gráfico em alta resolução (300 DPI)...')}
          className={`p-1.5 rounded-lg transition-all cursor-pointer shadow-xs ${
            isDark
              ? 'bg-zinc-100 hover:bg-white text-zinc-950'
              : 'bg-zinc-900 hover:bg-zinc-800 text-white'
          }`}
          title="Exportar catálogo em PDF para impressão gráfica (300 DPI)"
          aria-label="Exportar catálogo em PDF"
        >
          <Download className="size-3.5" />
        </button>
      </div>
    </div>
  );
};
