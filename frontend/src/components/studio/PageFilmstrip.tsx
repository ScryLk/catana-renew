import React, { useState } from 'react';
import {
  SlidersHorizontal,
  Sparkles,
  X,
  Check,
  ArrowLeftRight,
} from 'lucide-react';
import { useStudioStore } from '../../store/studioStore';
import { MiniPageThumbnail } from './MiniPageThumbnail';
import { toast } from 'sonner';

export const PageFilmstrip: React.FC = () => {
  const {
    totalPages,
    currentSpread,
    goToSpread,
    setCustomSpread,
    pages,
    theme,
  } = useStudioStore();

  const isDark = theme === 'dark';
  const spreadsCount = Math.ceil(totalPages / 2);

  const [isCustomModalOpen, setIsCustomModalOpen] = useState(false);
  const [selectedLeft, setSelectedLeft] = useState(currentSpread[0]);
  const [selectedRight, setSelectedRight] = useState(currentSpread[1]);

  // Verifica se o spread ativo é um dos pares padrão (01-02, 03-04, etc.)
  const isStandardSpread = Array.from({ length: spreadsCount }).some((_, idx) => {
    const left = idx * 2 + 1;
    const right = Math.min(totalPages, left + 1);
    return currentSpread[0] === left && currentSpread[1] === right;
  });

  const getPageSummary = (pageNumber: number): string => {
    const page = pages.find((p) => p.pageNumber === pageNumber);
    if (!page) return `Página ${pageNumber}`;
    if (page.type === 'cover') return 'Capa · Coleção 2026';
    if (page.type === 'manifesto') return 'Manifesto';
    if (page.type === 'divider') return `Divisória · ${page.title || page.label}`;
    if (page.type === 'hero') return `Destaque · ${page.products?.[0]?.name || page.label}`;
    if (page.type === 'duo') return `Duo · ${page.products?.map((p) => p.name).join(' & ')}`;
    if (page.type === 'single') return `Single · ${page.products?.[0]?.name || page.label}`;
    if (page.type === 'backcover') return 'Contracapa';
    return `Página ${pageNumber}`;
  };

  const handleOpenModal = () => {
    setSelectedLeft(currentSpread[0]);
    setSelectedRight(currentSpread[1]);
    setIsCustomModalOpen(true);
  };

  const handleApplyCustom = (left?: number, right?: number) => {
    const l = left || selectedLeft;
    const r = right || selectedRight;
    setCustomSpread(l, r);
    setIsCustomModalOpen(false);
    toast.success(
      `Spread personalizado ativado: Páginas ${String(l).padStart(2, '0')} e ${String(
        r
      ).padStart(2, '0')}`
    );
  };

  const handleSwapSelection = () => {
    const temp = selectedLeft;
    setSelectedLeft(selectedRight);
    setSelectedRight(temp);
  };

  const leftPageObj = pages.find((p) => p.pageNumber === selectedLeft) || pages[0];
  const rightPageObj = pages.find((p) => p.pageNumber === selectedRight) || pages[1] || pages[0];

  return (
    <div
      className={`h-12 w-full border-t px-4 flex items-center justify-between select-none z-20 text-xs transition-colors relative ${
        isDark ? 'bg-[#09090b] border-zinc-800' : 'bg-white border-zinc-200'
      }`}
    >
      {/* Left Label */}
      <div
        className={`text-[10px] font-mono tracking-[0.2em] font-semibold uppercase ${
          isDark ? 'text-zinc-500' : 'text-zinc-400'
        }`}
      >
        Spreads
      </div>

      {/* Thumbnails Reel */}
      <div className="flex items-center gap-1.5 overflow-x-auto px-4 no-scrollbar">
        {Array.from({ length: spreadsCount }).map((_, idx) => {
          const leftPage = idx * 2 + 1;
          const rightPage = Math.min(totalPages, leftPage + 1);
          const isSingle = leftPage === rightPage;

          const isActive =
            currentSpread[0] === leftPage && currentSpread[1] === rightPage;

          const spreadLabel = isSingle
            ? String(leftPage).padStart(2, '0')
            : `${String(leftPage).padStart(2, '0')}-${String(rightPage).padStart(2, '0')}`;

          return (
            <button
              key={idx}
              type="button"
              onClick={() => goToSpread(idx)}
              className={`h-7 min-w-[48px] px-2 rounded-md flex items-center justify-center transition-colors cursor-pointer font-mono text-[10px] font-medium tabular-nums ${
                isActive
                  ? isDark
                    ? 'bg-zinc-200 text-zinc-950 border border-white font-semibold'
                    : 'bg-zinc-900 text-white border border-zinc-900 font-semibold shadow-sm'
                  : isDark
                  ? 'bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700'
                  : 'bg-zinc-100 border border-zinc-200 text-zinc-600 hover:text-zinc-950 hover:border-zinc-300'
              }`}
              title={`Navegar para spread ${spreadLabel}`}
              aria-label={`Navegar para spread ${spreadLabel}`}
            >
              {spreadLabel}
            </button>
          );
        })}

        {/* Pill ativo quando em spread personalizado */}
        {!isStandardSpread && (
          <button
            type="button"
            onClick={handleOpenModal}
            className={`h-7 px-2.5 rounded-md flex items-center gap-1.5 transition-colors cursor-pointer font-mono text-[10px] font-semibold tabular-nums border ${
              isDark
                ? 'bg-zinc-800 border-zinc-600 text-zinc-100 shadow-xs'
                : 'bg-zinc-200 border-zinc-400 text-zinc-900 shadow-xs'
            }`}
            title="Clique para editar este spread personalizado"
          >
            <Sparkles className="size-3 text-zinc-400" />
            <span>
              Custom ({String(currentSpread[0]).padStart(2, '0')} &{' '}
              {String(currentSpread[1]).padStart(2, '0')})
            </span>
          </button>
        )}

        {/* Separator */}
        <div className={`h-4 w-[1px] mx-1 ${isDark ? 'bg-zinc-800' : 'bg-zinc-200'}`} />

        {/* Botão Personalizado */}
        <button
          type="button"
          onClick={handleOpenModal}
          className={`h-7 px-2.5 rounded-md flex items-center gap-1.5 text-[11px] font-medium transition-colors cursor-pointer border ${
            isDark
              ? 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:text-white hover:border-zinc-600'
              : 'bg-zinc-100 border-zinc-200 text-zinc-700 hover:text-zinc-950 hover:border-zinc-400'
          }`}
          title="Selecionar páginas específicas para o spread com preview visual"
          aria-label="Abrir seletor de spread personalizado"
        >
          <SlidersHorizontal className="size-3 text-zinc-400" />
          <span>Personalizado</span>
        </button>
      </div>

      {/* Right Counter */}
      <div
        className={`text-[11px] font-mono whitespace-nowrap tabular-nums ${
          isDark ? 'text-zinc-500' : 'text-zinc-400'
        }`}
      >
        {totalPages} páginas · {spreadsCount} spreads
      </div>

      {/* ================= MODAL DE SPREAD PERSONALIZADO COM PREVIEW VISUAL ================= */}
      {isCustomModalOpen && (
        <div
          onClick={() => setIsCustomModalOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className={`w-full max-w-2xl rounded-2xl border shadow-2xl p-5 select-none transition-colors animate-in zoom-in-95 duration-150 ${
              isDark
                ? 'bg-[#121215] border-zinc-800 text-zinc-100 shadow-[0_25px_60px_rgba(0,0,0,0.85)]'
                : 'bg-white border-zinc-200 text-zinc-900 shadow-[0_20px_50px_rgba(0,0,0,0.15)]'
            }`}
          >
            {/* Modal Header */}
            <div
              className={`flex items-center justify-between pb-3 border-b ${
                isDark ? 'border-zinc-800' : 'border-zinc-100'
              }`}
            >
              <div className="flex items-center gap-2">
                <span
                  className={`p-1.5 rounded-lg border ${
                    isDark
                      ? 'bg-zinc-900 border-zinc-800 text-zinc-300'
                      : 'bg-zinc-100 border-zinc-200 text-zinc-700'
                  }`}
                >
                  <SlidersHorizontal className="size-3.5" />
                </span>
                <div>
                  <h3 className="text-xs font-semibold">Spread Personalizado com Preview</h3>
                  <p className={`text-[11px] ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>
                    Veja o preview das páginas lado a lado antes de aplicar à prancheta
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCustomModalOpen(false)}
                className={`p-1 rounded-md transition-colors cursor-pointer ${
                  isDark
                    ? 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
                    : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100'
                }`}
                aria-label="Fechar janela"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Quick Presets */}
            <div className="my-3">
              <div className="flex items-center justify-between mb-1.5">
                <span
                  className={`text-[10px] font-mono uppercase tracking-wider ${
                    isDark ? 'text-zinc-500' : 'text-zinc-400'
                  }`}
                >
                  Combinações Rápidas
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { left: 1, right: 10, label: '01 & 10 · Capa e Fim' },
                  { left: 4, right: 7, label: '04 & 07 · Destaques' },
                  { left: 1, right: 7, label: '01 & 07 · Capa & Camisa' },
                  { left: 3, right: 6, label: '03 & 06 · Divisórias' },
                  { left: 5, right: 8, label: '05 & 08 · Duos' },
                ].map((preset) => {
                  const isPresetActive =
                    selectedLeft === preset.left && selectedRight === preset.right;
                  return (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => {
                        setSelectedLeft(preset.left);
                        setSelectedRight(preset.right);
                      }}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-medium border transition-colors cursor-pointer ${
                        isPresetActive
                          ? isDark
                            ? 'bg-zinc-200 text-zinc-950 border-white font-semibold'
                            : 'bg-zinc-900 text-white border-zinc-900 font-semibold'
                          : isDark
                          ? 'bg-zinc-900/90 border-zinc-800 text-zinc-300 hover:border-zinc-700 hover:text-zinc-100'
                          : 'bg-zinc-100 border-zinc-200 text-zinc-700 hover:border-zinc-300 hover:text-zinc-950'
                      }`}
                    >
                      {preset.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* PREVIEW VISUAL DO SPREAD LADO A LADO (MINIATURAS REAIS) */}
            <div
              className={`my-3.5 p-3 rounded-xl border flex flex-col items-center justify-center ${
                isDark ? 'bg-[#09090b] border-zinc-800' : 'bg-zinc-100 border-zinc-200'
              }`}
            >
              <div className="flex flex-row items-center justify-center gap-4 w-full">
                {/* Preview Página Esquerda */}
                <div className="flex flex-col items-center">
                  <span
                    className={`text-[10px] font-mono font-semibold uppercase mb-1.5 ${
                      isDark ? 'text-zinc-400' : 'text-zinc-600'
                    }`}
                  >
                    Esquerda · Pág. {String(selectedLeft).padStart(2, '0')}
                  </span>
                  <div className="w-28 h-40 shadow-md transition-transform hover:scale-102">
                    {leftPageObj && (
                      <MiniPageThumbnail
                        page={leftPageObj}
                        className="w-full h-full shadow-sm"
                        showBadge={false}
                      />
                    )}
                  </div>
                  <span
                    className={`text-[10px] font-medium mt-1.5 max-w-[120px] truncate text-center ${
                      isDark ? 'text-zinc-300' : 'text-zinc-700'
                    }`}
                  >
                    {getPageSummary(selectedLeft)}
                  </span>
                </div>

                {/* Botão Central de Inversão (⇄) */}
                <div className="flex flex-col items-center justify-center pt-2">
                  <button
                    type="button"
                    onClick={handleSwapSelection}
                    className={`p-2.5 rounded-full border transition-all cursor-pointer shadow-sm hover:scale-110 active:scale-95 ${
                      isDark
                        ? 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:text-white hover:bg-zinc-700'
                        : 'bg-white border-zinc-300 text-zinc-700 hover:text-zinc-950 hover:bg-zinc-100'
                    }`}
                    title="Inverter páginas (Esquerda ⇄ Direita)"
                    aria-label="Inverter lados selecionados"
                  >
                    <ArrowLeftRight className="size-4" />
                  </button>
                  <span className={`text-[9px] font-mono mt-1 ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>
                    Inverter
                  </span>
                </div>

                {/* Preview Página Direita */}
                <div className="flex flex-col items-center">
                  <span
                    className={`text-[10px] font-mono font-semibold uppercase mb-1.5 ${
                      isDark ? 'text-zinc-400' : 'text-zinc-600'
                    }`}
                  >
                    Direita · Pág. {String(selectedRight).padStart(2, '0')}
                  </span>
                  <div className="w-28 h-40 shadow-md transition-transform hover:scale-102">
                    {rightPageObj && (
                      <MiniPageThumbnail
                        page={rightPageObj}
                        className="w-full h-full shadow-sm"
                        showBadge={false}
                      />
                    )}
                  </div>
                  <span
                    className={`text-[10px] font-medium mt-1.5 max-w-[120px] truncate text-center ${
                      isDark ? 'text-zinc-300' : 'text-zinc-700'
                    }`}
                  >
                    {getPageSummary(selectedRight)}
                  </span>
                </div>
              </div>
            </div>

            {/* SELETORES HORIZONTAIS LADO A LADO */}
            <div className="flex flex-row items-center gap-3 my-3">
              {/* Seletor Esquerda */}
              <div
                className={`flex-1 min-w-0 p-2.5 rounded-xl border ${
                  isDark ? 'bg-zinc-900/60 border-zinc-800' : 'bg-zinc-50 border-zinc-200'
                }`}
              >
                <label
                  className={`text-[10px] font-mono uppercase tracking-wider font-semibold block mb-1.5 ${
                    isDark ? 'text-zinc-400' : 'text-zinc-600'
                  }`}
                >
                  Trocar Esquerda
                </label>
                <select
                  value={selectedLeft}
                  onChange={(e) => setSelectedLeft(Number(e.target.value))}
                  aria-label="Selecionar página esquerda"
                  className={`w-full text-xs rounded-lg p-2 outline-none border transition-colors cursor-pointer ${
                    isDark
                      ? 'bg-[#18181c] border-zinc-700 text-zinc-200 focus:border-zinc-500'
                      : 'bg-white border-zinc-300 text-zinc-800 focus:border-zinc-500'
                  }`}
                >
                  {pages.map((p) => (
                    <option key={p.id} value={p.pageNumber}>
                      {String(p.pageNumber).padStart(2, '0')} — {getPageSummary(p.pageNumber)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Seletor Direita */}
              <div
                className={`flex-1 min-w-0 p-2.5 rounded-xl border ${
                  isDark ? 'bg-zinc-900/60 border-zinc-800' : 'bg-zinc-50 border-zinc-200'
                }`}
              >
                <label
                  className={`text-[10px] font-mono uppercase tracking-wider font-semibold block mb-1.5 ${
                    isDark ? 'text-zinc-400' : 'text-zinc-600'
                  }`}
                >
                  Trocar Direita
                </label>
                <select
                  value={selectedRight}
                  onChange={(e) => setSelectedRight(Number(e.target.value))}
                  aria-label="Selecionar página direita"
                  className={`w-full text-xs rounded-lg p-2 outline-none border transition-colors cursor-pointer ${
                    isDark
                      ? 'bg-[#18181c] border-zinc-700 text-zinc-200 focus:border-zinc-500'
                      : 'bg-white border-zinc-300 text-zinc-800 focus:border-zinc-500'
                  }`}
                >
                  {pages.map((p) => (
                    <option key={p.id} value={p.pageNumber}>
                      {String(p.pageNumber).padStart(2, '0')} — {getPageSummary(p.pageNumber)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Bottom Actions Minimalistas */}
            <div
              className={`flex items-center justify-end gap-2 pt-3 border-t ${
                isDark ? 'border-zinc-800' : 'border-zinc-100'
              }`}
            >
              <button
                type="button"
                onClick={() => setIsCustomModalOpen(false)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                  isDark
                    ? 'text-zinc-400 hover:text-white hover:bg-zinc-800/60'
                    : 'text-zinc-600 hover:text-zinc-950 hover:bg-zinc-100'
                }`}
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={() => handleApplyCustom()}
                className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer ${
                  isDark
                    ? 'bg-zinc-100 hover:bg-white text-zinc-950'
                    : 'bg-zinc-900 hover:bg-zinc-800 text-white'
                }`}
              >
                <Check className="size-3.5" />
                <span>
                  Aplicar Spread ({String(selectedLeft).padStart(2, '0')} &{' '}
                  {String(selectedRight).padStart(2, '0')})
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
