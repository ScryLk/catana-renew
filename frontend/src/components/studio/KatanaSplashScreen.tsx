import React, { useEffect, useState } from 'react';

interface KatanaSplashScreenProps {
  onComplete?: () => void;
  durationMs?: number;
  allowSkip?: boolean;
}

export const KatanaSplashScreen: React.FC<KatanaSplashScreenProps> = ({
  onComplete,
  durationMs = 3400,
  allowSkip = true,
}) => {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      onComplete?.();
    }, durationMs);

    return () => clearTimeout(timer);
  }, [durationMs, onComplete]);

  const handleSkip = () => {
    if (!allowSkip) return;
    setIsVisible(false);
    onComplete?.();
  };

  if (!isVisible) return null;

  return (
    <>
      <style>{`
        @keyframes introDraw {
          to {
            stroke-dashoffset: 0;
          }
        }
        @keyframes introExit {
          to {
            transform: translateY(-100%);
          }
        }
        .katana-intro-overlay {
          will-change: transform;
          animation: introExit 0.7s cubic-bezier(0.76, 0, 0.24, 1) 2.75s forwards;
        }
        .katana-intro-stroke {
          stroke-dasharray: 1;
          stroke-dashoffset: 1px;
        }
        .katana-intro-stroke-main {
          animation: introDraw 1.5s cubic-bezier(0.45, 0, 0.3, 1) 0.35s forwards;
        }
        .katana-intro-stroke-cross {
          animation: introDraw 0.25s ease-out 1.9s forwards;
        }
      `}</style>

      <div
        role="dialog"
        tabIndex={0}
        aria-label="Carregando Katana 2.0"
        onClick={handleSkip}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') {
            e.preventDefault();
            handleSkip();
          }
        }}
        className="katana-intro-overlay fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#131315] select-none cursor-pointer overflow-hidden outline-none"
      >
        {/* Ambient background */}
        <div className="absolute inset-0 pointer-events-none opacity-20 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.04)_0,transparent_70%)]" />

        {/* Cursive Signature Stroke Animation (from usecatana.com.br) */}
        <div className="relative z-10 flex flex-col items-center">
          <svg
            viewBox="40 10 640 170"
            className="w-[min(76vw,560px)] text-[#e9e9ec] drop-shadow-[0_4px_24px_rgba(0,0,0,0.5)]"
            fill="none"
            stroke="currentColor"
            strokeWidth="7"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-label="catana"
          >
            {/* Main cursive body path */}
            <path
              className="katana-intro-stroke katana-intro-stroke-main"
              pathLength="1"
              d="M 132 96 C 124 82 104 76 88 86 C 70 97 62 122 74 138 C 84 150 104 148 116 136 C 128 148 146 142 158 120 C 170 100 190 90 206 90 C 194 78 172 80 160 94 C 148 108 148 128 160 140 C 170 149 186 145 196 132 C 202 124 206 108 208 92 C 206 112 206 130 214 142 C 222 152 236 146 244 128 C 256 102 270 66 282 44 C 280 70 276 110 278 132 C 280 148 294 152 308 138 C 322 124 344 100 384 90 C 370 78 348 80 336 94 C 324 108 324 128 336 140 C 346 149 362 145 372 132 C 378 124 382 108 384 92 C 382 112 382 130 390 142 C 398 152 412 146 420 128 C 428 110 438 96 446 88 C 448 106 446 128 448 142 C 458 116 472 94 486 88 C 494 84 498 92 498 104 C 498 120 496 132 502 142 C 508 150 520 146 528 128 C 536 112 560 92 592 90 C 578 78 556 80 544 94 C 532 108 532 128 544 140 C 554 149 570 145 580 132 C 586 124 590 108 592 92 C 590 112 590 130 598 142 C 608 154 626 148 640 124"
            />
            {/* Cross stroke on 't' */}
            <path
              className="katana-intro-stroke katana-intro-stroke-cross"
              pathLength="1"
              d="M 250 76 C 272 68 300 64 328 70"
            />
          </svg>

          {/* Subtitle / Studio indicator */}
          <div className="mt-4 flex items-center gap-2 text-xs font-mono tracking-[0.25em] text-[#8e8e93] uppercase opacity-80">
            <span>Studio</span>
            <span className="size-1.5 rounded-full bg-zinc-400 animate-ping" />
            <span className="text-zinc-500">v2.0</span>
          </div>
        </div>

        {/* Skip hint */}
        {allowSkip && (
          <div className="absolute bottom-8 text-[11px] font-mono tracking-wider text-zinc-500 hover:text-zinc-300 transition-colors">
            clique para entrar
          </div>
        )}
      </div>
    </>
  );
};
