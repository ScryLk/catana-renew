import { useRef, useState, useEffect, type FC, type MouseEvent } from 'react';
import { CatanaKnobControls } from './CatanaKnobControls';
import { CatanaAudioPlayer } from './CatanaAudioPlayer';
import { catanaAudio } from './CatanaAudioEngine';
import { Link } from 'react-router-dom';

interface CatanaSynthesizerSectionProps {
  isLightMode: boolean;
  onOpenAuditModal: () => void;
}

export const CatanaSynthesizerSection: FC<CatanaSynthesizerSectionProps> = ({
  isLightMode,
  onOpenAuditModal,
}) => {
  const footerTitleRef = useRef<HTMLDivElement>(null);
  const [cursorPos, setCursorPos] = useState({ x: 300, y: 40 });
  const [isSynthesizing, setIsSynthesizing] = useState(false);

  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    if (!footerTitleRef.current) return;
    const rect = footerTitleRef.current.getBoundingClientRect();
    setCursorPos({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  };

  const handleMouseLeave = () => {
    if (footerTitleRef.current) {
      const rect = footerTitleRef.current.getBoundingClientRect();
      setCursorPos({ x: rect.width / 2, y: rect.height / 2 });
    }
  };

  useEffect(() => {
    if (footerTitleRef.current) {
      const rect = footerTitleRef.current.getBoundingClientRect();
      setCursorPos({ x: rect.width / 2, y: rect.height / 2 });
    }
  }, []);

  const handleSynthesizeSample = () => {
    catanaAudio.playTactileClick(1300);
    setIsSynthesizing(true);
    setTimeout(() => {
      setIsSynthesizing(false);
      onOpenAuditModal();
    }, 600);
  };

  return (
    <footer className="relative max-w-[996px] mx-auto pt-20 pb-24 px-4 flex flex-col items-center select-none z-10">
      {/* Título Monumental da Seção com Efeito Radial de Máscara */}
      <div
        ref={footerTitleRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        className="relative w-fit mx-auto cursor-default"
      >
        <h2
          className={`text-[2.75rem] sm:text-[3.75rem] md:text-[5rem] font-serif font-medium uppercase tracking-[0.02em] leading-[1.05] text-center transition-colors ${
            isLightMode ? 'text-[#1A1817]' : 'text-[#EEEEEE]'
          }`}
        >
          O MOTOR EDITORIAL
        </h2>

        {/* Camada Contornada Iluminada por Lanterna */}
        <h2
          aria-hidden="true"
          className="absolute inset-0 text-[2.75rem] sm:text-[3.75rem] md:text-[5rem] font-serif font-medium uppercase tracking-[0.02em] leading-[1.05] text-center pointer-events-none transition-colors"
          style={{
            color: 'transparent',
            WebkitTextStroke: isLightMode ? '1.5px #52525b' : '1.5px #d4d4d8',
            maskImage: `radial-gradient(circle 200px at ${cursorPos.x}px ${cursorPos.y}px, black 30%, transparent 80%)`,
            WebkitMaskImage: `radial-gradient(circle 200px at ${cursorPos.x}px ${cursorPos.y}px, black 30%, transparent 80%)`,
          }}
        >
          O MOTOR EDITORIAL
        </h2>
      </div>

      {/* Subtítulo Descritivo */}
      <p
        className={`max-w-[620px] mt-4 text-center text-base sm:text-lg font-sans font-light leading-relaxed tracking-normal px-4 transition-colors ${
          isLightMode ? 'text-[#736E65]' : 'text-[rgba(238,238,238,0.7)]'
        }`}
      >
        Parâmetros táteis de modulação de arte, respiro negativo e harmonia compositiva A4.
      </p>

      {/* Controles Rotativos Paramétricos (Knobs de Respiro, Densidade e Tensão) */}
      <div className="mt-8 flex flex-col items-center">
        <CatanaKnobControls isLightMode={isLightMode} />

        {/* Botão de Análise / Síntese com Barras Equalizadoras Animadas */}
        <div className="mt-4">
          <button
            type="button"
            onClick={handleSynthesizeSample}
            disabled={isSynthesizing}
            aria-busy={isSynthesizing}
            className={`flex items-center gap-3 px-6 py-2.5 min-h-[44px] rounded-full border-2 font-mono text-xs uppercase tracking-widest font-medium transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 ${
              isLightMode
                ? 'border-[#1A1817] text-[#1A1817] hover:bg-[#1A1817] hover:text-[#F8F6F1] focus-visible:ring-offset-[#F8F6F1]'
                : 'border-[#EEEEEE] text-[#EEEEEE] hover:bg-[#EEEEEE] hover:text-[#070709] focus-visible:ring-offset-[#070709]'
            }`}
          >
            {/* Ícone de Equalizador Animado */}
            <div className="flex items-end gap-1 h-3.5" aria-hidden="true">
              <span className="w-[2px] h-3 bg-current animate-pulse" />
              <span className="w-[2px] h-2 bg-current animate-pulse [animation-delay:150ms]" />
              <span className="w-[2px] h-3.5 bg-current animate-pulse [animation-delay:300ms]" />
              <span className="w-[2px] h-1.5 bg-current animate-pulse [animation-delay:75ms]" />
            </div>
            <span>{isSynthesizing ? 'Calibrando...' : 'Sintetizar Amostra'}</span>
          </button>
        </div>
      </div>

      {/* Reprodutor Sonoro Integrado com Web Audio API */}
      <div className="w-full mt-10">
        <CatanaAudioPlayer isLightMode={isLightMode} />
      </div>

      {/* Rodapé de Créditos e Links de Navegação Editorial */}
      <div
        className={`w-full pt-16 mt-8 border-t flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-mono ${
          isLightMode
            ? 'border-zinc-300 text-zinc-600'
            : 'border-[rgba(136,136,136,0.15)] text-zinc-400'
        }`}
      >
        <div className="flex items-center gap-2">
          <img
            src={isLightMode ? '/logo/catana_logo_dark_hd.png' : '/logo/catana_logo_white_hd.png'}
            alt="Catana"
            className="h-4 w-auto object-contain opacity-75"
          />
          <span className="text-[10px]">2.0</span>
          <span>·</span>
          <span>O ATELIER EDITORIAL</span>
        </div>

        <nav className="flex items-center gap-6" aria-label="Links Institucionais">
          <Link
            to="/studio"
            onClick={() => catanaAudio.playTactileClick(1000)}
            className={`transition-colors focus-visible:outline-none focus-visible:ring-1 rounded px-1 ${
              isLightMode
                ? 'hover:text-zinc-950 text-zinc-700 focus-visible:ring-zinc-600'
                : 'hover:text-zinc-200 text-zinc-400 focus-visible:ring-zinc-400'
            }`}
          >
            Studio Canvas
          </Link>
          <Link
            to="/transparency"
            onClick={() => catanaAudio.playTactileClick(1000)}
            className={`transition-colors focus-visible:outline-none focus-visible:ring-1 rounded px-1 ${
              isLightMode
                ? 'hover:text-zinc-950 text-zinc-700 focus-visible:ring-zinc-600'
                : 'hover:text-zinc-200 text-zinc-400 focus-visible:ring-zinc-400'
            }`}
          >
            Transparência de IA
          </Link>
          <button
            type="button"
            onClick={() => {
              catanaAudio.playTactileClick(1000);
              onOpenAuditModal();
            }}
            className={`transition-colors focus-visible:outline-none focus-visible:ring-1 rounded px-1 ${
              isLightMode
                ? 'hover:text-zinc-950 text-zinc-700 focus-visible:ring-zinc-600'
                : 'hover:text-zinc-200 text-zinc-400 focus-visible:ring-zinc-400'
            }`}
          >
            Auditoria Técnica
          </button>
        </nav>
      </div>
    </footer>
  );
};
