import { useState } from 'react';
import { Sparkles, SlidersHorizontal } from 'lucide-react';

interface BrandPreset {
  id: string;
  name: string;
  tagline: string;
  segment: string;
  primaryColor: string;
  accentColor: string;
  bgColor: string;
  cardBg: string;
  textColor: string;
  fontDisplay: string;
  fontBody: string;
  productName: string;
  productPrice: string;
  productDesc: string;
  image: string;
  specLabel: string;
  specValue: string;
}

const PRESETS: BrandPreset[] = [
  {
    id: 'maison-verdana',
    name: 'Maison Verdana',
    tagline: 'Coleção Inverno · Alta Costura 2026',
    segment: 'Moda & Luxo',
    primaryColor: '#18181B',
    accentColor: '#B08D57',
    bgColor: '#F5F1EA',
    cardBg: '#FDFBF7',
    textColor: '#18181B',
    fontDisplay: 'font-editorial',
    fontBody: 'font-jost',
    productName: 'Casaco Structural Noir',
    productPrice: 'R$ 4.800,00',
    productDesc: 'Lã fria pura com lapela estruturada e forro em cupro italiano.',
    image: 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=800&q=80',
    specLabel: 'MATERIAL & ACABAMENTO',
    specValue: '100% LÃ PURA · COSTURA MANUAL SELLIER',
  },
  {
    id: 'aether-labs',
    name: 'Aether Labs',
    tagline: 'Série Precision · Arquitetura CNC',
    segment: 'Tech & Hardware',
    primaryColor: '#0F172A',
    accentColor: '#0284C7',
    bgColor: '#F1F5F9',
    cardBg: '#FFFFFF',
    textColor: '#0F172A',
    fontDisplay: 'font-mono',
    fontBody: 'font-jost',
    productName: 'Módulo Aether Core M2',
    productPrice: 'R$ 2.450,00',
    productDesc: 'Corpo unibody usinado em alumínio aeroespacial com dissipação passiva.',
    image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&q=80',
    specLabel: 'ESPECIFICAÇÃO DE ENGENHARIA',
    specValue: 'TOLERÂNCIA 0.01MM · ANODIZAÇÃO FOSCA',
  },
  {
    id: 'atelier-cacao',
    name: 'Atelier Cacao',
    tagline: 'Terroir & Confeitaria Fina Artesanal',
    segment: 'Gastronomia Gourmet',
    primaryColor: '#2D1B14',
    accentColor: '#D97706',
    bgColor: '#FAF5EE',
    cardBg: '#FFFDF9',
    textColor: '#2D1B14',
    fontDisplay: 'font-editorial',
    fontBody: 'font-jost',
    productName: 'Barra Gran Terroir 72%',
    productPrice: 'R$ 68,00',
    productDesc: 'Amêndoas de cacau crioulo da Bahia com notas de framboesa e baunilha da Amazônia.',
    image: 'https://images.unsplash.com/photo-1541781774459-bb2af2f05b55?w=800&q=80',
    specLabel: 'ORIGEM & NOTAS SENSORIAIS',
    specValue: 'CACAU ORGÂNICO · BEAN-TO-BAR',
  },
];

