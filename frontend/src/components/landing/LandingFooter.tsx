import { Link } from 'react-router-dom';
import { ArrowUp } from 'lucide-react';

export function LandingFooter() {
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <footer className="relative w-full bg-[#18181B] text-[#F5F1EA] px-6 md:px-12 pt-24 pb-12 select-none overflow-hidden">
      {/* Massive Monumental Typography (Cipher.tv Style) */}
      <div className="max-w-7xl mx-auto flex flex-col items-center justify-center text-center py-16 md:py-24 border-b border-white/10">
        <h2 className="font-editorial text-4xl sm:text-6xl md:text-8xl lg:text-[7.5rem] font-light leading-[0.9] tracking-[-0.03em] text-[#F5F1EA]">
          CATANA
        </h2>
        <p className="font-editorial text-xl sm:text-3xl md:text-4xl text-[#A1A1AA] font-light mt-4 tracking-tight">
          FOR{' '}
          <em className="font-normal italic text-[#B08D57]">LUXURY BRANDS</em>{' '}
          AND THEIR{' '}
          <em className="font-normal italic text-[#F5F1EA]">MASTERY</em>.
        </p>

        <div className="mt-10">
          <Link
            to="/studio"
            className="inline-flex items-center gap-3 px-8 py-4 bg-[#F5F1EA] text-[#18181B] font-jost text-xs uppercase tracking-[0.25em] font-medium hover:bg-[#B08D57] transition-colors duration-500 shadow-xl"
          >
            <span>Entrar no Studio de Criação</span>
            <span>→</span>
          </Link>
        </div>
      </div>

      {/* Grid Metadata Footer Links */}
      <div className="max-w-7xl mx-auto pt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 font-mono text-[11px] text-[#71717A] uppercase tracking-wider">
        {/* Col 1: Studio Coordinates */}
        <div>
          <span className="text-white block font-medium mb-2">LOCALIZAÇÃO</span>
          <p className="text-[#A1A1AA] leading-relaxed">
            Studio Catana Technologies
            <br />
            São Paulo · Paris
            <br />
            Av. Paulista // Rue Saint-Honoré
          </p>
        </div>

        {/* Col 2: Architecture & Compliance */}
        <div>
          <span className="text-white block font-medium mb-2">ARQUITETURA</span>
          <p className="text-[#A1A1AA] leading-relaxed">
            12-Col Swiss Grid System
            <br />
            Conformidade LGPD Art. 18
            <br />
            300 DPI Vector Offset Ready
          </p>
        </div>

        {/* Col 3: Navigation Links */}
        <div>
          <span className="text-white block font-medium mb-2">LINKS</span>
          <ul className="space-y-1.5 text-[#A1A1AA]">
            <li>
              <Link to="/studio" className="hover:text-white transition-colors">
                Studio de Criação
              </Link>
            </li>
            <li>
              <Link to="/transparency" className="hover:text-white transition-colors">
                Transparência de IA
              </Link>
            </li>
            <li>
              <Link to="/system-design" className="hover:text-white transition-colors">
                System Design
              </Link>
            </li>
            <li>
              <a
                href="mailto:contato@catana.dev"
                className="hover:text-white transition-colors"
              >
                Contato & Curadoria
              </a>
            </li>
          </ul>
        </div>

        {/* Col 4: Copyright & Back to Top */}
        <div className="flex flex-col justify-between items-start sm:items-end">
          <button
            onClick={scrollToTop}
            className="flex items-center gap-2 text-white hover:text-[#B08D57] transition-colors py-1 group"
          >
            <span>Voltar ao Topo</span>
            <ArrowUp className="w-3.5 h-3.5 transform group-hover:-translate-y-0.5 transition-transform" />
          </button>

          <div className="text-[10px] text-[#71717A] mt-6 sm:mt-0 text-left sm:text-right">
            © 2026 CATANA TECHNOLOGIES
            <br />
            TODOS OS DIREITOS RESERVADOS.
          </div>
        </div>
      </div>
    </footer>
  );
}
