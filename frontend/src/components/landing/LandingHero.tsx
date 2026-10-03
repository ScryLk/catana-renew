import { useEffect, useState } from 'react';
import { ArrowDown } from 'lucide-react';
import { Link } from 'react-router-dom';

export function LandingHero() {
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Compute scroll-linked blur and opacity
  const blurAmount = Math.min(10, scrollY * 0.02);
  const opacityAmount = Math.max(0, 1 - scrollY * 0.002);
  const scaleAmount = Math.max(0.96, 1 - scrollY * 0.0003);

  return (
    <section className="relative w-full min-h-[100svh] flex flex-col justify-between bg-[#F5F1EA] text-zinc-950 px-6 md:px-12 pt-32 pb-10 overflow-hidden select-none border-b border-zinc-200">
      {/* Background Architectural Grid Lines */}
      <div className="absolute inset-0 pointer-events-none grid grid-cols-6 md:grid-cols-12 opacity-20">
        {Array.from({ length: 12 }).map((_, i) => (
          <div
            key={i}
            className="border-r border-zinc-400/20 h-full first:border-l"
          />
        ))}
      </div>

      {/* Top Metadata Header */}
      <div
        className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 font-mono text-[10px] md:text-xs tracking-[0.2em] uppercase text-zinc-500 font-medium"
        style={{
          opacity: opacityAmount,
          transform: `scale(${scaleAmount})`,
          filter: `blur(${blurAmount}px)`,
          transition: 'filter 0.1s ease-out, transform 0.1s ease-out',
        }}
      >
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 bg-[#B08D57] rounded-none" />
          <span className="text-zinc-700">EST. 2026 · HIGH EDITORIAL CATALOG ENGINE</span>
        </div>
        <div className="flex items-center gap-6 text-zinc-600">
          <span>SWISS GRID 12-COL</span>
          <span>A4 · 300 DPI VECTOR</span>
        </div>
      </div>

      {/* Monumental Central Manifesto */}
      <div
        className="relative z-10 my-auto py-12 md:py-18 flex flex-col items-start max-w-6xl"
        style={{
          opacity: opacityAmount,
          transform: `scale(${scaleAmount}) translateY(${scrollY * 0.15}px)`,
          filter: `blur(${blurAmount}px)`,
          transition: 'filter 0.1s ease-out',
        }}
      >
        <h1 className="font-display text-4xl sm:text-6xl md:text-7xl lg:text-[5.5rem] leading-[1.02] tracking-tight font-bold text-zinc-950">
          A lâmina que corta o ruído visual.
          <br />
          <span className="block mt-3 sm:mt-5 text-zinc-600 font-normal">
            Catálogos onde cada milímetro é{' '}
            <em className="font-medium italic text-zinc-950 font-display">
              intenção
            </em>
            , forma e{' '}
            <em className="font-medium italic text-[#B08D57] font-display">
              alta costura
            </em>
            .
          </span>
        </h1>

        <div className="mt-8 md:mt-12 flex flex-col sm:flex-row items-start sm:items-center gap-6 md:gap-10">
          <p className="font-sans text-sm md:text-base text-zinc-600 max-w-xl leading-relaxed font-normal">
            A morte definitiva dos PDFs corporativos genéricos. O primeiro atelier
            digital alimentado por um conselho de agentes autônomos de IA que
            esculpem inventários de produtos em publicações editoriais de alto padrão.
          </p>

          <Link
            to="/studio"
            className="group inline-flex items-center gap-3 px-7 py-3.5 bg-zinc-950 text-white font-sans text-xs uppercase tracking-[0.2em] font-semibold hover:bg-[#B08D57] transition-all duration-300 shadow-md"
          >
            <span>Criar Catálogo no Studio</span>
            <span className="text-[#B08D57] group-hover:text-white transition-colors">
              →
            </span>
          </Link>
        </div>
      </div>

      {/* Bottom Coordinates & Anchor Link */}
      <div className="relative z-10 flex items-end justify-between pt-6 border-t border-zinc-300/80">
        <div className="flex flex-col gap-1 font-mono text-[10px] tracking-[0.2em] uppercase text-zinc-500">
          <span>INDEX: CATANA-PUBLICATIONS-V2</span>
          <span className="text-zinc-900 font-semibold">
            6 CANONICAL TEMPLATES READY FOR CRAFT
          </span>
        </div>

        <a
          href="#works"
          className="group flex items-center gap-3 font-sans text-xs tracking-[0.2em] uppercase font-semibold text-zinc-900 hover:text-[#B08D57] transition-colors"
        >
          <span>Explorar Coleções</span>
          <div className="w-6 h-6 rounded-full border border-zinc-400 flex items-center justify-center group-hover:border-[#B08D57] transition-colors">
            <ArrowDown className="w-3 h-3 transform group-hover:translate-y-0.5 transition-transform text-zinc-800 group-hover:text-[#B08D57]" />
          </div>
        </a>
      </div>
    </section>
  );
}
