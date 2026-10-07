import { cn } from '../../lib/utils';
import React from 'react';
import { CatalogPageData } from '../../data/editorialCatalog.mock';
import { PageOverlayLayer } from './PageOverlayLayer';
import { DocumentPageRenderer } from './DocumentPageRenderer';
import { getPageGeometry } from '../../utils/pageGeometry';
import { ProtectedDocumentImage } from './ProtectedDocumentImage';
import { protectedDocumentAssetPath } from '../../services/documentImportService';

interface MiniPageThumbnailProps {
  page: CatalogPageData;
  className?: string;
  isSelected?: boolean;
  onClick?: () => void;
  showBadge?: boolean;
}

export const MiniPageThumbnail: React.FC<MiniPageThumbnailProps> = ({
  page,
  className = '',
  isSelected = false,
  onClick,
  showBadge = true,
}) => {
  const isDarkBg = page.backgroundColor === '#1A1817';
  const isGenerative = page.renderMode === 'generative';
  const geometry = getPageGeometry(page);
  const isDocument = page.renderMode === 'document';

  const renderThumbnailContent = () => {
    if (isDocument) return <><DocumentPageRenderer page={page} /><PageOverlayLayer page={page} interactive={false} /></>;
    // 1. RENDERIZAÇÃO EXCLUSIVA GENERATIVA (Item 26: Nunca renderiza legacy por baixo de generative)
    if (isGenerative) {
      return (
        <div className="relative w-full h-full overflow-hidden select-none pointer-events-none">
          {page.blocks!.map((b) => {
            const isImg = b.type === 'product_image' || b.type === 'image';
            return (
              <div
                key={b.id}
                className="absolute overflow-hidden"
                style={{
                  left: `${b.x * 100}%`,
                  top: `${b.y * 100}%`,
                  width: `${b.width * 100}%`,
                  height: `${b.height * 100}%`,
                  opacity: b.opacity ?? 1,
                  backgroundColor: isImg ? (b.imageUrl ? undefined : 'rgba(0,0,0,0.08)') : undefined,
                }}
              >
                {isImg && b.imageUrl && protectedDocumentAssetPath(b.imageUrl) ? (
                  <ProtectedDocumentImage snapshot={{url: b.imageUrl}} alt="" className="w-full h-full object-cover" />
                ) : isImg && b.imageUrl ? (
                  <img loading="lazy" decoding="async" src={b.imageUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div
                    className="w-full h-full overflow-hidden"
                    style={{
                      fontSize: '3px',
                      lineHeight: '4px',
                      color: b.colorToken === 'accent' ? (page.accentColor || '#C5A059') : (page.textColor || '#141416'),
                      fontWeight: b.fontWeight || 400,
                    }}
                  >
                    {b.content}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      );
    }

    // 2. RENDERIZAÇÃO EXCLUSIVA LEGADA (Fallback estrito por switch)
    switch (page.type) {
      case 'cover':
        return (
          <div className="h-full flex flex-col items-center justify-center text-center gap-1.5 pt-3">
            <div
              className="size-6 rounded-full border flex items-center justify-center p-0.5 bg-black/20"
              style={{ borderColor: `${page.accentColor || '#B08D57'}66` }}
            >
              {page.editorialImage ? (
                <img
                  loading="lazy" decoding="async"
                  src={page.editorialImage}
                  alt="Logo"
                  className="w-full h-full object-contain"
                />
              ) : (
                <span
                  className="text-[9px] font-serif font-light"
                  style={{ color: page.accentColor || '#B08D57' }}
                >
                  {(page.title || 'C').charAt(0)}
                </span>
              )}
            </div>
            <span
              className="text-[8px] tracking-[0.2em] font-normal uppercase max-w-[90%] truncate"
              style={{
                fontFamily: "'Cormorant Garamond', Georgia, serif",
                color: page.textColor || '#F5F1EA',
              }}
            >
              {page.title || 'CATÁLOGO'}
            </span>
            <div
              className="w-3 h-[0.5px]"
              style={{ backgroundColor: page.accentColor || '#B08D57' }}
            />
            <span
              className="text-[5px] tracking-wider uppercase font-medium"
              style={{ color: page.accentColor || '#B08D57' }}
            >
              2026
            </span>
          </div>
        );

      case 'manifesto':
        return (
          <div className="h-full flex flex-col justify-between pt-3">
            <div>
              <span className="text-[5px] tracking-widest text-[#B08D57] uppercase font-bold block mb-0.5">
                MANIFESTO
              </span>
              <div className="w-2 h-[0.5px] bg-[#B08D57] mb-1.5" />
              <p
                className="text-[7px] leading-[1.2] text-[#1A1817] font-normal line-clamp-3"
                style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}
              >
                {page.quote || 'O essencial, executado sem pressa.'}
              </p>
            </div>
            <div className="text-center pb-0.5">
              <span className="text-[5px] font-mono text-stone-500">
                {page.folio || `PÁG. ${String(page.pageNumber).padStart(2, '0')}`}
              </span>
            </div>
          </div>
        );

      case 'divider':
        return (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-1.5 overflow-hidden">
            {page.editorialImage && (
              <img
                  loading="lazy" decoding="async"
                src={page.editorialImage}
                alt=""
                className="absolute inset-0 w-full h-full object-cover"
              />
            )}
            <div className="absolute inset-0 bg-[#1A1817]/70" />
            <div className="relative z-10">
              <span className="text-[5px] tracking-widest text-[#B08D57] uppercase block mb-0.5">
                {page.label}
              </span>
              <span
                className="text-[8px] tracking-wider text-[#F5F1EA] uppercase font-normal block"
                style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}
              >
                {page.title}
              </span>
            </div>
          </div>
        );

      case 'hero':
        return (
          <div className="h-full flex flex-col justify-between pt-2">
            {page.products?.[0] ? (
              <>
                <div className="w-full h-18 bg-stone-100 overflow-hidden rounded-xs flex items-center justify-center">
                  {page.products[0].image ? (
                    <img
                  loading="lazy" decoding="async"
                      src={page.products[0].image}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-[6px] text-stone-400 font-mono">SEM FOTO</span>
                  )}
                </div>
                <div className="pt-1">
                  <span
                    className="text-[6px] text-[#1A1817] font-medium block truncate"
                    style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}
                  >
                    {page.products[0].name}
                  </span>
                  <span className="text-[5px] font-mono text-[#1A1817] font-semibold block">
                    {page.products[0].price || ''}
                  </span>
                </div>
              </>
            ) : (
              <div className="h-full flex flex-col items-center justify-center border border-dashed border-zinc-400/50 rounded-xs p-1 text-center bg-black/5">
                <span className="text-[9px] text-zinc-400 font-light">+</span>
                <span className="text-[4px] font-mono uppercase text-zinc-500 mt-0.5">Slot Hero</span>
              </div>
            )}
          </div>
        );

      case 'duo':
        return (
          <div className="h-full flex flex-col justify-between pt-2">
            <div className="grid grid-cols-2 gap-1 h-20 items-center">
              {[0, 1].map((idx) => {
                const prod = page.products?.[idx];
                return prod ? (
                  <div key={prod.id || idx} className="flex flex-col gap-0.5">
                    <div className="w-full h-10 bg-stone-100 overflow-hidden rounded-xs flex items-center justify-center">
                      {prod.image ? (
                        <img loading="lazy" decoding="async" src={prod.image} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-[5px] text-stone-400 font-mono">FOTO</span>
                      )}
                    </div>
                    <span className="text-[4px] text-[#1A1817] font-semibold truncate block">
                      {prod.name}
                    </span>
                    <span className="text-[4px] font-mono text-stone-700 block">
                      {prod.price || ''}
                    </span>
                  </div>
                ) : (
                  <div key={idx} className="h-14 border border-dashed border-zinc-400/50 rounded-xs flex flex-col items-center justify-center bg-black/5">
                    <span className="text-[8px] text-zinc-400 font-light">+</span>
                    <span className="text-[3px] font-mono text-zinc-500">Slot {idx + 1}</span>
                  </div>
                );
              })}
            </div>
            <div className="text-center pb-0.5">
              <span className="text-[5px] font-mono text-stone-500">{page.folio || `PÁG. ${page.pageNumber}`}</span>
            </div>
          </div>
        );

      case 'single':
        return (
          <div className="h-full flex flex-col items-center justify-between pt-2 text-center">
            {page.products?.[0] ? (
              <>
                <div className="w-14 h-16 bg-stone-100 overflow-hidden rounded-xs flex items-center justify-center">
                  {page.products[0].image ? (
                    <img
                  loading="lazy" decoding="async"
                      src={page.products[0].image}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-[5px] text-stone-400 font-mono">FOTO</span>
                  )}
                </div>
                <div className="pt-0.5">
                  <span
                    className="text-[6px] text-[#1A1817] font-medium block truncate"
                    style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}
                  >
                    {page.products[0].name}
                  </span>
                  <span className="text-[5px] font-mono text-[#1A1817] font-semibold block">
                    {page.products[0].price || ''}
                  </span>
                </div>
              </>
            ) : (
              <div className="w-16 h-20 border border-dashed border-zinc-400/50 rounded-xs flex flex-col items-center justify-center bg-black/5 mt-2">
                <span className="text-[9px] text-zinc-400 font-light">+</span>
                <span className="text-[4px] font-mono uppercase text-zinc-500 mt-0.5">Slot Single</span>
              </div>
            )}
          </div>
        );

      case 'grid_4':
        return (
          <div className="h-full flex flex-col justify-between pt-2">
            <div className="grid grid-cols-2 gap-0.5 items-center">
              {[0, 1, 2, 3].map((idx) => {
                const prod = page.products?.[idx];
                return prod ? (
                  <div key={prod.id || idx} className="flex flex-col gap-0.2">
                    <div className="w-full h-7 bg-stone-100 overflow-hidden rounded-xs flex items-center justify-center">
                      {prod.image ? (
                        <img loading="lazy" decoding="async" src={prod.image} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-[4px] text-stone-400 font-mono">FOTO</span>
                      )}
                    </div>
                    <span className="text-[3px] text-[#1A1817] font-semibold truncate block">
                      {prod.name}
                    </span>
                    <span className="text-[3px] font-mono text-stone-700 block">
                      {prod.price || ''}
                    </span>
                  </div>
                ) : (
                  <div key={idx} className="h-9 border border-dashed border-zinc-400/50 rounded-xs flex flex-col items-center justify-center bg-black/5">
                    <span className="text-[7px] text-zinc-400 font-light">+</span>
                    <span className="text-[3px] font-mono text-zinc-500">{idx + 1}</span>
                  </div>
                );
              })}
            </div>
            <div className="text-center pb-0.5">
              <span className="text-[5px] font-mono text-stone-500">{page.folio || `PÁG. ${page.pageNumber}`}</span>
            </div>
          </div>
        );

      case 'backcover':
      default:
        return (
          <div className="h-full flex flex-col items-center justify-center text-center gap-1 pt-3">
            <div
              className="size-5 rounded-full border flex items-center justify-center p-0.5 bg-black/20"
              style={{ borderColor: `${page.accentColor || '#B08D57'}66` }}
            >
              <span
                className="text-[8px] font-serif"
                style={{ color: page.textColor || '#F5F1EA' }}
              >
                {(page.title || 'C').charAt(0)}
              </span>
            </div>
            <span
              className="text-[5px] tracking-widest uppercase font-semibold max-w-[90%] truncate"
              style={{ color: page.accentColor || '#B08D57' }}
            >
              {page.title || 'CATÁLOGO'}
            </span>
            <span
              className="text-[4px] tracking-wider uppercase opacity-80"
              style={{ color: page.textColor || '#F5F1EA' }}
            >
              EDIÇÃO 2026
            </span>
          </div>
        );
    }
  };

  return (
    <div
      onClick={onClick}
      className={cn(`relative w-24 h-34 rounded-sm border overflow-hidden select-none transition-all flex flex-col justify-between p-2 cursor-pointer ${
        isSelected
          ? 'ring-2 ring-white border-white shadow-md'
          : 'border-zinc-700/60 hover:border-zinc-400 opacity-90 hover:opacity-100'
      }`, className)}
      style={{
        ...(isDocument ? {aspectRatio: `${geometry.width}/${geometry.height}`, height: 'auto', padding: 0, borderWidth: 0, outline: '1px solid #71717a'} : {}),
        backgroundColor: page.backgroundColor,
        color: page.textColor,
      }}
    >
      {/* Page Number Badge */}
      {showBadge && (
        <div className="absolute top-1 left-1 z-20">
          <span
            className={`text-[8px] font-mono font-bold px-1 py-0.2 rounded shadow-xs ${
              isDarkBg
                ? 'bg-black/70 text-zinc-200 border border-white/20'
                : 'bg-white/90 text-zinc-900 border border-black/10'
            }`}
          >
            {String(page.pageNumber).padStart(2, '0')}
          </span>
        </div>
      )}

      {/* Conteúdo Renderizado (Generativo OU Legado) */}
      {renderThumbnailContent()}
    </div>
  );
};
