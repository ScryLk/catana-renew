import React, { useState } from 'react';
import { catanaAudio } from './CatanaAudioEngine';

interface CatanaSignatureLogoProps {
  isLightMode: boolean;
  size?: 'sm' | 'md' | 'lg' | 'hero';
  showBadge?: boolean;
  showSubtitle?: boolean;
  subtitleText?: string;
  interactive?: boolean;
  className?: string;
}

export const CatanaSignatureLogo: React.FC<CatanaSignatureLogoProps> = ({
  isLightMode,
  size = 'hero',
  showBadge = true,
  showSubtitle = true,
  subtitleText = 'AUTONOMOUS ATELIER',
  interactive = true,
  className = '',
}) => {
  const [animKey, setAnimKey] = useState<number>(0);
  const [isHovered, setIsHovered] = useState<boolean>(false);

  const handleReplay = () => {
    if (!interactive) return;
    setAnimKey((prev) => prev + 1);
    catanaAudio.playTactileClick(940);
  };

  const svgDimensions = {
    sm: 'h-8 sm:h-10 w-auto',
    md: 'h-12 sm:h-14 w-auto',
    lg: 'h-16 sm:h-20 w-auto',
    hero: 'h-14 sm:h-20 md:h-28 w-auto',
  }[size];

  return (
    <div
      className={`relative inline-flex flex-col items-center select-none group ${className}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <style>{`
        @keyframes catanaStrokeDraw {
          from {
            stroke-dashoffset: 1px;
          }
          to {
            stroke-dashoffset: 0;
          }
        }
        @keyframes catanaAmbientPulse {
          0%, 100% {
            opacity: 0.22;
            transform: scale(0.96);
          }
          50% {
            opacity: 0.45;
            transform: scale(1.05);
          }
        }
        .catana-draw-main {
          stroke-dasharray: 1;
          stroke-dashoffset: 1px;
          animation: catanaStrokeDraw 1.5s cubic-bezier(0.45, 0, 0.25, 1) 0.15s forwards;
        }
        .catana-draw-cross {
          stroke-dasharray: 1;
          stroke-dashoffset: 1px;
          animation: catanaStrokeDraw 0.28s ease-out 1.65s forwards;
        }
      `}</style>

      {/* Rótulo Superior (AUTONOMOUS ATELIER) */}
      {showSubtitle && (
        <span
          className={`font-mono text-[9px] sm:text-[10px] tracking-[0.3em] uppercase mb-2.5 transition-colors ${
            isLightMode ? 'text-zinc-500' : 'text-zinc-400'
          }`}
        >
          {subtitleText}
        </span>
      )}

      {/* Assinatura Vetorial Interativa com Animação de Caligrafia e Iluminação de Fundo */}
      <div
        role={interactive ? 'button' : undefined}
        tabIndex={interactive ? 0 : undefined}
        onClick={handleReplay}
        onKeyDown={(e) => {
          if (interactive && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            handleReplay();
          }
        }}
        title={interactive ? 'Clique para redesenhar a assinatura' : undefined}
        aria-label="Catana Atelier 2.0"
        className={`relative flex items-end justify-center gap-3 sm:gap-4 transition-transform duration-300 ${
          interactive ? 'cursor-pointer hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 rounded-sm' : ''
        }`}
      >
        {/* Halo de Iluminação Atmosférica Volumétrica (Sem pixelização) */}
        <div
          aria-hidden="true"
          className={`absolute -inset-4 sm:-inset-8 pointer-events-none rounded-full blur-2xl transition-opacity duration-700 ${
            isLightMode
              ? 'bg-[radial-gradient(circle_at_center,rgba(0,0,0,0.06)_0,transparent_75%)]'
              : 'bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.12)_0,transparent_75%)]'
          }`}
          style={{ animation: 'catanaAmbientPulse 6s ease-in-out infinite' }}
        />

        {/* SVG Cursivo Idêntico à Splash Screen do Catana 2.0 */}
        <svg
          key={animKey}
          viewBox="40 10 640 170"
          className={`${svgDimensions} relative z-10 transition-colors duration-300 drop-shadow-[0_4px_24px_rgba(0,0,0,0.35)] ${
            isLightMode ? 'text-[#1A1817]' : 'text-[#EEEEEE]'
          }`}
          fill="none"
          stroke="currentColor"
          strokeWidth="7"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          {/* Traço Cursivo Contínuo Principal */}
          <path
            className="catana-draw-main"
            pathLength="1"
            d="M 132 96 C 124 82 104 76 88 86 C 70 97 62 122 74 138 C 84 150 104 148 116 136 C 128 148 146 142 158 120 C 170 100 190 90 206 90 C 194 78 172 80 160 94 C 148 108 148 128 160 140 C 170 149 186 145 196 132 C 202 124 206 108 208 92 C 206 112 206 130 214 142 C 222 152 236 146 244 128 C 256 102 270 66 282 44 C 280 70 276 110 278 132 C 280 148 294 152 308 138 C 322 124 344 100 384 90 C 370 78 348 80 336 94 C 324 108 324 128 336 140 C 346 149 362 145 372 132 C 378 124 382 108 384 92 C 382 112 382 130 390 142 C 398 152 412 146 420 128 C 428 110 438 96 446 88 C 448 106 446 128 448 142 C 458 116 472 94 486 88 C 494 84 498 92 498 104 C 498 120 496 132 502 142 C 508 150 520 146 528 128 C 536 112 560 92 592 90 C 578 78 556 80 544 94 C 532 108 532 128 544 140 C 554 149 570 145 580 132 C 586 124 590 108 592 92 C 590 112 590 130 598 142 C 608 154 626 148 640 124"
          />
          {/* Traço Cruzado da Letra 't' */}
          <path
            className="catana-draw-cross"
            pathLength="1"
            d="M 250 76 C 272 68 300 64 328 70"
          />
        </svg>

        {/* Insígnia Versão 2.0 com Pulso Determinístico */}
        {showBadge && (
          <span
            className={`inline-flex items-center gap-1.5 font-mono text-xs sm:text-sm font-semibold tracking-widest px-2.5 py-0.5 rounded border mb-2 sm:mb-4 transition-colors z-10 ${
              isLightMode
                ? 'bg-zinc-100 border-zinc-300 text-zinc-800'
                : 'bg-zinc-800 border-zinc-700 text-zinc-300'
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                isHovered ? 'bg-emerald-400 animate-ping' : 'bg-emerald-500/80 animate-pulse'
              }`}
            />
            2.0
          </span>
        )}
      </div>
    </div>
  );
};
