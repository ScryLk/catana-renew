import React from 'react';
import { CatalogPageData, GenerativeBlock } from '../../data/editorialCatalog.mock';

interface GenerativeBlockRendererProps {
  block: GenerativeBlock;
  page: CatalogPageData;
  interactive?: boolean;
  onBlockClick?: (block: GenerativeBlock) => void;
}

export const GenerativeBlockRenderer: React.FC<GenerativeBlockRendererProps> = ({
  block,
  page,
  interactive = false,
  onBlockClick,
}) => {
  // Resolução segura de cores a partir do token ou valor direto
  const resolveColor = (token?: string, fallback?: string): string => {
    if (!token) return fallback || page.textColor || '#141416';
    if (token.startsWith('#') || token.startsWith('rgb')) return token;
    switch (token) {
      case 'primary':
        return page.textColor || '#141416';
      case 'background':
        return page.backgroundColor || '#F6F5F2';
      case 'accent':
        return page.accentColor || '#C5A059';
      case 'muted':
        return '#71717A';
      case 'surface':
        return '#FFFFFF';
      default:
        return page.textColor || '#141416';
    }
  };

  // Resolução de fonte
  const resolveFontFamily = (): string => {
    if (block.fontFamily) return `"${block.fontFamily}", serif, sans-serif`;
    if (block.fontRole === 'display') {
      return "'Playfair Display', 'Cormorant Garamond', Georgia, serif";
    }
    if (block.fontRole === 'metadata') {
      return "'JetBrains Mono', 'Space Mono', monospace";
    }
    return "'Inter', 'Plus Jakarta Sans', system-ui, sans-serif";
  };

  const style: React.CSSProperties = {
    position: 'absolute',
    left: `${Math.max(0, block.x) * 100}%`,
    top: `${Math.max(0, block.y) * 100}%`,
    width: `${Math.min(1.0, block.width) * 100}%`,
    height: `${Math.min(1.0, block.height) * 100}%`,
    zIndex: block.zIndex || 1,
    opacity: block.opacity ?? 1,
    transform: block.rotation ? `rotate(${block.rotation}deg)` : undefined,
    color: resolveColor(block.colorToken, page.textColor),
    fontFamily: resolveFontFamily(),
    textAlign: block.alignment || 'left',
    textTransform: block.textTransform || 'none',
    letterSpacing: block.letterSpacing,
    lineHeight: block.lineHeight || 1.3,
    overflow: block.bleed ? 'visible' : 'hidden',
    boxSizing: 'border-box',
  };

  const handleClick = (e: React.MouseEvent) => {
    if (interactive && onBlockClick) {
      e.stopPropagation();
      onBlockClick(block);
    }
  };

  // 1. Bloco de Imagem de Produto / Fotografia
  if (block.type === 'product_image' || block.type === 'image') {
    const objectFit = block.cropMode === 'contain' ? 'contain' : 'cover';
    return (
      <div
        id={block.id}
        data-block-type={block.type}
        data-block-role={block.role}
        style={style}
        onClick={handleClick}
        className={`group relative overflow-hidden transition-all ${
          interactive ? 'cursor-pointer hover:ring-1 hover:ring-zinc-400' : ''
        }`}
      >
        {block.imageUrl ? (
          <img
            src={block.imageUrl}
            alt={block.content || 'Editorial element'}
            className="w-full h-full object-center transition-transform duration-500 group-hover:scale-105"
            style={{ objectFit }}
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full bg-stone-200/50 flex items-center justify-center border border-dashed border-stone-300">
            <span className="text-[10px] font-mono tracking-wider text-stone-400 uppercase">
              {block.role || 'Imagem'}
            </span>
          </div>
        )}
      </div>
    );
  }

  // 2. Bloco de Preço
  if (block.type === 'price') {
    return (
      <div
        id={block.id}
        data-block-type="price"
        style={style}
        onClick={handleClick}
        className="flex items-center"
      >
        <span
          className="font-semibold tabular-nums tracking-wide"
          style={{
            fontSize: block.fontSize ? `${block.fontSize}px` : '15px',
            color: resolveColor(block.colorToken, page.textColor),
          }}
        >
          {block.content || 'R$ 0,00'}
        </span>
      </div>
    );
  }

  // 3. Bloco de SKU / Metadata
  if (block.type === 'sku' || block.type === 'metadata') {
    return (
      <div
        id={block.id}
        data-block-type={block.type}
        style={style}
        onClick={handleClick}
        className="flex items-center"
      >
        <span
          className="font-mono tracking-widest uppercase font-medium whitespace-pre-line"
          style={{
            fontSize: block.fontSize ? `${block.fontSize}px` : '10px',
            color: resolveColor(block.colorToken, page.accentColor),
          }}
        >
          {block.content || ''}
        </span>
      </div>
    );
  }

  // 4. Bloco de Folio
  if (block.type === 'folio') {
    return (
      <div
        id={block.id}
        data-block-type="folio"
        style={style}
        className="flex items-end justify-end select-none pointer-events-none"
      >
        <span
          className="font-mono text-[9px] tracking-[0.25em] uppercase text-stone-400"
          style={{ color: resolveColor(block.colorToken, '#71717A') }}
        >
          {block.content || page.folio || `PÁG. ${String(page.pageNumber).padStart(2, '0')}`}
        </span>
      </div>
    );
  }

  // 5. Linha decorativa / Hairline
  if (block.type === 'line') {
    return (
      <div
        id={block.id}
        data-block-type="line"
        style={style}
        className="flex items-center"
      >
        <div
          className="w-full h-[1px]"
          style={{ backgroundColor: resolveColor(block.colorToken, page.accentColor) }}
        />
      </div>
    );
  }

  // 6. Texto padrão (headline, body, quote, caption, etc.)
  return (
    <div
      id={block.id}
      data-block-type={block.type}
      data-block-role={block.role}
      style={style}
      onClick={handleClick}
      className={`select-none flex flex-col justify-start transition-colors ${
        interactive ? 'cursor-pointer hover:outline-dashed hover:outline-1 hover:outline-zinc-400' : ''
      }`}
    >
      <div
        className="w-full break-words whitespace-pre-line"
        style={{
          fontSize: block.fontSize ? `${block.fontSize}px` : undefined,
          fontWeight: block.fontWeight || 400,
        }}
      >
        {block.content || ''}
      </div>
    </div>
  );
};
