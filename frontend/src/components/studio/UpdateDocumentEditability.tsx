import { useEffect, useRef, useState } from 'react';
import { useStudioStore } from '../../store/studioStore';
import { documentImportService, documentImportError, type DocumentReanalysisReview } from '../../services/documentImportService';
import type { DocumentImportAnalysis } from '../../types/documentImport';
import { ResponsiveModal } from '../mobile/ResponsiveModal';
import { DocumentPageRenderer } from './DocumentPageRenderer';

/** Source reanalysis is a separate preview; unresolved revisions keep the current catalog. */
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
  const review = preview?.scope === scope ? preview.data.report?.reanalysis as DocumentReanalysisReview | undefined : undefined;
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
    if (!catalog || !preview || busy || preview.scope !== scope || review?.canConfirm !== true || review.conflicts.length) return;
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
  const pages = review?.reviewPages || (preview?.scope === scope ? preview.data.pages : undefined);
  const page = pages?.[pageIndex];
  return <>
    <button type="button" disabled={busy || !catalog} onClick={() => void prepare()} className="mt-2 min-h-11 rounded border px-3 py-2">{busy ? 'Analisando origem…' : 'Atualizar editabilidade'}</button>
    {error && <p role="alert">{error}</p>}
    {preview?.scope === scope && <ResponsiveModal label="Atualizar editabilidade" onDismiss={dismiss} className="fixed inset-0 z-[95] flex items-center justify-center bg-black/60 p-3">
      <div className="max-h-[90dvh] w-full max-w-3xl overflow-auto rounded-xl bg-white p-4 text-zinc-900">
        <p>Revise a nova camada antes de confirmar. As edições identificadas com segurança serão preservadas, junto com o documento original e as páginas adicionadas.</p>
        {review && <p>{review.preservedTextEdits} edições de texto, {review.preservedStyleEdits} edições de peso tipográfico e {review.preservedAuthoredPages} páginas adicionadas serão preservadas.</p>}
        {(review?.conflicts.length || review?.canConfirm !== true) && <div role="alert"><p>A atualização está bloqueada para proteger suas edições. O catálogo atual permanece salvo. Cancele e revise os elementos indicados antes de preparar outra prévia.</p><ul>{review?.conflicts.map((conflict, index) => <li key={index}>{conflict.pageNumber ? `Página ${conflict.pageNumber}: ` : ''}{conflict.elementId ? `elemento ${conflict.elementId}. ` : ''}{reanalysisConflictMessage(conflict.code)}</li>)}</ul></div>}
        <label>Página <select value={pageIndex} onChange={e => setPageIndex(Number(e.target.value))}>{pages?.map((p, i) => <option key={p.pageNumber} value={i}>{p.pageNumber}</option>)}</select></label>
        <button type="button" onClick={() => setOriginal(value => !value)} className="min-h-11 px-3">{original ? 'Ver reconstrução' : 'Ver original'}</button>
        {page && <div className="mx-auto my-3 w-full max-w-md" style={{aspectRatio: `${page.pageWidth} / ${page.pageHeight}`}}><DocumentPageRenderer page={page} original={original} /></div>}
        <div className="flex flex-wrap gap-2"><button type="button" disabled={busy || review?.canConfirm !== true || Boolean(review.conflicts.length)} onClick={() => void confirm()} className="min-h-11 rounded bg-sky-700 px-3 text-white">Confirmar atualização e preservar edições</button><button type="button" onClick={dismiss} className="min-h-11 rounded border px-3">Cancelar</button></div>
      </div>
    </ResponsiveModal>}
  </>;
}

function reanalysisConflictMessage(code: string) {
  if (code === 'catalog_changed_during_analysis') return 'O catálogo mudou durante a análise. Prepare outra prévia.';
  if (code === 'edited_target_not_editable') return 'O texto editado não foi comprovado como editável na nova análise.';
  if (code === 'edited_target_mapping_conflict') return 'Não foi possível associar a edição a um único elemento de origem.';
  if (code === 'redesign_requires_separate_review') return 'Esta página redesenhada precisa de uma revisão específica.';
  if (code === 'page_count_mismatch') return 'A nova análise diverge da quantidade de páginas da origem.';
  return 'A origem ou a revisão deste elemento não pôde ser validada com segurança.';
}