export function TokenPlaygroundSection() {
  const [activePreset, setActivePreset] = useState<BrandPreset>(PRESETS[0]);

  return (
    <section
      id="tokens"
      className="relative w-full bg-[#18181B] text-[#F5F1EA] px-6 md:px-12 py-24 md:py-36 border-b border-white/10 select-none overflow-hidden"
    >
      {/* Background Accent */}
      <div
        className="absolute top-1/2 -right-32 w-[500px] h-[500px] rounded-full blur-[140px] opacity-20 pointer-events-none transition-all duration-700"
        style={{ backgroundColor: activePreset.accentColor }}
      />

      {/* Header */}
      <div className="max-w-6xl mb-16 md:mb-20">
        <div className="flex items-center gap-2 font-mono text-[10px] tracking-[0.25em] uppercase text-[#B08D57] mb-3">
          <SlidersHorizontal className="w-3.5 h-3.5" />
          <span>INTERACTIVE TOKEN SYSTEM · CATANA LIVE DEMO</span>
        </div>
        <h2 className="font-editorial text-3xl sm:text-5xl md:text-6xl font-light tracking-[-0.02em] leading-tight text-[#F5F1EA]">
          Um toque. Toda a identidade{' '}
          <em
            className="font-normal italic transition-colors duration-500"
            style={{ color: activePreset.accentColor }}
          >
            reimaginada
          </em>
          .
        </h2>
        <p className="font-jost text-sm md:text-base text-[#A1A1AA] mt-4 max-w-xl">
          Alterne entre as marcas abaixo para ver o motor de Design Tokens do
          Catana transformar o spread editorial em tempo real, sem quebrar o grid.
        </p>
      </div>

      {/* Brand Selector Buttons */}
      <div className="flex flex-wrap items-center gap-3 mb-12">
        {PRESETS.map((preset) => {
          const isActive = preset.id === activePreset.id;
          return (
            <button
              key={preset.id}
              onClick={() => setActivePreset(preset)}
              className={`py-2.5 px-5 font-jost text-xs tracking-[0.18em] uppercase font-medium border transition-all duration-300 flex items-center gap-2.5 ${
                isActive
                  ? 'bg-white text-[#18181B] border-white shadow-md'
                  : 'bg-white/5 text-[#A1A1AA] border-white/15 hover:border-white/40 hover:text-white'
              }`}
            >
              <span
                className="w-2 h-2 rounded-full inline-block"
                style={{ backgroundColor: preset.accentColor }}
              />
              <span>{preset.name}</span>
            </button>
          );
        })}
      </div>

      {/* Live Interactive Spread Preview */}
      <div className="w-full max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
        {/* The Live Spread Mockup */}
        <div
          className="lg:col-span-8 p-8 md:p-12 border transition-all duration-700 shadow-2xl flex flex-col justify-between"
          style={{
            backgroundColor: activePreset.bgColor,
            color: activePreset.textColor,
            borderColor: `${activePreset.primaryColor}20`,
          }}
        >
          {/* Spread Top Header */}
          <div className="flex items-baseline justify-between pb-6 border-b border-black/10">
            <div>
              <span
                className={`text-2xl md:text-3xl font-light tracking-tight ${activePreset.fontDisplay}`}
              >
                {activePreset.name}
              </span>
              <p
                className={`text-xs opacity-70 mt-1 uppercase tracking-widest ${activePreset.fontBody}`}
              >
                {activePreset.tagline}
              </p>
            </div>
            <span
              className="font-mono text-[10px] tracking-widest uppercase px-2.5 py-1 border"
              style={{
                borderColor: `${activePreset.accentColor}50`,
                color: activePreset.accentColor,
              }}
            >
              {activePreset.segment}
            </span>
          </div>

          {/* Spread Body: Product Feature */}
          <div className="my-8 md:my-12 grid grid-cols-1 sm:grid-cols-2 gap-8 items-center">
            {/* Image Container */}
            <div className="aspect-[4/5] overflow-hidden bg-black/5 shadow-inner">
              <img
                src={activePreset.image}
                alt={activePreset.productName}
                className="w-full h-full object-cover transition-opacity duration-500"
              />
            </div>

            {/* Product Copy & Metadata */}
            <div className="flex flex-col justify-between h-full py-2">
              <div>
                <span
                  className="font-mono text-[9px] tracking-[0.2em] uppercase font-semibold"
                  style={{ color: activePreset.accentColor }}
                >
                  DESTAQUE EDITORIAL
                </span>
                <h3
                  className={`text-2xl md:text-3xl font-normal mt-1 leading-tight ${activePreset.fontDisplay}`}
                >
                  {activePreset.productName}
                </h3>
                <p
                  className={`text-xs md:text-sm opacity-80 mt-3 leading-relaxed ${activePreset.fontBody}`}
                >
                  {activePreset.productDesc}
                </p>
              </div>

              <div className="mt-8 pt-4 border-t border-black/10">
                <div className="font-mono text-[9px] opacity-60 tracking-wider">
                  {activePreset.specLabel}
                </div>
                <div className="font-mono text-xs font-medium tracking-wide mt-0.5">
                  {activePreset.specValue}
                </div>
                <div
                  className={`text-xl font-medium mt-3 ${activePreset.fontBody}`}
                  style={{ color: activePreset.accentColor }}
                >
                  {activePreset.productPrice}
                </div>
              </div>
            </div>
          </div>

          {/* Spread Footer */}
          <div className="pt-4 border-t border-black/10 flex items-center justify-between font-mono text-[9px] opacity-50 uppercase tracking-widest">
            <span>CATANA 2.0 EDITORIAL CORE</span>
            <span>SPREAD S-04 / PROPORÇÃO A4</span>
          </div>
        </div>

        {/* The Live Token Dossier (Inspector) */}
        <div className="lg:col-span-4 bg-[#121214] border border-white/10 p-6 md:p-8 flex flex-col justify-between font-mono text-xs">
          <div>
            <div className="flex items-center gap-2 pb-4 border-b border-white/10 text-[#B08D57] text-[10px] tracking-widest uppercase">
              <Sparkles className="w-3.5 h-3.5" />
              <span>ACTIVE TOKEN VALUES</span>
            </div>

            <div className="mt-6 space-y-4">
              <div>
                <span className="text-[#71717A] text-[10px] block">
                  $tokens.colors.primary:
                </span>
                <div className="flex items-center gap-2 mt-1">
                  <span
                    className="w-3.5 h-3.5 border border-white/20"
                    style={{ backgroundColor: activePreset.primaryColor }}
                  />
                  <span className="text-white font-medium">
                    {activePreset.primaryColor}
                  </span>
                </div>
              </div>

              <div>
                <span className="text-[#71717A] text-[10px] block">
                  $tokens.colors.accent:
                </span>
                <div className="flex items-center gap-2 mt-1">
                  <span
                    className="w-3.5 h-3.5 border border-white/20"
                    style={{ backgroundColor: activePreset.accentColor }}
                  />
                  <span className="text-white font-medium">
                    {activePreset.accentColor}
                  </span>
                </div>
              </div>

              <div>
                <span className="text-[#71717A] text-[10px] block">
                  $tokens.colors.background:
                </span>
                <div className="flex items-center gap-2 mt-1">
                  <span
                    className="w-3.5 h-3.5 border border-white/20"
                    style={{ backgroundColor: activePreset.bgColor }}
                  />
                  <span className="text-white font-medium">
                    {activePreset.bgColor}
                  </span>
                </div>
              </div>

              <div>
                <span className="text-[#71717A] text-[10px] block">
                  $tokens.typography.display:
                </span>
                <span className="text-white font-medium mt-1 block">
                  {activePreset.fontDisplay === 'font-editorial'
                    ? 'Cormorant Garamond (Serif)'
                    : 'JetBrains Mono (Technical)'}
                </span>
              </div>

              <div>
                <span className="text-[#71717A] text-[10px] block">
                  $tokens.grid.columns:
                </span>
                <span className="text-white font-medium mt-1 block">
                  12-Col Swiss Grid (1:1.414)
                </span>
              </div>
            </div>
          </div>

          <div className="mt-8 pt-4 border-t border-white/10 text-[10px] text-emerald-400 flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-ping" />
            <span>TOKENS SYNCHRONIZED ACROSS AGENTS</span>
          </div>
        </div>
      </div>
    </section>
  );
}
