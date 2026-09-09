import React, { useState } from 'react';
import {
  Share2,
  Download,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Edit2,
  Sun,
  Moon,
  Plus,
} from 'lucide-react';
import { useStudioStore } from '../../store/studioStore';
import { toast } from 'sonner';

export const StudioHeader: React.FC = () => {
  const {
    catalogTitle,
    setCatalogTitle,
    agentStatus,
    currentSpread,
    totalPages,
    nextSpread,
    prevSpread,
    hasStartedSession,
    resetToHome,
    theme,
    toggleTheme,
  } = useStudioStore();

  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState(catalogTitle);

  const isDark = theme === 'dark';

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
    : `Páginas ${String(currentSpread[0]).padStart(2, '0')} e ${String(currentSpread[1]).padStart(2, '0')}`;

  return (
    <header
      className={`h-12 w-full border-b px-3 flex items-center justify-between select-none z-30 transition-colors ${
        isDark
          ? 'bg-[#0c0c0e] border-zinc-800 text-zinc-200'
          : 'bg-white border-zinc-200 text-zinc-800'
      }`}
    >
      {/* LEFT CLUSTER: Brand + Personal Space + Title */}
      <div className="flex items-center gap-2.5 min-w-0">
        {/* Brand Cursive SVG (Click to go Home) */}
        <button
          type="button"
          onClick={resetToHome}
          className="flex items-center gap-2 pr-1 shrink-0 cursor-pointer group bg-transparent border-none p-0"
          title="Ir para o início (Novo Chat)"
          aria-label="Ir para o início"
        >
          <svg
            viewBox="40 10 640 170"
            className={`h-5 fill-none stroke-current group-hover:opacity-80 transition-opacity ${
              isDark ? 'text-white' : 'text-zinc-950'
            }`}
            strokeWidth="8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path
              d="M 132 96 C 124 82 104 76 88 86 C 70 97 62 122 74 138 C 84 150 104 148 116 136 C 128 148 146 142 158 120 C 170 100 190 90 206 90 C 194 78 172 80 160 94 C 148 108 148 128 160 140 C 170 149 186 145 196 132 C 202 124 206 108 208 92 C 206 112 206 130 214 142 C 222 152 236 146 244 128 C 256 102 270 66 282 44 C 280 70 276 110 278 132 C 280 148 294 152 308 138 C 322 124 344 100 384 90 C 370 78 348 80 336 94 C 324 108 324 128 336 140 C 346 149 362 145 372 132 C 378 124 382 108 384 92 C 382 112 382 130 390 142 C 398 152 412 146 420 128 C 428 110 438 96 446 88 C 448 106 446 128 448 142 C 458 116 472 94 486 88 C 494 84 498 92 498 104 C 498 120 496 132 502 142 C 508 150 520 146 528 128 C 536 112 560 92 592 90 C 578 78 556 80 544 94 C 532 108 532 128 544 140 C 554 149 570 145 580 132 C 586 124 590 108 592 92 C 590 112 590 130 598 142 C 608 154 626 148 640 124"
            />
            <path d="M 250 76 C 272 68 300 64 328 70" />
          </svg>
          <span
            className={`text-[10px] font-mono tracking-wider font-semibold px-1.5 py-0.5 rounded border ${
              isDark
                ? 'bg-zinc-800 border-zinc-700 text-zinc-300'
                : 'bg-zinc-100 border-zinc-200 text-zinc-700'
            }`}
          >
            2.0
          </span>
        </button>

        {/* Breadcrumb Separator */}
        <span className={`text-xs ${isDark ? 'text-zinc-600' : 'text-zinc-300'}`}>/</span>

        {/* New Chat Button */}
        {hasStartedSession && (
          <button
            type="button"
            onClick={resetToHome}
            className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md border transition-colors ${
              isDark
                ? 'text-zinc-200 hover:text-white bg-zinc-800 hover:bg-zinc-700 border-zinc-700'
                : 'text-zinc-700 hover:text-zinc-950 bg-zinc-100 hover:bg-zinc-200 border-zinc-300'
            }`}
            aria-label="Iniciar novo catálogo"
          >
            <Plus className="size-3.5" />
            <span>Novo Catálogo</span>
          </button>
        )}

        {/* Catalog Title (Editable) */}
        {isEditingTitle ? (
          <input
            type="text"
            value={titleInput}
            onChange={(e) => setTitleInput(e.target.value)}
            onBlur={handleTitleSubmit}
            onKeyDown={(e) => e.key === 'Enter' && handleTitleSubmit()}
            aria-label="Título do catálogo"
            autoFocus
            className={`text-xs font-medium rounded px-2 py-0.5 outline-none border ${
              isDark
                ? 'bg-zinc-900 border-zinc-600 text-white'
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
            aria-label="Editar título do catálogo"
            className={`group flex items-center gap-1.5 text-xs font-medium cursor-pointer px-1.5 py-1 rounded transition-colors bg-transparent border-none text-left ${
              isDark
                ? 'text-zinc-300 hover:text-white hover:bg-zinc-800/60'
                : 'text-zinc-700 hover:text-zinc-950 hover:bg-zinc-100'
            }`}
          >
            <span className="truncate max-w-[200px]">{catalogTitle}</span>
            <Edit2 className="size-3 text-zinc-400 opacity-0 group-hover:opacity-100 transition-opacity" />
          </button>
        )}
      </div>

      {/* CENTER CLUSTER: Agent Status & Spread Navigator */}
      <div className="flex items-center gap-2">
        {/* Agent Status Pill */}
        <div
          className={`hidden lg:flex items-center gap-2 px-2.5 py-1 rounded-full border text-xs ${
            isDark
              ? 'bg-zinc-900 border-zinc-800 text-zinc-300'
              : 'bg-zinc-100 border-zinc-200 text-zinc-700'
          }`}
        >
          <span
            className={`size-2 rounded-full ${
              agentStatus === 'idle'
                ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]'
                : 'bg-zinc-400 animate-pulse'
            }`}
          />
          <span className="text-[11px] font-medium tracking-tight">
            {agentStatus === 'idle'
              ? hasStartedSession
                ? 'Pronta para diagramar'
                : 'Aguardando instrução'
              : 'Processando...'}
          </span>
        </div>

        {/* Spread Navigation Controls (only when session started) */}
        {hasStartedSession && (
          <div
            className={`flex items-center rounded-full px-1.5 py-0.5 text-xs border tabular-nums ${
              isDark
                ? 'bg-zinc-900 border-zinc-800 text-zinc-300'
                : 'bg-zinc-100 border-zinc-200 text-zinc-700'
            }`}
          >
            <button
              type="button"
              onClick={prevSpread}
              className={`p-1 rounded-full transition-colors ${
                isDark
                  ? 'hover:text-white hover:bg-zinc-800'
                  : 'hover:text-zinc-950 hover:bg-zinc-200'
              }`}
              title="Spread anterior"
              aria-label="Spread anterior"
            >
              <ChevronLeft className="size-3.5" />
            </button>
            <span className="px-2 text-[11px] font-medium tracking-tight">
              {spreadLabelText} de {totalPages}
            </span>
            <button
              type="button"
              onClick={nextSpread}
              className={`p-1 rounded-full transition-colors ${
                isDark
                  ? 'hover:text-white hover:bg-zinc-800'
                  : 'hover:text-zinc-950 hover:bg-zinc-200'
              }`}
              title="Próximo spread"
              aria-label="Próximo spread"
            >
              <ChevronRight className="size-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* RIGHT CLUSTER: Actions & Personal Profile */}
      <div className="flex items-center gap-2">
        {hasStartedSession && (
          <>
            {/* Share Button */}
            <button
              type="button"
              onClick={() => toast.success('Link do catálogo copiado!')}
              className={`hidden md:flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded transition-colors ${
                isDark
                  ? 'text-zinc-300 hover:text-white hover:bg-zinc-800/80'
                  : 'text-zinc-600 hover:text-zinc-950 hover:bg-zinc-100'
              }`}
            >
              <Share2 className="size-3.5" />
              <span>Compartilhar</span>
            </button>

            {/* Export PDF */}
            <button
              type="button"
              onClick={() => toast.info('Gerando PDF gráfico de alta resolução (300 DPI)...')}
              className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded border transition-colors ${
                isDark
                  ? 'text-zinc-200 bg-zinc-800 hover:bg-zinc-700 border-zinc-700'
                  : 'text-white bg-zinc-900 hover:bg-zinc-800 border-zinc-900'
              }`}
            >
              <Download className="size-3.5" />
              <span>Exportar PDF</span>
            </button>

            {/* Web Flipbook */}
            <button
              type="button"
              onClick={() => toast.info('Abrindo visualizador interativo Web Flipbook...')}
              className={`hidden lg:flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded transition-colors ${
                isDark
                  ? 'text-zinc-300 hover:text-white hover:bg-zinc-800/80'
                  : 'text-zinc-600 hover:text-zinc-950 hover:bg-zinc-100'
              }`}
            >
              <BookOpen className="size-3.5" />
              <span>Flipbook</span>
            </button>
          </>
        )}

        {/* Dark / Light toggle */}
        <button
          type="button"
          onClick={toggleTheme}
          className={`p-1.5 rounded transition-colors cursor-pointer ${
            isDark
              ? 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/80'
              : 'text-zinc-600 hover:text-zinc-950 hover:bg-zinc-100'
          }`}
          title={isDark ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
          aria-label={isDark ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
        >
          {isDark ? <Sun className="size-3.5" /> : <Moon className="size-3.5" />}
        </button>

        {/* Personal User Avatar (Monochrome) */}
        <div
          className={`size-7 rounded-full border flex items-center justify-center text-xs font-medium ml-1 ${
            isDark
              ? 'bg-zinc-800 border-zinc-700 text-zinc-200'
              : 'bg-zinc-200 border-zinc-300 text-zinc-800'
          }`}
        >
          L
        </div>
      </div>
    </header>
  );
};
