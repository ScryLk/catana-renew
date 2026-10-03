import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';

export function LandingNav() {
  return (
    <header className="fixed top-0 left-0 w-full z-50 py-4 px-6 md:px-12 flex items-center justify-between transition-all duration-300 bg-[#F5F1EA]/90 backdrop-blur-md border-b border-zinc-200/80 text-zinc-950 select-none">
      {/* Brand & Blade Mark */}
      <div className="flex items-center gap-3">
        <Link
          to="/"
          className="group flex items-center gap-2.5 text-zinc-950 tracking-widest uppercase focus:outline-none"
        >
          {/* Stylized Katana Geometric Mark */}
          <div className="relative w-5 h-5 flex items-center justify-center">
            <span className="absolute w-4 h-[2px] bg-zinc-950 -rotate-45 transform transition-transform duration-500 group-hover:scale-x-125" />
            <span className="absolute w-1.5 h-1.5 bg-[#B08D57] rounded-full opacity-70 group-hover:opacity-100 transition-opacity" />
          </div>
          <span className="font-display text-2xl tracking-[0.12em] font-bold leading-none text-zinc-950">
            CATANA
          </span>
        </Link>
      </div>

      {/* Center Status Pill (Desktop) */}
      <div className="hidden lg:flex items-center gap-2.5 font-mono text-[10px] tracking-[0.2em] uppercase text-zinc-600 bg-zinc-100/80 px-3.5 py-1 rounded-full border border-zinc-300/60 shadow-xs">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
        <span className="font-medium">AI ATELIER · 12-COL SWISS · 300 DPI</span>
      </div>

      {/* Navigation Links & Action */}
      <nav className="flex items-center gap-6 md:gap-8 font-sans text-xs tracking-[0.15em] uppercase font-semibold">
        <a
          href="#works"
          className="hidden md:inline-block text-zinc-600 hover:text-zinc-950 transition-colors py-1"
        >
          Coleções
        </a>
        <a
          href="#agents"
          className="hidden md:inline-block text-zinc-600 hover:text-zinc-950 transition-colors py-1"
        >
          Agentes
        </a>
        <a
          href="#craft"
          className="hidden lg:inline-block text-zinc-600 hover:text-zinc-950 transition-colors py-1"
        >
          Craft
        </a>
        <a
          href="#pricing"
          className="hidden md:inline-block text-zinc-600 hover:text-zinc-950 transition-colors py-1"
        >
          Preços
        </a>

        {/* Primary CTA */}
        <Link
          to="/studio"
          className="group relative inline-flex items-center gap-2 py-2 px-4 bg-zinc-950 text-white rounded-sm hover:bg-[#B08D57] transition-all duration-300 shadow-sm"
        >
          <span className="font-semibold tracking-wider text-xs">Studio</span>
          <ArrowUpRight className="w-3.5 h-3.5 transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform duration-300" />
        </Link>
      </nav>
    </header>
  );
}
