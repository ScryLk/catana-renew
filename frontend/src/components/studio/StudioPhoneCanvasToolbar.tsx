import { useState } from 'react';
import { ChevronLeft, ChevronRight, MoreHorizontal, Minus, Plus } from 'lucide-react';
import { useStudioStore } from '../../store/studioStore';
import { useStudioResponsive } from '../../hooks/useStudioResponsive';
import { MobileSheet } from '../mobile/MobileSheet';

export function StudioPhoneCanvasToolbar() {
  const { pageNumber, selectPage, phoneZoom: zoomLevel, setPhoneZoom: setZoomLevel } = useStudioResponsive();
  const { pages, catalogTitle, setCatalogTitle, openExportModal,
    setIsPalettePanelOpen, undo, redo, canUndo, canRedo, theme } = useStudioStore();
  const [more, setMore] = useState(false);
  const index = Math.max(0, pages.findIndex((page) => page.pageNumber === pageNumber));
  return <>
    <div className={`flex shrink-0 items-center justify-between gap-0 border-b px-2 ${theme === 'dark' ? 'border-zinc-800 bg-[#0e0e11] text-zinc-100' : 'border-zinc-200 bg-white text-zinc-900'}`}>
      <button type="button" aria-label="Página anterior" className="touch-control" disabled={index === 0} onClick={() => selectPage(pages[index - 1].pageNumber)}><ChevronLeft className="size-5" /></button>
      <span className="text-xs font-mono" aria-live="polite">{index + 1}/{pages.length}</span>
      <button type="button" aria-label="Próxima página" className="touch-control" disabled={index === pages.length - 1} onClick={() => selectPage(pages[index + 1].pageNumber)}><ChevronRight className="size-5" /></button>
      <button type="button" aria-label="Reduzir zoom" className="touch-control" onClick={() => setZoomLevel(Math.max(50, zoomLevel - 10))}><Minus className="size-4" /></button>
      <button type="button" aria-label="Ajustar página" className="touch-control text-xs" onClick={() => setZoomLevel(100)}>Ajustar</button>
      <button type="button" aria-label="Aumentar zoom" className="touch-control" onClick={() => setZoomLevel(Math.min(200, zoomLevel + 10))}><Plus className="size-4" /></button>
      <button type="button" aria-label="Mais ferramentas" aria-expanded={more} className="touch-control" onClick={() => setMore(true)}><MoreHorizontal className="size-5" /></button>
    </div>
    <MobileSheet open={more} onClose={() => setMore(false)} title="Ferramentas do catálogo">
      <label className="block text-sm">Título do catálogo<input className="mt-2 min-h-11 w-full rounded-lg border border-zinc-500/40 bg-transparent px-3" value={catalogTitle} onChange={(event) => setCatalogTitle(event.target.value)} /></label>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <button type="button" disabled={!canUndo} onClick={undo} className="rounded-lg border p-3 disabled:opacity-40">Desfazer</button>
        <button type="button" disabled={!canRedo} onClick={redo} className="rounded-lg border p-3 disabled:opacity-40">Refazer</button>
        <button type="button" onClick={() => { setMore(false); setIsPalettePanelOpen(true); }} className="rounded-lg border p-3">Paleta</button>
        <button type="button" onClick={() => { setMore(false); openExportModal('share'); }} className="rounded-lg border p-3">Compartilhar</button>
        <button type="button" onClick={() => { setMore(false); openExportModal('pdf'); }} className="col-span-2 rounded-lg bg-zinc-800 p-3 text-white">Exportar catálogo</button>
      </div>
    </MobileSheet>
  </>;
}
