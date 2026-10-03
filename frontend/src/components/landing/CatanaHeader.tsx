import { useEffect, useState, type FC } from 'react';
import { Link } from 'react-router-dom';
import { catanaAudio } from './CatanaAudioEngine';

interface CatanaHeaderProps {
  isLightMode?: boolean;
}

export const CatanaHeader: FC<CatanaHeaderProps> = ({ isLightMode = false }) => {
  const [dateText, setDateText] = useState('22 SET 2026');
  const [isScrambling, setIsScrambling] = useState(false);

  // Efeito de decodificação tipográfica / scramble como na referência
  useEffect(() => {
    const now = new Date();
    const day = ('0' + now.getDate()).slice(-2);
    const months = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];
    const month = months[now.getMonth()];
    const year = now.getFullYear();
    const finalDate = `${day} ${month} ${year} · CURITIBA BR`;

    const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ!#*_-+=';
    let iteration = 0;
    setIsScrambling(true);

    const interval = setInterval(() => {
      setDateText(
        finalDate
          .split('')
          .map((char, index) => {
            if (index < iteration) return char;
            if (char === ' ' || char === '·') return char;
            return chars[Math.floor(Math.random() * chars.length)];
          })
          .join('')
      );

      if (iteration >= finalDate.length) {
        clearInterval(interval);
        setIsScrambling(false);
      }
      iteration += 1.5;
    }, 40);

    return () => clearInterval(interval);
  }, []);

  return (
    <header className="relative max-w-[996px] h-6 mx-auto my-6 flex items-center justify-between px-4 z-20 select-none">
      {/* Linha Milimétrica Horizontal (99.5%) com Ticks nas Pontas */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-[99.5%] h-[1px] bg-[rgba(136,136,136,0.2)] relative">
          {/* Tick Esquerdo */}
          <span className="absolute -left-[1px] -top-[4px] w-[2px] h-[9px] bg-[rgba(136,136,136,0.35)]" />
          {/* Tick Direito */}
          <span className="absolute -right-[1px] -top-[4px] w-[2px] h-[9px] bg-[rgba(136,136,136,0.35)]" />
        </div>
      </div>

      {/* Badge de Data com Recorte no Fundo */}
      <div
        className={`relative z-10 px-3 py-0.5 text-[11px] font-mono tracking-[0.18em] uppercase transition-colors ${
          isLightMode ? 'bg-[#F8F6F1] text-[#1A1817]' : 'bg-[#070709] text-[#EEEEEE]'
        }`}
      >
        <time className={isScrambling ? (isLightMode ? 'text-zinc-950 font-semibold' : 'text-zinc-300 font-semibold') : ''}>
          {dateText}
        </time>
      </div>

      {/* Logomarca Oficial Catana à Direita */}
      <div
        className={`relative z-10 px-3 py-0.5 transition-colors ${
          isLightMode ? 'bg-[#F8F6F1]' : 'bg-[#070709]'
        }`}
      >
        <Link
          to="/studio"
          onClick={() => catanaAudio.playTactileClick(1100)}
          className={`flex items-center gap-2 group transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 rounded ${
            isLightMode ? 'focus-visible:ring-offset-[#F8F6F1]' : 'focus-visible:ring-offset-[#070709]'
          }`}
          aria-label="Ir para o Catana Studio"
        >
          <img
            src={isLightMode ? '/logo/catana_logo_dark_hd.png' : '/logo/catana_logo_white_hd.png'}
            alt="Catana"
            className="h-6 w-auto object-contain transition-opacity duration-200 group-hover:opacity-75"
          />
          <span
            className={`text-[9px] font-mono tracking-widest uppercase px-1.5 py-0.5 rounded border transition-colors ${
              isLightMode
                ? 'bg-black/5 border-black/10 text-[#736E65] group-hover:border-[#1A1817] group-hover:text-[#1A1817]'
                : 'bg-white/5 border-white/10 text-[rgba(238,238,238,0.6)] group-hover:border-[#EEEEEE] group-hover:text-[#EEEEEE]'
            }`}
          >
            2.0
          </span>
        </Link>
      </div>
    </header>
  );
};
