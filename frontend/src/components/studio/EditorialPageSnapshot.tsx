import React from 'react';
import { CatalogPageData, StudioPalette } from '../../data/aureaCatalog.mock';

interface EditorialPageSnapshotProps {
  page: CatalogPageData;
  activePalette?: StudioPalette;
  showCropMarks?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export const EditorialPageSnapshot: React.FC<EditorialPageSnapshotProps> = ({
  page,
  activePalette,
  showCropMarks = false,
  className = '',
  style = {},
}) => {
  const accent = page.accentColor || activePalette?.accent || '#B08D57';

  const renderContent = () => {
    switch (page.type) {
      case 'cover':
        return (
          <div className="h-full flex flex-col justify-between items-center text-center py-12 px-8 select-none relative">
            <div className="h-6" />
            <div className="flex flex-col items-center gap-6 p-4">
              <div
                className="w-24 h-24 rounded-full border flex items-center justify-center p-2 bg-black/20 shadow-lg overflow-hidden"
                style={{ borderColor: `${accent}66` }}
              >
                {page.editorialImage ? (
                  <img
                    src={page.editorialImage}
                    alt={page.title || 'Capa'}
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <span
                    className="text-4xl font-serif font-light select-none"
                    style={{
                      fontFamily: "'Cormorant Garamond', Georgia, serif",
                      color: accent,
                    }}
                  >
                    {(page.title || 'C').charAt(0)}
                  </span>
                )}
              </div>

              <div className="flex flex-col items-center">
                <h1
                  className="text-4xl tracking-[0.35em] text-[#F5F1EA] font-normal uppercase"
                  style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}
                >
                  {page.title || 'CATALOGO'}
                </h1>
                <div className="w-8 h-[1px] my-3" style={{ backgroundColor: accent }} />
                <span
                  className="text-[10px] tracking-[0.3em] uppercase font-medium"
                  style={{ color: accent }}
                >
                  {page.label || 'COLECAO EXECUTIVA 2026'}
                </span>
              </div>
            </div>

            <div className="p-2">
              <p className="text-[9px] tracking-[0.3em] text-[#F5F1EA]/80 uppercase font-light">
                {page.subtitle || 'MODA & ACESSORIOS - SAO PAULO'}
              </p>
            </div>
          </div>
        );

      case 'manifesto':
        return (
          <div className="h-full flex flex-col justify-between py-12 px-10 select-none">
            <div className="mt-8">
              <div className="inline-block p-1">
                <span
                  className="text-[10px] tracking-[0.35em] font-semibold uppercase"
                  style={{ color: accent }}
                >
                  {page.label || 'MANIFESTO'}
                </span>
                <div className="w-10 h-[1px] mt-2 mb-8" style={{ backgroundColor: accent }} />
              </div>

              <div className="p-2 mb-8">
                <h2
                  className="text-3xl leading-[1.25] text-[#1A1817] font-normal whitespace-pre-line"
                  style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}
                >
                  {page.quote || 'O essencial,\nexecutado sem pressa.'}
                </h2>
              </div>

              <div className="p-2 max-w-[340px]">
                <p className="text-xs text-stone-600 leading-[1.8] font-light text-pretty">
                  {page.content}
                </p>
              </div>
            </div>

            <div className="flex flex-col items-center">
              <div className="w-6 h-[1px] mb-2" style={{ backgroundColor: accent }} />
              <span className="text-[9px] tracking-[0.3em] text-[#1A1817]/70 font-mono">
                {page.folio || `PAG. ${String(page.pageNumber).padStart(2, '0')}`}
              </span>
            </div>
          </div>
        );

      case 'divider':
        return (
          <div className="h-full relative overflow-hidden flex flex-col justify-center items-center text-center p-8 select-none">
            {page.editorialImage && (
              <img
                src={page.editorialImage}
                alt={page.title || 'Divisoria de Categoria'}
                className="absolute inset-0 w-full h-full object-cover object-center"
              />
            )}
            <div className="absolute inset-0 bg-[#1A1817]/65 backdrop-blur-[0.5px]" />

            <div className="relative z-10 p-6">
              <span
                className="text-[10px] tracking-[0.4em] uppercase font-semibold block mb-3"
                style={{ color: accent }}
              >
                {page.label}
              </span>
              <h2
                className="text-4xl tracking-[0.15em] text-[#F5F1EA] font-normal uppercase mb-4"
                style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}
              >
                {page.title}
              </h2>
              <div className="w-14 h-[1px] mx-auto mb-4" style={{ backgroundColor: accent }} />
              {page.subtitle && (
                <p className="text-[10px] tracking-[0.2em] text-[#F5F1EA]/80 font-light max-w-[260px] mx-auto">
                  {page.subtitle}
                </p>
              )}
            </div>
          </div>
        );

