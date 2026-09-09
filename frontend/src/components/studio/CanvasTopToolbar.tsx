import React from 'react';
import {
  BookOpen,
  FileText,
  Grid3X3,
  Minus,
  Plus,
  ChevronDown,
  Palette,
  Lock,
} from 'lucide-react';
import { useStudioStore } from '../../store/studioStore';

export const CanvasTopToolbar: React.FC = () => {
  const {
    viewMode,
    setViewMode,
    zoomLevel,
    setZoomLevel,
    activePalette,
    setIsPalettePanelOpen,
    theme,
  } = useStudioStore();

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

  return (
    <div
      className={`h-11 w-full border-b px-3 flex items-center justify-between text-xs select-none z-20 transition-colors ${
        isDark ? 'bg-[#0e0e11] border-zinc-800 text-zinc-300' : 'bg-white border-zinc-200 text-zinc-700'
      }`}
    >
      {/* LEFT: View Mode Tabs */}
      <div
        className={`flex items-center p-0.5 rounded-lg border transition-colors ${
          isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-zinc-100 border-zinc-200'
        }`}
      >
        <button
          type="button"
          onClick={() => setViewMode('spread')}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
            viewMode === 'spread'
              ? isDark
                ? 'bg-zinc-800 text-white shadow-sm'
                : 'bg-white text-zinc-950 shadow-sm border border-zinc-200/80'
              : isDark
              ? 'text-zinc-400 hover:text-zinc-200'
              : 'text-zinc-600 hover:text-zinc-950'
          }`}
        >
          <BookOpen className="size-3.5" />
          <span>Página Dupla</span>
        </button>

        <button
          type="button"
          onClick={() => setViewMode('single')}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
            viewMode === 'single'
              ? isDark
                ? 'bg-zinc-800 text-white shadow-sm'
                : 'bg-white text-zinc-950 shadow-sm border border-zinc-200/80'
              : isDark
              ? 'text-zinc-400 hover:text-zinc-200'
              : 'text-zinc-600 hover:text-zinc-950'
          }`}
        >
          <FileText className="size-3.5" />
          <span>Página Única</span>
        </button>

        <button
          type="button"
          onClick={() => setViewMode('grid')}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
            viewMode === 'grid'
              ? isDark
                ? 'bg-zinc-800 text-white shadow-sm'
                : 'bg-white text-zinc-950 shadow-sm border border-zinc-200/80'
              : isDark
              ? 'text-zinc-400 hover:text-zinc-200'
              : 'text-zinc-600 hover:text-zinc-950'
          }`}
        >
          <Grid3X3 className="size-3.5" />
          <span>Grade Geral</span>
        </button>
      </div>

      {/* RIGHT: Zoom & Palette Controls */}
      <div className="flex items-center gap-3">
        {/* Zoom Controls */}
        <div
          className={`flex items-center rounded-md border px-1 py-0.5 tabular-nums transition-colors ${
            isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-zinc-100 border-zinc-200'
          }`}
        >
          <button
            type="button"
            onClick={handleZoomOut}
            className={`p-1 rounded transition-colors ${
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
            className={`px-2 font-mono text-[11px] cursor-pointer bg-transparent border-none ${
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
            className={`p-1 rounded transition-colors ${
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
          className={`flex items-center gap-2 px-2.5 py-1 rounded-md border cursor-pointer transition-colors text-left ${
            isDark
              ? 'bg-zinc-900 border-zinc-800 hover:border-zinc-700'
              : 'bg-zinc-50 border-zinc-200 hover:border-zinc-300'
          }`}
          aria-label="Configurar paleta de cores e tokens de design"
          title="Abrir Sistema de Cores e Tokens"
        >
          <Palette className="size-3 text-zinc-400 shrink-0" />
          <span className={`text-[11px] ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>Paleta:</span>
          <span className={`text-xs font-medium max-w-[130px] truncate ${isDark ? 'text-zinc-200' : 'text-zinc-800'}`}>
            {activePalette.name}
          </span>
          <div className="flex items-center gap-1">
            <span
              className="size-2.5 rounded-full border border-zinc-600/40"
              style={{ backgroundColor: activePalette.primary }}
              title={`Dominante: ${activePalette.primary}`}
            />
            <span
              className="size-2.5 rounded-full border border-zinc-600/40"
              style={{ backgroundColor: activePalette.background }}
              title={`Fundo: ${activePalette.background}`}
            />
            <span
              className="size-2.5 rounded-full border border-zinc-600/40"
              style={{ backgroundColor: activePalette.accent }}
              title={`Acento: ${activePalette.accent}`}
            />
          </div>
          {activePalette.locked && (
            <span title="Brand Lock ativo">
              <Lock className="size-2.5 text-amber-400 shrink-0" />
            </span>
          )}
          <ChevronDown className="size-3 text-zinc-400 shrink-0" />
        </button>
      </div>
    </div>
  );
};
