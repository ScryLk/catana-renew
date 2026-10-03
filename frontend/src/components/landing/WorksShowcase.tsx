import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';

interface WorkItem {
  id: string;
  index: string;
  title: string;
  brand: string;
  segment: string;
  badge: string;
  aspectRatio: string;
  image: string;
  viewUrl: string;
  details: string;
}

const WORKS_DATA: {
  duo1: [WorkItem, WorkItem];
  solo1: WorkItem;
  default1: [WorkItem, WorkItem, WorkItem];
} = {
  duo1: [
    {
      id: 'maison-verdana',
      index: '001',
      title: 'Maison Verdana — Coleção Inverno 2026',
      brand: 'Maison Verdana',
      segment: 'Moda & Alta Costura',
      badge: 'Luxe · Noir & Or',
      aspectRatio: 'aspect-[1.4]',
      image: 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=1200&q=85',
      viewUrl: '/view/maison_verdana',
      details: 'Grid Suíço 12-col · Lã Fria e Seda · 6 Páginas A4',
    },
    {
      id: 'aether-labs',
      index: '002',
      title: 'Aether Labs — Hardware Minimalista',
      brand: 'Aether Labs',
      segment: 'Tech & Arquitetura de Dispositivos',
      badge: 'Platinum & Zinc',
      aspectRatio: 'aspect-[2/3]',
      image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=1200&q=85',
      viewUrl: '/view/aether_labs',
      details: 'Matriz 2x2 · Alumínio Usinado CNC · 4 Páginas A4',
    },
  ],
  solo1: {
    id: 'vanguard-pack',
    index: '003',
    title: 'Vanguard Pack — Soluções Sustentáveis B2B',
    brand: 'Vanguard Pack',
    segment: 'Embalagens & Food Service',
    badge: 'Grade Comercial B2B',
    aspectRatio: 'aspect-[16/9]',
    image: 'https://images.unsplash.com/photo-1589939705384-5185137a7f0f?w=1600&q=85',
    viewUrl: '/view/vanguard_pack',
    details: 'Spread Panorâmico · Fechamento Hermético · 8 Páginas A4',
  },
  default1: [
    {
      id: 'atelier-cacao',
      index: '004',
      title: 'Atelier Cacao — Confeitaria Fina & Terroir',
      brand: 'Atelier Cacao',
      segment: 'Gastronomia Gourmet',
      badge: 'Editorial Duo Lookbook',
      aspectRatio: 'aspect-[3/4]',
      image: 'https://images.unsplash.com/photo-1541781774459-bb2af2f05b55?w=1200&q=85',
      viewUrl: '/view/atelier_cacao',
      details: 'Cacau Selvagem 72% · Tipografia Orgânica · 4 Páginas A4',
    },
    {
      id: 'studio-noir',
      index: '005',
      title: 'Studio Noir — Mobiliário Escultural',
      brand: 'Studio Noir',
      segment: 'Design Autoral & Interiores',
      badge: 'Luxe Minimal',
      aspectRatio: 'aspect-[16/10]',
      image: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=1200&q=85',
      viewUrl: '/view/studio_noir',
      details: 'Monografia Editorial · Madeira Maciça Carbonizada · 6 Páginas A4',
    },
    {
      id: 'botanica-parfum',
      index: '006',
      title: 'Botanica Atelier — Perfumaria Rara',
      brand: 'Botanica Atelier',
      segment: 'Fragrâncias de Nicho',
      badge: 'Single Hero Showcase',
      aspectRatio: 'aspect-[1/1]',
      image: 'https://images.unsplash.com/photo-1592945403244-b3fbafd7f539?w=1200&q=85',
      viewUrl: '/view/botanica_parfum',
      details: 'Extratos Botânicos Puros · Frascos em Cristal Escuro · 4 Páginas A4',
    },
  ],
};

