import { useEffect, useRef, useState } from 'react';
import { useStudioStore } from '../../store/studioStore';
import { documentImportService, documentImportError } from '../../services/documentImportService';
import type { DocumentImportAnalysis } from '../../types/documentImport';
import { ResponsiveModal } from '../mobile/ResponsiveModal';
import { DocumentPageRenderer } from './DocumentPageRenderer';

/** Source reanalysis is a preview. Replacing customer edits is a separate decision. */
export function UpdateDocumentEditability() {
  const catalog = useStudioStore(s => s.activeCatalogId);
  const organization = useStudioStore(s => s.activeOrganizationId);
  const user = useStudioStore(s => s.activeUserId);
  const scope = `${user}:${organization}:${catalog}`;
  const currentScope = useRef(scope);
  currentScope.current = scope;
  const controller = useRef<AbortController | null>(null);
  const [preview, setPreview] = useState<{scope: string; data: DocumentImportAnalysis} | null>(null);
  const [busyState, setBusyState] = useState<{scope: string; value: boolean} | null>(null);
  const busy = busyState?.scope === scope && busyState.value;
  const setBusy = (value: boolean) => setBusyState({scope, value});
  const [error, setError] = useState('');
  const [pageIndex, setPageIndex] = useState(0);
  const [original, setOriginal] = useState(true);
  useEffect(() => () => {controller.current?.abort();}, [scope]);
  const prepare = async () => {
    if (!catalog || busy) return;
    setBusy(true); setError('');
    controller.current = new AbortController();
    try {
      await useStudioStore.getState().flushSaveSpread();
      const data = await documentImportService.reanalyze(catalog, controller.current.signal);
      if (currentScope.current === scope) {setPreview({scope, data}); setPageIndex(0);}
    } catch (failure) {if (currentScope.current === scope) setError(documentImportError(failure));}
    finally {if (currentScope.current === scope) setBusy(false);}
  };
  const dismiss = () => {
    controller.current?.abort();
    if (preview?.scope === scope) void documentImportService.cancel(preview.data.import_id).catch(() => {});
    setPreview(null); setBusy(false);
  };
  const confirm = async () => {
    if (!catalog || !preview || busy || preview.scope !== scope) return;
    setBusy(true); setError('');
    controller.current = new AbortController();
    try {
      await documentImportService.confirmReanalysis(catalog, preview.data.import_id, controller.current.signal);
      if (currentScope.current !== scope) return;
      await useStudioStore.getState().loadExistingCatalog(catalog);
      setPreview(null);
    } catch (failure) {if (currentScope.current === scope) setError(documentImportError(failure));}
    finally {if (currentScope.current === scope) setBusy(false);}
  };
  const page = preview?.scope === scope ? preview.data.pages?.[pageIndex] : undefined;
  return <>
    <button type="button" disabled={busy || !catalog} onClick={() => void prepare()} className="mt-2 min-h-11 rounded border px-3 py-2">{busy ? 'Analisando origem…' : 'Atualizar editabilidade'}</button>
    {error && <p role="alert">{error}</p>}
    {preview?.scope === scope && <ResponsiveModal label="Atualizar editabilidade" onDismiss={dismiss} className="fixed inset-0 z-[95] flex items-center justify-center bg-black/60 p-3">
      <div className="max-h-[90dvh] w-full max-w-3xl overflow-auto rounded-xl bg-white p-4 text-zinc-900">
        <p>Revise a nova camada. A substituição remove as edições das páginas importadas; o documento original permanece preservado.</p>
        <label>Página <select value={pageIndex} onChange={e => setPageIndex(Number(e.target.value))}>{preview.data.pages?.map((p, i) => <option key={p.pageNumber} value={i}>{p.pageNumber}</option>)}</select></label>
        <button type="button" onClick={() => setOriginal(value => !value)} className="min-h-11 px-3">{original ? 'Ver reconstrução' : 'Ver original'}</button>
        {page && <div className="mx-auto my-3 w-full max-w-md" style={{aspectRatio: `${page.pageWidth} / ${page.pageHeight}`}}><DocumentPageRenderer page={page} original={original} /></div>}
        <div className="flex flex-wrap gap-2"><button type="button" disabled={busy} onClick={() => void confirm()} className="min-h-11 rounded bg-sky-700 px-3 text-white">Confirmar substituição da reconstrução</button><button type="button" onClick={dismiss} className="min-h-11 rounded border px-3">Cancelar</button></div>
      </div>
    </ResponsiveModal>}
  </>;
}
