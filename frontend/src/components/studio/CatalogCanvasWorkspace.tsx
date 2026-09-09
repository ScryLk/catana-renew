import React from 'react';
import { CanvasTopToolbar } from './CanvasTopToolbar';
import { SpreadViewport } from './SpreadViewport';
import { PageFilmstrip } from './PageFilmstrip';

import { useStudioStore } from '../../store/studioStore';

export const CatalogCanvasWorkspace: React.FC = () => {
  const { theme } = useStudioStore();
  const isDark = theme === 'dark';

  return (
    <main
      className={`flex-1 h-full flex flex-col overflow-hidden transition-colors ${
        isDark ? 'bg-[#09090b]' : 'bg-[#f3f4f6]'
      }`}
    >
      {/* Top canvas controls */}
      <CanvasTopToolbar />

      {/* Center living catalog spread */}
      <SpreadViewport />

      {/* Bottom filmstrip navigator */}
      <PageFilmstrip />
    </main>
  );
};