export function WorksShowcase() {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const renderWorkCard = (work: WorkItem, className = '') => {
    const isFaded = hoveredId !== null && hoveredId !== work.id;

    return (
      <div
        key={work.id}
        className={`catana-discover-item group flex flex-col gap-3 ${
          isFaded ? 'is-faded' : ''
        } ${className}`}
        onMouseEnter={() => setHoveredId(work.id)}
        onMouseLeave={() => setHoveredId(null)}
        data-cursor-label={`${work.index} · VIEW`}
      >
        <Link
          to="/studio"
          className="relative block w-full overflow-hidden bg-[#E4E0D6] border border-[#18181B]/15 outline-none focus:outline-none focus:ring-0"
        >
          {/* Image Container with Zoom */}
          <div className={`${work.aspectRatio} w-full overflow-hidden`}>
            <img
              src={work.image}
              alt={work.title}
              loading="lazy"
              className="catana-media-zoom w-full h-full object-cover object-center"
            />
          </div>

          {/* Hover Overlay Badge */}
          <div className="absolute top-4 left-4 font-mono text-[9px] tracking-[0.2em] uppercase px-2.5 py-1 bg-[#18181B]/80 text-[#F5F1EA] backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            {work.badge}
          </div>

          {/* Corner Arrow Indicator */}
          <div className="absolute top-4 right-4 w-7 h-7 rounded-none bg-[#F5F1EA] text-[#18181B] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-x-2 -translate-y-2 group-hover:translate-x-0 group-hover:translate-y-0">
            <ArrowUpRight className="w-3.5 h-3.5" />
          </div>
        </Link>

        {/* Minimal Metadata Strip (Cipher.tv Style) */}
        <div className="flex items-baseline justify-between pt-1 font-mono text-xs uppercase tracking-wider text-[#18181B]">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-[#B08D57] rounded-none inline-block" />
            <span className="text-[#71717A] text-[10px]">{work.index}</span>
            <span className="font-editorial text-base normal-case tracking-normal font-normal text-[#18181B]">
              {work.brand}
            </span>
          </div>
          <span className="text-[10px] text-[#71717A] hidden sm:inline-block">
            {work.segment}
          </span>
        </div>

        <p className="font-jost text-xs text-[#71717A] tracking-wide">
          {work.details}
        </p>
      </div>
    );
  };

  return (
    <section
      id="works"
      className="relative w-full bg-[#F5F1EA] text-[#18181B] px-6 md:px-12 py-24 md:py-36 border-b border-[#E4E0D6]"
    >
      {/* Section Header with Micro Number */}
      <div className="max-w-6xl mb-16 md:mb-24">
        <div className="flex items-center gap-2 font-mono text-[10px] tracking-[0.25em] uppercase text-[#71717A] mb-3">
          <span className="w-1.5 h-1.5 bg-[#18181B]" />
          <span>PORTFÓLIO EDITORIAL · CATANA WORKS</span>
        </div>
        <h2 className="font-editorial text-3xl sm:text-5xl md:text-6xl font-light tracking-[-0.02em] leading-tight text-[#18181B]">
          Cada publicação é um{' '}
          <em className="font-normal italic text-[#B08D57]">manifesto</em> de
          marca.
        </h2>
        <p className="font-jost text-sm md:text-base text-[#52525B] mt-4 max-w-xl">
          Nenhum catálogo é igual ao outro. O motor de IA orquestra o equilíbrio
          entre arquitetura de grade, peso de imagem e densidade tipográfica.
        </p>
      </div>

      {/* RHYTHMIC LAYOUT 1: DUO (Asymmetric Staggered) */}
      <div className="w-full max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start gap-12 md:gap-16 mb-28 md:mb-40">
        <div className="w-full md:w-[58%]">
          {renderWorkCard(WORKS_DATA.duo1[0])}
        </div>
        <div className="w-full md:w-[36%] md:mt-36">
          {renderWorkCard(WORKS_DATA.duo1[1])}
        </div>
      </div>

      {/* RHYTHMIC LAYOUT 2: SOLO (Cinematic Full Spread) */}
      <div className="w-full max-w-5xl mx-auto mb-28 md:mb-40">
        {renderWorkCard(WORKS_DATA.solo1)}
      </div>

      {/* RHYTHMIC LAYOUT 3: DEFAULT (Triad Composition) */}
      <div className="w-full max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-stretch gap-12 md:gap-16">
        {/* Left Large Portrait Item */}
        <div className="w-full md:w-[46%]">
          {renderWorkCard(WORKS_DATA.default1[0])}
        </div>

        {/* Right Stacked Column */}
        <div className="w-full md:w-[46%] flex flex-col justify-between gap-16 md:gap-20">
          <div>{renderWorkCard(WORKS_DATA.default1[1])}</div>
          <div className="w-full sm:w-[75%] sm:self-end">
            {renderWorkCard(WORKS_DATA.default1[2])}
          </div>
        </div>
      </div>

      {/* Bottom Action Note */}
      <div className="mt-24 md:mt-36 text-center">
        <Link
          to="/studio"
          className="inline-flex items-center gap-3 font-jost text-xs uppercase tracking-[0.25em] font-medium py-3 px-8 border border-[#18181B] hover:bg-[#18181B] hover:text-[#F5F1EA] transition-all duration-300"
        >
          <span>Abrir o Studio & Criar Meu Catálogo</span>
          <span>→</span>
        </Link>
      </div>
    </section>
  );
}