      case 'hero': {
        const prod = page.products?.[0];
        if (!prod) return null;

        return (
          <div className="h-full flex flex-col justify-between py-9 px-9 select-none">
            <div className="w-full h-[360px] bg-stone-100 overflow-hidden relative rounded-sm">
              <img
                src={prod.image}
                alt={prod.name}
                className="w-full h-full object-cover object-center"
              />
              {prod.tag && (
                <div className="absolute top-3 left-3 bg-[#1A1817] text-[#F5F1EA] text-[9px] font-mono tracking-wider px-2.5 py-0.5 uppercase">
                  {prod.tag}
                </div>
              )}
            </div>

            <div className="p-3">
              <div className="flex items-center justify-between mb-1.5">
                <span
                  className="text-[9px] tracking-[0.3em] font-semibold uppercase"
                  style={{ color: accent }}
                >
                  {prod.category} - {prod.index}
                </span>
                <span className="text-[9px] font-mono text-stone-400">{prod.sku}</span>
              </div>
              <div className="w-10 h-[1px] mb-2.5" style={{ backgroundColor: accent }} />

              <div className="flex items-baseline justify-between gap-4 mb-2">
                <h3
                  className="text-2xl text-[#1A1817] font-medium"
                  style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}
                >
                  {prod.name}
                </h3>
                <span className="text-sm font-sans tracking-wider text-[#1A1817] font-semibold tabular-nums">
                  {prod.price}
                </span>
              </div>

              <p className="text-[11px] text-stone-600 leading-[1.65] font-light line-clamp-2">
                {prod.description}
              </p>
            </div>

            <div className="flex flex-col items-center">
              <div className="w-6 h-[1px] mb-2" style={{ backgroundColor: accent }} />
              <span className="text-[9px] tracking-[0.3em] text-[#1A1817]/70 font-mono">
                {page.folio}
              </span>
            </div>
          </div>
        );
      }

      case 'duo': {
        const [prodA, prodB] = page.products || [];
        if (!prodA || !prodB) return null;
        const isMirrored = page.mirrored;

        return (
          <div className="h-full flex flex-col justify-between py-9 px-8 select-none">
            <div className="grid grid-cols-2 gap-5 items-start">
              <div
                className={`flex flex-col gap-2.5 transition-transform ${
                  isMirrored ? 'translate-y-10' : ''
                }`}
              >
                <div className="w-full h-44 bg-stone-100 overflow-hidden rounded-sm">
                  <img
                    src={prodA.image}
                    alt={prodA.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="p-1.5">
                  <span
                    className="text-[8px] tracking-[0.25em] uppercase font-semibold block mb-1"
                    style={{ color: accent }}
                  >
                    {prodA.category} - {prodA.index}
                  </span>
                  <div className="w-8 h-[1px] mb-1.5" style={{ backgroundColor: accent }} />
                  <div className="flex items-baseline justify-between mb-1">
                    <h4
                      className="text-base text-[#1A1817] font-medium"
                      style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}
                    >
                      {prodA.name}
                    </h4>
                  </div>
                  <div className="text-xs font-semibold text-[#1A1817] tabular-nums mb-1">
                    {prodA.price}
                  </div>
                  <p className="text-[10px] text-stone-600 leading-snug line-clamp-2">
                    {prodA.description}
                  </p>
                </div>
              </div>

              <div
                className={`flex flex-col gap-2.5 transition-transform ${
                  !isMirrored ? 'translate-y-12' : ''
                }`}
              >
                <div className="w-full h-44 bg-stone-100 overflow-hidden rounded-sm">
                  <img
                    src={prodB.image}
                    alt={prodB.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="p-1.5">
                  <span
                    className="text-[8px] tracking-[0.25em] uppercase font-semibold block mb-1"
                    style={{ color: accent }}
                  >
                    {prodB.category} - {prodB.index}
                  </span>
                  <div className="flex items-baseline justify-between mb-1">
                    <h4
                      className="text-base text-[#1A1817] font-medium"
                      style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}
                    >
                      {prodB.name}
                    </h4>
                  </div>
                  <div className="text-xs font-semibold text-[#1A1817] tabular-nums mb-1">
                    {prodB.price}
                  </div>
                  <p className="text-[10px] text-stone-600 leading-snug line-clamp-2">
                    {prodB.description}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-col items-center mt-4">
              <div className="w-6 h-[1px] mb-2" style={{ backgroundColor: accent }} />
              <span className="text-[9px] tracking-[0.3em] text-[#1A1817]/70 font-mono">
                {page.folio}
              </span>
            </div>
          </div>
        );
      }

      case 'single': {
        const prod = page.products?.[0];
        if (!prod) return null;

        return (
          <div className="h-full flex flex-col justify-between py-10 px-10 select-none">
            <div className="flex flex-col items-center text-center mt-4">
              <div className="w-64 h-72 bg-stone-100 overflow-hidden rounded-sm mb-6">
                <img
                  src={prod.image}
                  alt={prod.name}
                  className="w-full h-full object-cover"
                />
              </div>

              <div className="p-3 max-w-[320px]">
                <span
                  className="text-[9px] tracking-[0.3em] font-semibold uppercase block mb-1"
                  style={{ color: accent }}
                >
                  {prod.category} - {prod.index}
                </span>
                <div className="w-8 h-[1px] mx-auto mb-2" style={{ backgroundColor: accent }} />
                <h3
                  className="text-2xl text-[#1A1817] font-medium mb-1"
                  style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}
                >
                  {prod.name}
                </h3>
                <div className="text-sm font-semibold text-[#1A1817] tabular-nums mb-2">
                  {prod.price}
                </div>
                <p className="text-[11px] text-stone-600 leading-relaxed font-light">
                  {prod.description}
                </p>
              </div>
            </div>

            <div className="flex flex-col items-center">
              <div className="w-6 h-[1px] mb-2" style={{ backgroundColor: accent }} />
              <span className="text-[9px] tracking-[0.3em] text-[#1A1817]/70 font-mono">
                {page.folio}
              </span>
            </div>
          </div>
        );
      }

      case 'backcover':
        return (
          <div className="h-full flex flex-col justify-between items-center text-center py-14 px-8 select-none">
            <div className="h-6" />
            <div className="flex flex-col items-center gap-6 p-6">
              <div
                className="w-20 h-20 rounded-full border flex items-center justify-center p-2 bg-[#1A1817] shadow-lg"
                style={{ borderColor: `${accent}66` }}
              >
                <span
                  className="text-3xl font-serif text-[#F5F1EA]"
                  style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}
                >
                  A
                </span>
              </div>

              <div className="flex flex-col items-center gap-3">
                <span
                  className="text-[10px] tracking-[0.35em] uppercase font-semibold"
                  style={{ color: accent }}
                >
                  {page.label}
                </span>
                <div className="w-10 h-[1px]" style={{ backgroundColor: accent }} />
                <p className="text-xs tracking-[0.2em] text-[#F5F1EA] font-light leading-relaxed whitespace-pre-line max-w-[280px]">
                  {page.content}
                </p>
              </div>
            </div>

            <div
              className="text-[9px] font-mono tracking-[0.3em] uppercase"
              style={{ color: `${accent}CC` }}
            >
              {page.folio || 'KATANA STUDIO - 2026'}
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  const pageInner = (
    <div
      className={`pdf-page-content w-[490px] h-[693px] relative overflow-hidden select-none ${className}`}
      data-page-id={page.id}
      style={{
        backgroundColor: page.backgroundColor,
        color: page.textColor,
        ...style,
      }}
    >
      {renderContent()}
    </div>
  );

  if (!showCropMarks) {
    return pageInner;
  }

  return (
    <div className="relative p-6 bg-white shrink-0 inline-block">
      {/* Top-Left Crop Marks */}
      <div className="absolute top-0 left-6 w-[1px] h-4 bg-zinc-900" />
      <div className="absolute top-6 left-0 w-4 h-[1px] bg-zinc-900" />

      {/* Top-Right Crop Marks */}
      <div className="absolute top-0 right-6 w-[1px] h-4 bg-zinc-900" />
      <div className="absolute top-6 right-0 w-4 h-[1px] bg-zinc-900" />

      {/* Bottom-Left Crop Marks */}
      <div className="absolute bottom-0 left-6 w-[1px] h-4 bg-zinc-900" />
      <div className="absolute bottom-6 left-0 w-4 h-[1px] bg-zinc-900" />

      {/* Bottom-Right Crop Marks */}
      <div className="absolute bottom-0 right-6 w-[1px] h-4 bg-zinc-900" />
      <div className="absolute bottom-6 right-0 w-4 h-[1px] bg-zinc-900" />

      {/* Center Registration Targets */}
      <div className="absolute top-1 left-1/2 -translate-x-1/2 flex items-center justify-center">
        <div className="w-3 h-3 rounded-full border border-zinc-900 relative">
          <div className="absolute top-0 bottom-0 left-1/2 w-[1px] bg-zinc-900 -translate-x-1/2" />
          <div className="absolute left-0 right-0 top-1/2 h-[1px] bg-zinc-900 -translate-y-1/2" />
        </div>
      </div>
      <div className="absolute bottom-1 left-1/2 -translate-x-1/2 flex items-center justify-center">
        <div className="w-3 h-3 rounded-full border border-zinc-900 relative">
          <div className="absolute top-0 bottom-0 left-1/2 w-[1px] bg-zinc-900 -translate-x-1/2" />
          <div className="absolute left-0 right-0 top-1/2 h-[1px] bg-zinc-900 -translate-y-1/2" />
        </div>
      </div>

      {pageInner}
    </div>
  );
};
