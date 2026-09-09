import React from 'react';
import { CatalogPageData } from '../../data/aureaCatalog.mock';

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

  return (
    <div
      onClick={onClick}
      className={`relative w-24 h-34 rounded-sm border overflow-hidden select-none transition-all flex flex-col justify-between p-2 cursor-pointer ${
        isSelected
          ? 'ring-2 ring-white border-white shadow-md'
          : 'border-zinc-700/60 hover:border-zinc-400 opacity-90 hover:opacity-100'
      } ${className}`}
      style={{
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

      {/* Internal Mini Visual Content */}
      {page.type === 'cover' && (
        <div className="h-full flex flex-col items-center justify-center text-center gap-1.5 pt-3">
          <div className="size-6 rounded-full border border-[#B08D57]/40 flex items-center justify-center p-0.5 bg-[#1A1817]">
            <img
              src="/aurea/aurea-monograma.png"
              alt="Monograma"
              className="w-full h-full object-contain"
            />
          </div>
          <span
            className="text-[8px] tracking-[0.25em] font-normal uppercase text-[#F5F1EA]"
            style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}
          >
            ÁUREA
          </span>
          <div className="w-3 h-[0.5px] bg-[#B08D57]" />
          <span className="text-[5px] tracking-wider text-[#B08D57] uppercase font-medium">
            2026
          </span>
        </div>
      )}

      {page.type === 'manifesto' && (
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
              O essencial, executado sem pressa.
            </p>
          </div>
          <div className="text-center pb-0.5">
            <span className="text-[5px] font-mono text-stone-500">ÁUREA · 02</span>
          </div>
        </div>
      )}

      {page.type === 'divider' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-1.5 overflow-hidden">
          {page.editorialImage && (
            <img
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
      )}

      {page.type === 'hero' && page.products?.[0] && (
        <div className="h-full flex flex-col justify-between pt-2">
          <div className="w-full h-18 bg-stone-100 overflow-hidden rounded-xs">
            <img
              src={page.products[0].image}
              alt=""
              className="w-full h-full object-cover"
            />
          </div>
          <div className="pt-1">
            <span
              className="text-[6px] text-[#1A1817] font-medium block truncate"
              style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}
            >
              {page.products[0].name}
            </span>
            <span className="text-[5px] font-mono text-[#1A1817] font-semibold block">
              {page.products[0].price}
            </span>
          </div>
        </div>
      )}

      {page.type === 'duo' && page.products && (
        <div className="h-full flex flex-col justify-between pt-2">
          <div className="grid grid-cols-2 gap-1 h-20 items-center">
            {page.products.slice(0, 2).map((prod) => (
              <div key={prod.id} className="flex flex-col gap-0.5">
                <div className="w-full h-10 bg-stone-100 overflow-hidden rounded-xs">
                  <img src={prod.image} alt="" className="w-full h-full object-cover" />
                </div>
                <span className="text-[4px] text-[#1A1817] font-semibold truncate block">
                  {prod.name}
                </span>
                <span className="text-[4px] font-mono text-stone-700 block">
                  {prod.price}
                </span>
              </div>
            ))}
          </div>
          <div className="text-center pb-0.5">
            <span className="text-[5px] font-mono text-stone-500">{page.folio}</span>
          </div>
        </div>
      )}

      {page.type === 'single' && page.products?.[0] && (
        <div className="h-full flex flex-col items-center justify-between pt-2 text-center">
          <div className="w-14 h-16 bg-stone-100 overflow-hidden rounded-xs">
            <img
              src={page.products[0].image}
              alt=""
              className="w-full h-full object-cover"
            />
          </div>
          <div className="pt-0.5">
            <span
              className="text-[6px] text-[#1A1817] font-medium block truncate"
              style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}
            >
              {page.products[0].name}
            </span>
            <span className="text-[5px] font-mono text-[#1A1817] font-semibold block">
              {page.products[0].price}
            </span>
          </div>
        </div>
      )}

      {page.type === 'backcover' && (
        <div className="h-full flex flex-col items-center justify-center text-center gap-1 pt-3">
          <div className="size-5 rounded-full border border-[#B08D57]/40 flex items-center justify-center p-0.5 bg-[#1A1817]">
            <span className="text-[8px] font-serif text-[#F5F1EA]">Á</span>
          </div>
          <span className="text-[5px] tracking-widest text-[#B08D57] uppercase font-semibold">
            ATELIER ÁUREA
          </span>
          <span className="text-[4px] tracking-wider text-[#F5F1EA]/80 uppercase">
            OSCAR FREIRE · SP
          </span>
        </div>
      )}
    </div>
  );
};
