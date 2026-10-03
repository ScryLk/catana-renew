import React, { useEffect, useState } from 'react';
import { catanaAudio } from './CatanaAudioEngine';

interface CatanaFloatingButtonProps {
  isLightMode: boolean;
  onSlideCards: () => void;
  onOpenAuditModal: () => void;
}

export const CatanaFloatingButton: React.FC<CatanaFloatingButtonProps> = ({
  isLightMode,
  onSlideCards,
  onOpenAuditModal,
}) => {
  const [scrollPercent, setScrollPercent] = useState<number>(0);
  const [isScrolling, setIsScrolling] = useState<boolean>(false);
  const [isHovered, setIsHovered] = useState<boolean>(false);

  useEffect(() => {
    let scrollTimeout: number;

    const handleScroll = () => {
      const scrollY = window.scrollY;
      const docHeight = document.body.offsetHeight - window.innerHeight;
      const pct = docHeight > 0 ? Math.min(100, Math.max(0, Math.round((scrollY / docHeight) * 100))) : 0;

      setScrollPercent(pct);
      setIsScrolling(true);

      clearTimeout(scrollTimeout);
      scrollTimeout = window.setTimeout(() => {
        setIsScrolling(false);
      }, 250);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      clearTimeout(scrollTimeout);
    };
  }, []);

  const handleClick = () => {
    catanaAudio.playTactileClick(1150);
    // Se estiver na área intermediária dos cards, desliza o carrossel; caso contrário, abre o modal
    if (scrollPercent >= 20 && scrollPercent <= 80) {
      onSlideCards();
    } else {
      onOpenAuditModal();
    }
  };

  const isSlideMode = scrollPercent >= 15 && scrollPercent <= 85;

  return (
    <aside
      className="hidden md:block fixed right-6 top-[55%] z-40 select-none"
      aria-label="Controle de Navegação Flutuante"
    >
      <div className="relative group">
        <button
          type="button"
          onClick={handleClick}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          aria-label={isSlideMode ? 'Deslizar Pranchetas' : 'Ver Métricas do Atelier'}
          className={`w-[52px] h-[52px] rounded-full flex items-center justify-center transition-all duration-200 shadow-[0_4px_16px_rgba(0,0,0,0.35)] hover:-translate-y-1 active:translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 ${
            isLightMode
              ? 'bg-[#1A1817] text-[#F8F6F1] border border-[#333333] focus-visible:ring-offset-[#F8F6F1]'
              : 'bg-[#EEEEEE] text-[#070709] border border-[#CCCCCC] focus-visible:ring-offset-[#070709]'
          }`}
        >
          {/* Se estiver ocorrendo scroll, exibe o percentual numérico */}
          {isScrolling && !isHovered ? (
            <span className="font-mono text-xs font-semibold tracking-tighter">
              {scrollPercent}%
            </span>
          ) : isSlideMode ? (
            /* Ícone de Slide de Prancheta */
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M5 12h14" />
              <path d="m12 5 7 7-7 7" />
            </svg>
          ) : (
            /* Ícone de Bússola / Info Editorial */
            <svg width="22" height="22" viewBox="0 0 32 32" fill="currentColor">
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M3.064 16.093a.1.1 0 0 1 0-.186l12.722-4.893a.1.1 0 0 1 .071 0l12.722 4.893a.1.1 0 0 1 0 .186l-12.722 4.893a.1.1 0 0 1-.071 0L3.064 16.093ZM15.821 18a2 2 0 1 1 0-4 2 2 0 0 1 0 4Z"
              />
            </svg>
          )}
        </button>

        {/* Tooltip Lateral */}
        <div
          className={`absolute right-[64px] top-[14px] px-2.5 py-1 text-[11px] font-mono rounded opacity-0 pointer-events-none transition-opacity duration-150 group-hover:opacity-100 whitespace-nowrap shadow-md ${
            isLightMode
              ? 'bg-[#1A1817] text-[#F8F6F1]'
              : 'bg-[#1E1E24] text-[#EEEEEE] border border-[#3C3C3C]'
          }`}
        >
          {isSlideMode ? 'Deslizar Cards' : 'Auditoria Editorial'}
        </div>
      </div>
    </aside>
  );
};
