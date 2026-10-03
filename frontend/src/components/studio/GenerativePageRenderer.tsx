import React from 'react';
import { CatalogPageData, GenerativeBlock } from '../../data/editorialCatalog.mock';
import { GenerativeBlockRenderer } from './GenerativeBlockRenderer';
import { PageOverlayLayer } from './PageOverlayLayer';

interface GenerativePageRendererProps {
  page: CatalogPageData;
  interactive?: boolean;
  showDebug?: boolean;
  className?: string;
  style?: React.CSSProperties;
  onBlockClick?: (block: GenerativeBlock) => void;
}

export const GenerativePageRenderer: React.FC<GenerativePageRendererProps> = ({
  page,
  interactive = false,
  showDebug = false,
  className = '',
  style = {},
  onBlockClick,
}) => {
  const blocks = page.blocks || [];
  const safeArea = page.safeArea || { top: 0.04, right: 0.04, bottom: 0.04, left: 0.04 };

  return (
    <div
      className={`generative-page-content relative w-full h-full overflow-hidden select-none ${className}`}
      data-page-id={page.id}
      data-render-mode="generative"
      data-content-role={page.contentRole || page.type}
      style={{
        backgroundColor: page.backgroundColor,
        color: page.textColor,
        ...style,
      }}
    >
      {/* 1. Blocos de Composição Generativa */}
      {blocks.map((block) => (
        <GenerativeBlockRenderer
          key={block.id}
          block={block}
          page={page}
          interactive={interactive}
          onBlockClick={onBlockClick}
        />
      ))}

      {/* 2. Camada de Overlays e Sprites Editoriais */}
      {page.overlays && page.overlays.length > 0 && (
        <PageOverlayLayer page={page} interactive={interactive} />
      )}

      {/* 3. Guia Visual de Debug (Safe Area e Grid em Development) */}
      {showDebug && (
        <div
          className="absolute pointer-events-none border border-red-500/30 border-dashed z-50"
          style={{
            top: `${safeArea.top * 100}%`,
            left: `${safeArea.left * 100}%`,
            right: `${safeArea.right * 100}%`,
            bottom: `${safeArea.bottom * 100}%`,
          }}
        >
          <span className="absolute top-1 left-1 text-[8px] font-mono text-red-500/60 uppercase">
            Safe Area 4%
          </span>
        </div>
      )}
    </div>
  );
};
