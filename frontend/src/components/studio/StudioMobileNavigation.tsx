import { useResponsiveLayout } from '../../hooks/useResponsiveLayout';
import { Menu, Plus, Package } from 'lucide-react';
import { useStudioStore } from '../../store/studioStore';
import { useStudioResponsive } from '../../hooks/useStudioResponsive';

export function StudioMobileNavigation({ onMenu }: { onMenu: () => void }) {
  const { isTablet } = useResponsiveLayout();
  const { pane, setPane } = useStudioResponsive();
  const { hasStartedSession, openNewCatalogModal, toggleProductDrawer, theme } = useStudioStore();
  return <div className={`studio-mobile-bar flex shrink-0 items-center gap-1 border-b lg:hidden ${theme === 'dark' ? 'border-zinc-800 bg-[#09090b] text-zinc-100' : 'border-zinc-200 bg-white text-zinc-900'}`}>
    <button type="button" className="touch-control" aria-label="Abrir navegação do Studio" onClick={onMenu}><Menu className="size-5" /></button>
    <div className={`flex min-w-0 flex-1 ${isTablet ? 'hidden' : ''}`} role="tablist" aria-label="Área do Studio"
      onKeyDown={(event) => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        const next = event.key === 'Home' ? 'assistant' : event.key === 'End' ? 'catalog' : pane === 'assistant' ? 'catalog' : 'assistant';
        if (next === 'catalog' && !hasStartedSession) return;
        event.preventDefault(); setPane(next);
        event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next === 'assistant' ? 0 : 1]?.focus();
      }}>
      {(['assistant', 'catalog'] as const).map((value) => <button key={value} type="button" role="tab"
        tabIndex={(hasStartedSession ? pane : 'assistant') === value ? 0 : -1} aria-selected={(hasStartedSession ? pane : 'assistant') === value} aria-controls={`studio-${value}`} disabled={value === 'catalog' && !hasStartedSession}
        onClick={() => setPane(value)} className={`min-w-0 flex-1 rounded-lg px-2 text-sm disabled:opacity-35 ${(hasStartedSession ? pane : 'assistant') === value ? 'bg-zinc-500/20 font-semibold' : ''}`}>{value === 'assistant' ? 'Assistente' : 'Catálogo'}</button>)}
    </div>
    {isTablet && <span className="min-w-0 flex-1 truncate px-2 text-sm font-semibold">Catana Studio</span>}
    <button type="button" className="touch-control" aria-label="Novo Catálogo" onClick={openNewCatalogModal}><Plus className="size-5" /></button>
    {hasStartedSession && <button type="button" className="touch-control" aria-label="Produtos do catálogo" onClick={toggleProductDrawer}><Package className="size-5" /></button>}
  </div>;
}
