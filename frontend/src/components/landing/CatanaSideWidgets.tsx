import type { FC } from 'react';
import { catanaAudio } from './CatanaAudioEngine';

interface CatanaSideWidgetsProps {
  isLightMode: boolean;
  onToggleLightMode: () => void;
  isGridActive: boolean;
  onToggleGrid: () => void;
  isAudioActive: boolean;
  onToggleAudio: () => void;
}

export const CatanaSideWidgets: FC<CatanaSideWidgetsProps> = ({
  isLightMode,
  onToggleLightMode,
  isGridActive,
  onToggleGrid,
  isAudioActive,
  onToggleAudio,
}) => {
  return (
    <>
      {/* Widget Esquerdo: Indicador de Scroll Vertical Rotacionado -90° */}
      <div
        className="hidden md:flex fixed left-6 top-[280px] z-30 flex-col items-center pointer-events-none select-none"
        aria-hidden="true"
      >
        <div
          className={`rotate-[-90deg] translate-x-[-24px] text-[11px] font-mono tracking-[0.25em] uppercase whitespace-nowrap ${
            isLightMode ? 'text-zinc-600' : 'text-zinc-400'
          }`}
        >
          ―――― SCROLL ――――
        </div>
      </div>

      {/* Widget Direito: Barra Tátil de 3 Ações Técnicas */}
      <div
        className="fixed right-4 md:right-8 top-[240px] z-40 flex flex-col gap-4 select-none"
        role="toolbar"
        aria-label="Ferramentas do Atelier"
      >
        {/* 1. Alternador de Modo (Dark Atelier / Papel Marfim) */}
        <div className="relative group flex items-center justify-center min-w-[44px] min-h-[44px]">
          <button
            type="button"
            onClick={() => {
              catanaAudio.playTactileClick(700);
              onToggleLightMode();
            }}
            aria-label={isLightMode ? 'Alternar para Modo Atelier Escuro' : 'Alternar para Modo Papel Marfim'}
            className={`w-9 h-9 rounded-full border-2 flex items-center justify-center transition-all duration-200 hover:scale-105 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 ${
              isLightMode
                ? 'border-[#1A1817] text-[#1A1817] bg-[#F8F6F1] focus-visible:ring-offset-[#F8F6F1]'
                : 'border-[rgba(238,238,238,0.7)] text-[#EEEEEE] bg-[#070709] focus-visible:ring-offset-[#070709]'
            }`}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M12 18V6a6 6 0 1 0 0 12Zm0-14a8 8 0 1 1 0 16 8 8 0 0 1 0-16Z"
              />
            </svg>
          </button>
          {/* Tooltip Lateral */}
          <div
            className={`hidden md:block absolute left-[-80px] top-[7px] px-2 py-1 text-[11px] font-mono rounded opacity-0 pointer-events-none transition-opacity duration-150 group-hover:opacity-100 ${
              isLightMode ? 'bg-[#1A1817] text-[#F8F6F1]' : 'bg-[#1E1E24] text-[#EEEEEE] border border-[#3C3C3C]'
            }`}
          >
            {isLightMode ? 'Atelier' : 'Papel'}
          </div>
        </div>

        {/* 2. Alternador de Grid X-Ray */}
        <div className="relative group flex items-center justify-center min-w-[44px] min-h-[44px]">
          <button
            type="button"
            onClick={() => {
              catanaAudio.playTactileClick(850);
              onToggleGrid();
            }}
            aria-pressed={isGridActive}
            aria-label="Alternar Grid de Precisão X-Ray"
            className={`w-9 h-9 rounded-full border-2 flex items-center justify-center transition-all duration-200 hover:scale-105 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 ${
              isGridActive
                ? isLightMode
                  ? 'border-zinc-900 text-zinc-950 bg-zinc-200 shadow-sm focus-visible:ring-offset-[#F8F6F1]'
                  : 'border-zinc-300 text-zinc-100 bg-white/10 shadow-[0_0_12px_rgba(255,255,255,0.2)] focus-visible:ring-offset-[#070709]'
                : isLightMode
                ? 'border-[#1A1817] text-[#1A1817] bg-[#F8F6F1] focus-visible:ring-offset-[#F8F6F1]'
                : 'border-[rgba(238,238,238,0.7)] text-[#EEEEEE] bg-[#070709] focus-visible:ring-offset-[#070709]'
            }`}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <line x1="9" y1="3" x2="9" y2="21" />
              <line x1="15" y1="3" x2="15" y2="21" />
              <line x1="3" y1="9" x2="21" y2="9" />
              <line x1="3" y1="15" x2="21" y2="15" />
            </svg>
          </button>
          <div
            className={`hidden md:block absolute left-[-96px] top-[7px] px-2 py-1 text-[11px] font-mono rounded opacity-0 pointer-events-none transition-opacity duration-150 group-hover:opacity-100 ${
              isLightMode ? 'bg-[#1A1817] text-[#F8F6F1]' : 'bg-[#1E1E24] text-[#EEEEEE] border border-[#3C3C3C]'
            }`}
          >
            Grid X-Ray
          </div>
        </div>

        {/* 3. Alternador de Síntese Sonora */}
        <div className="relative group flex items-center justify-center min-w-[44px] min-h-[44px]">
          <button
            type="button"
            onClick={() => {
              onToggleAudio();
              catanaAudio.playTactileClick(1000);
            }}
            aria-pressed={isAudioActive}
            aria-label="Alternar Síntese Sonora do Atelier"
            className={`w-9 h-9 rounded-full border-2 flex items-center justify-center transition-all duration-200 hover:scale-105 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 ${
              isAudioActive
                ? isLightMode
                  ? 'border-zinc-900 text-zinc-950 bg-zinc-200 shadow-sm focus-visible:ring-offset-[#F8F6F1]'
                  : 'border-zinc-300 text-zinc-100 bg-white/10 shadow-[0_0_12px_rgba(255,255,255,0.2)] focus-visible:ring-offset-[#070709]'
                : isLightMode
                ? 'border-[#1A1817] text-[#1A1817] bg-[#F8F6F1] focus-visible:ring-offset-[#F8F6F1]'
                : 'border-[rgba(238,238,238,0.7)] text-[#EEEEEE] bg-[#070709] focus-visible:ring-offset-[#070709]'
            }`}
          >
            {isAudioActive ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <line x1="4" y1="9" x2="4" y2="15" />
                <line x1="9" y1="6" x2="9" y2="18" />
                <line x1="14" y1="4" x2="14" y2="20" />
                <line x1="19" y1="8" x2="19" y2="16" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <line x1="4" y1="12" x2="4" y2="12.01" />
                <line x1="9" y1="12" x2="9" y2="12.01" />
                <line x1="14" y1="12" x2="14" y2="12.01" />
                <line x1="19" y1="12" x2="19" y2="12.01" />
              </svg>
            )}
          </button>
          <div
            className={`hidden md:block absolute left-[-102px] top-[7px] px-2 py-1 text-[11px] font-mono rounded opacity-0 pointer-events-none transition-opacity duration-150 group-hover:opacity-100 ${
              isLightMode ? 'bg-[#1A1817] text-[#F8F6F1]' : 'bg-[#1E1E24] text-[#EEEEEE] border border-[#3C3C3C]'
            }`}
          >
            {isAudioActive ? 'Áudio On' : 'Áudio Mudo'}
          </div>
        </div>
      </div>
    </>
  );
};
