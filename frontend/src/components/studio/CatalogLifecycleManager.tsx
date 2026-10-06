import { useEffect, useState } from 'react';
import api from '../../services/api';
import { documentImportError } from '../../services/documentImportService';
import { useStudioStore } from '../../store/studioStore';

interface Catalog {id: number; title: string; status: 'active' | 'archived'}
/** One scoped manager reused in Studio and quota recovery; no import state changes. */
export function CatalogLifecycleManager({organization, onChange}: {organization: number; onChange?: () => void}) {
  const [items, setItems] = useState<Catalog[]>([]);
  const [filter, setFilter] = useState<'active' | 'archived'>('active');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let current = true;
    setItems([]); setError('');
    api.get('/api/v2/studio/catalogs/', {params: {organization, status: filter}})
      .then(result => {if (current) setItems(result.data);})
      .catch(failure => {if (current) setError(documentImportError(failure));});
    return () => {current = false;};
  }, [organization, filter, revision]);
  const change = async (catalog: Catalog) => {
    const status = catalog.status === 'archived' ? 'active' : 'archived';
    if (status === 'archived' && !window.confirm(`Arquivar “${catalog.title}”? O catálogo continuará disponível em Arquivados.`)) return;
    setBusy(true); setError('');
    try {
      await api.put(`/api/v2/studio/catalogs/${catalog.id}/`, {status});
      if (useStudioStore.getState().activeOrganizationId !== organization) return;
      setRevision(value => value + 1);
      await useStudioStore.getState().syncBrands();
      await useStudioStore.getState().syncUserCatalogs();
      window.dispatchEvent(new CustomEvent('catana:catalog-quota-updated'));
      onChange?.();
    } catch (failure) {setError(documentImportError(failure));}
    finally {setBusy(false);}
  };
  return <section aria-label="Gerenciar catálogos" className="space-y-2 text-sm">
    <div className="flex flex-wrap gap-2">{(['active', 'archived'] as const).map(value => <button type="button" key={value} aria-pressed={filter === value} disabled={busy} onClick={() => setFilter(value)} className="border rounded px-3 py-2">{value === 'active' ? 'Ativos' : 'Arquivados'}</button>)}</div>
    {error && <p role="alert">{error}</p>}
    {!items.length && <p role="status">Nenhum catálogo nesta lista.</p>}
    <ul className="max-h-56 overflow-y-auto space-y-2">{items.map(catalog => <li key={catalog.id} className="flex flex-wrap items-center gap-2 border rounded p-2"><span className="min-w-0 flex-1 break-words">{catalog.title}</span><button type="button" disabled={busy} onClick={() => void change(catalog)} className="border rounded px-3 py-2">{catalog.status === 'archived' ? 'Restaurar' : 'Arquivar'}</button></li>)}</ul>
  </section>;
}
