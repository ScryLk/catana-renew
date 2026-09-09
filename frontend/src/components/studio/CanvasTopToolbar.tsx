import React, { useState } from 'react';
import {
  BookOpen,
  FileText,
  Grid3X3,
  Minus,
  Plus,
  ChevronDown,
  Palette,
  Lock,
  ChevronLeft,
  ChevronRight,
  Edit2,
  Share2,
  Download,
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
    setZoomLevel(100);
  };

  const handleTitleSubmit = () => {
    if (titleInput.trim()) {
      setCatalogTitle(titleInput.trim());
    }
    setIsEditingTitle(false);
  };

  const isConsecutive =
    currentSpread[1] === currentSpread[0] + 1 && currentSpread[0] % 2 === 1;
  const spreadLabelText = isConsecutive
    ? `Spread ${String(currentSpread[0]).padStart(2, '0')}-${String(currentSpread[1]).padStart(2, '0')}`
    : `Págs ${String(currentSpread[0]).padStart(2, '0')}-${String(currentSpread[1]).padStart(2, '0')}`;

  return (
    <div
      className={`h-11 w-full border-b px-3 flex items-center justify-between text-xs select-none z-20 transition-colors gap-2 ${
        isDark ? 'bg-[#0e0e11] border-zinc-800 text-zinc-300' : 'bg-white border-zinc-200 text-zinc-700'
      }`}
    >
      {/* LEFT: Catalog Title + Spread Navigator */}
      <div className="flex items-center gap-2.5 min-w-0">

        {/* Editable Title */}
        <div className="flex items-center gap-1.5 truncate">
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
              title="Clique para editar o título"
            >
              <span className="truncate">{catalogTitle}</span>
              <Edit2 className="size-3 opacity-0 group-hover:opacity-60 transition-opacity shrink-0" />
            </button>
          )}
        </div>

        {/* Spread Navigation Pill */}
        <div
          className={`flex items-center rounded-lg border p-0.5 shrink-0 transition-colors ${
            isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-zinc-100 border-zinc-200'
          }`}
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
            <ChevronLeft className="size-3" />
          </button>
          <span className="px-2 font-mono text-[10px] tracking-tight font-medium text-inherit">
            {spreadLabelText} de {totalPages}
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
            <ChevronRight className="size-3" />
          </button>
        </div>
      </div>

      {/* RIGHT: View Modes + Zoom + Palette + Export Buttons */}
      <div className="flex items-center gap-2 shrink-0">
        {/* View Mode Tabs */}
        <div
          className={`hidden xl:flex items-center p-0.5 rounded-lg border transition-colors ${
            isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-zinc-100 border-zinc-200'
          }`}
        >
          <button
            type="button"
            onClick={() => setViewMode('spread')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors cursor-pointer ${
              viewMode === 'spread'
                ? isDark
                  ? 'bg-zinc-800 text-white shadow-2xs'
                  : 'bg-white text-zinc-950 shadow-2xs border border-zinc-200'
                : isDark
                ? 'text-zinc-400 hover:text-zinc-200'
                : 'text-zinc-600 hover:text-zinc-950'
            }`}
          >
            <BookOpen className="size-3" />
            <span>Lâmina</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode('single')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors cursor-pointer ${
              viewMode === 'single'
                ? isDark
                  ? 'bg-zinc-800 text-white shadow-2xs'
                  : 'bg-white text-zinc-950 shadow-2xs border border-zinc-200'
                : isDark
                ? 'text-zinc-400 hover:text-zinc-200'
                : 'text-zinc-600 hover:text-zinc-950'
            }`}
          >
            <FileText className="size-3" />
            <span>Única</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode('grid')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors cursor-pointer ${
              viewMode === 'grid'
                ? isDark
                  ? 'bg-zinc-800 text-white shadow-2xs'
                  : 'bg-white text-zinc-950 shadow-2xs border border-zinc-200'
                : isDark
                ? 'text-zinc-400 hover:text-zinc-200'
                : 'text-zinc-600 hover:text-zinc-950'
            }`}
          >
            <Grid3X3 className="size-3" />
            <span>Grade</span>
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
            title="Reduzir zoom"
            aria-label="Reduzir zoom"
          >
            <Minus className="size-3" />
          </button>
          <button
            type="button"
            onClick={handleResetZoom}
            className={`px-1.5 font-mono text-[11px] cursor-pointer bg-transparent border-none ${
              isDark ? 'text-zinc-300 hover:text-white' : 'text-zinc-700 hover:text-zinc-950'
            }`}
            title="Clique para 100%"
            aria-label="Redefinir zoom para 100%"
          >
            {zoomLevel}%
          </button>
          <button
            type="button"
            onClick={handleZoomIn}
            className={`p-1 rounded transition-colors cursor-pointer ${
              isDark ? 'hover:text-white hover:bg-zinc-800 text-zinc-400' : 'hover:text-zinc-950 hover:bg-zinc-200 text-zinc-600'
            }`}
            title="Aumentar zoom"
            aria-label="Aumentar zoom"
          >
            <Plus className="size-3" />
          </button>
        </div>

        {/* Active Theme Palette Indicator */}
        <button
          type="button"
          onClick={() => setIsPalettePanelOpen(true)}
          className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border cursor-pointer transition-colors text-left ${
            isDark
              ? 'bg-zinc-900 border-zinc-800 hover:border-zinc-700'
              : 'bg-zinc-50 border-zinc-200 hover:border-zinc-300'
          }`}
          title="Abrir Sistema de Cores e Tokens"
        >
          <Palette className="size-3 text-zinc-400 shrink-0" />
          <span className={`text-[11px] truncate max-w-[100px] hidden sm:inline ${isDark ? 'text-zinc-200' : 'text-zinc-800'}`}>
            {activePalette.name}
          </span>
          <div className="flex items-center gap-1">
            <span
              className="size-2 rounded-full border border-zinc-600/40"
              style={{ backgroundColor: activePalette.primary }}
            />
            <span
              className="size-2 rounded-full border border-zinc-600/40"
              style={{ backgroundColor: activePalette.accent }}
            />
          </div>
          {activePalette.locked && (
            <Lock className="size-2.5 text-amber-400 shrink-0" />
          )}
          <ChevronDown className="size-3 text-zinc-400 shrink-0" />
        </button>

        {/* Quick Export Actions */}
        <button
          type="button"
          onClick={() => toast.success('Link do catálogo copiado para a área de transferência!')}
          className={`hidden md:flex items-center gap-1 px-2 py-1 rounded-lg border transition-colors cursor-pointer text-xs ${
            isDark
              ? 'bg-zinc-900 border-zinc-800 hover:border-zinc-700 text-zinc-300 hover:text-white'
              : 'bg-zinc-50 border-zinc-200 hover:border-zinc-300 text-zinc-700 hover:text-zinc-950'
          }`}
          title="Compartilhar catálogo"
        >
          <Share2 className="size-3" />
          <span>Compartilhar</span>
        </button>

        <button
          type="button"
          onClick={() => toast.info('Gerando PDF gráfico em alta resolução (300 DPI)...')}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer shadow-xs ${
            isDark
              ? 'bg-zinc-100 hover:bg-white text-zinc-950'
              : 'bg-zinc-900 hover:bg-zinc-800 text-white'
          }`}
          title="Exportar catálogo em PDF para impressão gráfica"
        >
          <Download className="size-3" />
          <span>PDF</span>
        </button>
      </div>
    </div>
  );
};
