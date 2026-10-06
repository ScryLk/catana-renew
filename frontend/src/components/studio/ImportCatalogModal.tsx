import { useEffect, useRef, useState } from 'react';
import { FileUp, Loader2, UploadCloud, X } from 'lucide-react';
import { toast } from 'sonner';
import { ResponsiveModal } from '../mobile/ResponsiveModal';
import { useStudioStore } from '../../store/studioStore';
import { documentImportError, documentImportFailure, getCatalogQuota, type CatalogQuota, documentImportService, documentImportWarning, validateDocumentFile } from '../../services/documentImportService';
import type { DocumentImportAnalysis, DocumentImportMode } from '../../types/documentImport';
import type { CatalogPageData } from '../../data/editorialCatalog.mock';
import { DocumentPageRenderer } from './DocumentPageRenderer';
import { GenerativePageRenderer } from './GenerativePageRenderer';
import { CatalogLifecycleManager } from './CatalogLifecycleManager';
import { getPageGeometry } from '../../utils/pageGeometry';

interface ImportCatalogModalProps { isOpen: boolean; onClose: () => void }
const modes: Array<{id: DocumentImportMode; name: string; description: string}> = [
  {id: 'preserve', name: 'Preservar original', description: 'Mantém cada página com sua aparência e tamanho de origem.'},
  {id: 'editable', name: 'Original editável', description: 'Libera os textos seguros; elementos complexos mantêm sua representação original.'},
  {id: 'redesign', name: 'Rediagramar com marca', description: 'Cria uma proposta com a marca escolhida e os fatos do documento. A prévia exige revisão.'},
];
export function ImportCatalogModal({isOpen, onClose}: ImportCatalogModalProps) {
  const theme = useStudioStore(state => state.theme);
  const user = useStudioStore(state => state.activeUserId);
  const organization = useStudioStore(state => state.activeOrganizationId);
  const brands = useStudioStore(state => state.brands);
  const brandStatus = useStudioStore(state => state.brandLoadStatus);
  const confirmImport = useStudioStore(state => state.confirmDocumentImport);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [mode, setMode] = useState<DocumentImportMode>('preserve');
  const [brandId, setBrandId] = useState('');
  const [analysis, setAnalysis] = useState<DocumentImportAnalysis | null>(null);
  const [prepared, setPrepared] = useState({mode: 'preserve' as DocumentImportMode, brandId: ''});
  const [processing, setProcessing] = useState<'analyze' | 'prepare' | 'confirm' | null>(null);
  const [failedAction, setFailedAction] = useState<'analyze' | 'prepare' | 'confirm'>('analyze');
  const [error, setError] = useState<string | null>(null);
  const [quota, setQuota] = useState<CatalogQuota | null>(null);
  const [quotaError, setQuotaError] = useState('');
  const [errorCode, setErrorCode] = useState('');
  const [manager, setManager] = useState(false);
  const [quotaRevision, setQuotaRevision] = useState(0);
  const [view, setView] = useState<'original' | 'reconstructed' | 'comparison'>('original');
  const [pageIndex, setPageIndex] = useState(0);
  const [stateScope, setStateScope] = useState(`${user}:${organization}`);
  const input = useRef<HTMLInputElement>(null);
  const operation = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const analysisRef = useRef<DocumentImportAnalysis | null>(null);
  analysisRef.current = analysis;
  const scope = `${user}:${organization}`;
  useEffect(() => {
    operation.current += 1; controller.current?.abort();
    setStateScope(scope);
    setFile(null); setTitle(''); setAnalysis(null); setProcessing(null); setError(null); setErrorCode(''); setManager(false); setQuota(null); setBrandId(''); setPageIndex(0);
    return () => {operation.current += 1; controller.current?.abort();};
  }, [scope]);
  useEffect(() => {
    if (!isOpen) {operation.current += 1; controller.current?.abort(); setProcessing(null);}
  }, [isOpen]);
  useEffect(() => {
    if (!isOpen || organization == null) return;
    let current = true;
    setQuota(null); setQuotaError('');
    getCatalogQuota(organization).then(result => {if (current) setQuota(result);})
      .catch(() => {if (current) setQuotaError('Não foi possível consultar o limite. Atualize antes de salvar.');});
    const refresh = () => setQuotaRevision(value => value + 1);
    window.addEventListener('catana:catalog-quota-updated', refresh);
    window.addEventListener('catana:subscription-updated', refresh);
    window.addEventListener('focus', refresh);
    return () => {
      current = false;
      window.removeEventListener('catana:catalog-quota-updated', refresh);
      window.removeEventListener('catana:subscription-updated', refresh);
      window.removeEventListener('focus', refresh);
    };
  }, [isOpen, scope, organization, quotaRevision]);
  if (!isOpen || stateScope !== scope) return null;
  const isDark = theme === 'dark';
  const panel = isDark ? 'bg-[#101013] border-zinc-800 text-zinc-100' : 'bg-white border-zinc-200 text-zinc-900';
  const control = `w-full rounded-lg border px-3 py-2 text-sm ${isDark ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-zinc-300'}`;
  const pages = analysis?.pages || [];
  const page = pages[pageIndex];
  const report = analysis?.report || analysis?.document_ir?.report || {};
  const quality = (report.quality || {}) as Record<string, unknown>;
  const warnings = Array.isArray(report.warnings) ? report.warnings.filter((item): item is string => typeof item === 'string') : [];
  const editableCount = (analysis?.document_ir?.pages || []).reduce((count, item) => count + item.elements.filter(element => element.editable).length, 0);
  const outdated = Boolean(analysis && (mode !== prepared.mode || brandId !== prepared.brandId));
  const validScope = user != null && user !== 'anonymous' && organization != null;
  const selectFile = (selected: File) => {
    try {validateDocumentFile(selected);} catch (failure) {setError(documentImportError(failure)); return;}
    setFile(selected); setAnalysis(null); setError(null); setPageIndex(0);
    if (!title) setTitle(selected.name.replace(/\.pdf$/i, '').replace(/[-_]/g, ' '));
  };
  const dismiss = () => {
    operation.current += 1; controller.current?.abort(); setProcessing(null);
    useStudioStore.getState().cancelDocumentImport();
    const current = analysisRef.current;
    if (current && current.status !== 'confirmed' && !current.catalog_id) void documentImportService.cancel(current.import_id).catch(() => { /* The private server analysis also expires automatically. */ });
    setAnalysis(null); setError(null); onClose();
  };
  const run = async (action: 'analyze' | 'prepare' | 'confirm') => {
    if (!validScope) {setError('Selecione uma organização para importar o documento.'); return;}
    if (brandId && brandStatus !== 'ready') {setError('Sincronize as marcas antes de vincular este documento.'); return;}
    if (action === 'analyze' && !file) {setError('Selecione um PDF para analisar.'); return;}
    const currentOperation = ++operation.current;
    controller.current?.abort(); const request = new AbortController(); controller.current = request;
    const capturedScope = scope;
    const current = () => currentOperation === operation.current && `${useStudioStore.getState().activeUserId}:${useStudioStore.getState().activeOrganizationId}` === capturedScope;
    setProcessing(action); setFailedAction(action); setError(null); setErrorCode('');
    try {
      const options = {title: title.trim() || file?.name || 'Documento importado', mode, brandId: brandId || null};
      if (action === 'confirm') {
        if (!analysis?.catalog_id && (!quota || quota.remaining_catalog_slots <= 0)) return;
        if (!analysis || outdated) throw new Error('Atualize e revise a prévia antes de confirmar.');
        const loaded = await confirmImport(analysis.import_id, options);
        if (!current() || !loaded) return;
        setAnalysis(null); setFile(null); setTitle(''); setProcessing(null);
        toast.success('Catálogo importado com suas páginas de origem.'); onClose();
      } else {
        const result = action === 'prepare' && analysis
          ? await documentImportService.prepare(analysis.import_id, options, request.signal)
          : await documentImportService.analyze(file!, {...options, organization: organization!}, request.signal);
        if (!current()) return;
        if (!result.import_id || !Array.isArray(result.pages) || !result.pages.length) throw new Error('A análise não retornou uma representação válida do documento.');
        setAnalysis(result); setPrepared({mode, brandId}); setPageIndex(0); setView('original');
      }
    } catch (failure) {if (current() && !request.signal.aborted) {
      const result = documentImportFailure(failure); setError(result.message); setErrorCode(result.code);
      if (result.code === 'catalog_limit_exceeded') setQuotaRevision(value => value + 1);
      // A lost response may already have filled the final slot. Recover the
      // committed job before applying save eligibility to a subsequent retry.
      if (action === 'confirm' && analysis && result.code !== 'catalog_limit_exceeded') {
        try {
          const recovered = await documentImportService.get(analysis.import_id);
          if (current() && recovered.catalog_id) setAnalysis(recovered);
        } catch { /* The same import ID remains available for a transient retry. */ }
      }
    }}
    finally {if (current()) setProcessing(null);}
  };
  const preview = (item: CatalogPageData, original: boolean) => {
    const geometry = getPageGeometry(item);
    return <div className="relative mx-auto bg-white overflow-hidden shadow-[0_0_0_1px_#d4d4d8]" style={{width: `min(100%, calc(48vh * ${geometry.width / geometry.height}))`, aspectRatio: `${geometry.width}/${geometry.height}`}}>
      {original || item.renderMode === 'document' ? <DocumentPageRenderer page={item} original={original} /> : <GenerativePageRenderer page={item} />}
    </div>;
  };
  return <ResponsiveModal label="Importar catálogo" onDismiss={dismiss} className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/75">
    <div className={`w-full max-w-3xl rounded-2xl border flex flex-col overflow-hidden max-h-[calc(100dvh-24px)] ${panel}`}>
      <div className="px-4 py-3 border-b border-zinc-500/20 flex items-center justify-between gap-3 shrink-0">
        <div className="min-w-0"><h2 className="font-semibold flex items-center gap-2"><FileUp className="size-4" />Importar Catálogo</h2><p className="text-xs text-zinc-500">Analise, compare e confirme as páginas antes de salvar.</p></div>
        <button type="button" onClick={dismiss} aria-label="Fechar importação" className="p-2 shrink-0"><X className="size-4" /></button>
      </div>
      <div className="p-4 overflow-y-auto min-h-0 space-y-4">
        {validScope && <section aria-label="Limite de catálogos" className="text-sm border border-zinc-500/30 rounded-lg p-3 space-y-2">
          <p role="status">{quota ? `${quota.active_catalogs} de ${quota.max_active_catalogs} catálogos ativos` : quotaError || 'Consultando limite de catálogos…'}</p>
          {quota && quota.remaining_catalog_slots <= 0 && <p>Você pode analisar este documento, mas precisará arquivar um catálogo ou alterar o plano antes de salvar.</p>}
          <div className="flex flex-wrap gap-2">
            <button type="button" className="underline min-h-11" onClick={() => setManager(value => !value)}>Gerenciar catálogos</button>
            <button type="button" className="underline min-h-11" onClick={() => window.dispatchEvent(new CustomEvent('catana:open-billing-modal'))}>Ver planos</button>
            <button type="button" className="underline min-h-11" onClick={() => {setError(null); setErrorCode(''); setQuotaRevision(value => value + 1);}}>Atualizar limite</button>
          </div>
          {manager && organization != null && <CatalogLifecycleManager organization={organization} />}
        </section>}
        {!validScope && <p role="alert" className="text-sm text-amber-600">Selecione uma organização para importar o documento.</p>}
        {!analysis && <div>
          <input ref={input} type="file" aria-label="Arquivo PDF" accept=".pdf,application/pdf" className="sr-only" disabled={Boolean(processing)} onChange={event => {const selected = event.target.files?.[0]; if (selected) selectFile(selected);}} />
          <button type="button" className="w-full border-2 border-dashed border-zinc-500/30 rounded-xl p-5 text-center" disabled={Boolean(processing)}
            onDragOver={event => event.preventDefault()} onDrop={event => {event.preventDefault(); if (!processing && event.dataTransfer.files[0]) selectFile(event.dataTransfer.files[0]);}} onClick={() => input.current?.click()}>
            <UploadCloud className="size-5 mx-auto mb-2" /><span className="block text-sm break-all">{file?.name || 'Selecionar PDF ou arrastar arquivo'}</span><span className="text-xs text-zinc-500">PDF • máximo 25 MB</span>
          </button>
          <p className="text-xs text-zinc-500 mt-2">Para importar Word, exporte o documento como PDF.</p>
        </div>}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="text-xs">Título do catálogo<input aria-label="Título do catálogo" className={`${control} mt-1`} value={title} disabled={Boolean(processing)} onChange={event => setTitle(event.target.value)} /></label>
          <label className="text-xs">Marca do catálogo<select aria-label="Marca do catálogo" className={`${control} mt-1`} value={brandId} disabled={Boolean(processing)} onChange={event => setBrandId(event.target.value)}>
            <option value="">Sem marca</option>{brands.filter(brand => brand.status !== 'archived' && brand.organization === organization).map(brand => <option key={brand.id} value={brand.id} disabled={brandStatus !== 'ready'}>{brand.name}</option>)}
          </select></label>
        </div>
        <fieldset disabled={Boolean(processing)} className="space-y-2"><legend className="text-xs font-semibold mb-2">Modo de importação</legend>
          {modes.map(option => <label key={option.id} className={`flex gap-2 items-start border rounded-lg p-2.5 cursor-pointer ${mode === option.id ? 'border-sky-500' : 'border-zinc-500/20'}`}>
            <input type="radio" name="document-import-mode" value={option.id} checked={mode === option.id} onChange={() => setMode(option.id)} className="mt-0.5" />
            <span className="min-w-0"><span className="text-sm block">{option.name}</span><span className="text-xs text-zinc-500 block">{option.description}</span></span>
          </label>)}
        </fieldset>
        <p className="text-xs text-zinc-500">Imagens e fundos são preservados. Isolamento de produto indisponível nesta etapa: nenhum recorte automático será aplicado.</p>
        {processing && <div role="status" className="flex items-center gap-2 text-sm"><Loader2 className="size-4 animate-spin shrink-0" />{processing === 'confirm' ? 'Salvando catálogo…' : processing === 'prepare' ? 'Atualizando prévia…' : 'Analisando documento…'}</div>}
        {error && <div role="alert" className="rounded-lg p-3 text-sm border border-red-500/30 space-y-2"><p>{error}</p>{!['catalog_limit_exceeded', 'quota_exceeded', 'permission_denied'].includes(errorCode) && <button type="button" onClick={() => void run(failedAction)} disabled={Boolean(processing)} className="underline">Tentar novamente</button>}</div>}
        {analysis && <>
          <section aria-label="Relatório de importação" className="text-xs border border-zinc-500/20 rounded-lg p-3 space-y-1">
            <p className="font-semibold">{prepared.mode === 'preserve' ? `${pages.length} páginas preservadas com fidelidade` : prepared.mode === 'redesign' ? `${pages.length} páginas de origem preservadas • proposta pronta para revisão` : `${pages.length} páginas preservadas • ${editableCount} textos editáveis`}</p>
            <p>A geometria de origem é mantida. O documento original permanece disponível para comparação.</p>
            {quality.status === 'needs_review' && <p className="text-amber-600">A proposta precisa de revisão; o original foi preservado.</p>}
            {prepared.mode === 'editable' && !editableCount && <p>Esta análise preserva as páginas como imagens. Não há textos seguros para edição.</p>}
            <details><summary>Detalhes da análise</summary>
              <p>Textos detectados: {Number(report.liveTextElementCount || 0)}</p>
              <p>Textos editáveis: {editableCount}</p>
              <p>Textos com fonte substituta: {Number(report.fontFallbackTextCount || 0)}</p>
              <p>Textos preservados por clipping: {Number(report.clippedTextCount || 0)}</p>
              <p>Textos não seguros: {Number(report.unsafeTextCount || 0)}</p>
            </details>
            {warnings.map((warning, index) => <p key={index} className="text-amber-600">{documentImportWarning(warning)}</p>)}
          </section>
          {outdated && <p role="status" className="text-xs text-amber-600">Atualize a prévia para revisar o modo e a marca escolhidos.</p>}
          <section aria-label="Prévia do documento" className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              {(['original', 'reconstructed', 'comparison'] as const).map((value, index) => <button type="button" key={value} aria-pressed={view === value} onClick={() => setView(value)} className={`text-xs px-3 py-2 rounded-lg border ${view === value ? 'border-sky-500' : 'border-zinc-500/20'}`}>{['Original', 'Reconstruído', 'Comparação'][index]}</button>)}
              <select aria-label="Página da prévia" className="text-xs border border-zinc-500/30 rounded-lg p-2 bg-transparent" value={pageIndex} onChange={event => setPageIndex(Number(event.target.value))}>{pages.map((item, index) => <option key={item.id} value={index}>Página {index + 1}</option>)}</select>
            </div>
            {page && (view === 'comparison' ? <div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><div><p className="text-xs mb-1">Original</p>{preview(page, true)}</div><div><p className="text-xs mb-1">Reconstruído</p>{preview(page, false)}</div></div> : preview(page, view === 'original'))}
          </section>
        </>}
      </div>
      <div className="px-4 py-3 border-t border-zinc-500/20 flex flex-wrap justify-end gap-2 shrink-0">
        <button type="button" onClick={dismiss} className="rounded-lg px-3 py-2 text-sm border border-zinc-500/30">{analysis || processing ? 'Cancelar análise' : 'Cancelar'}</button>
        {!analysis ? <button type="button" disabled={!file || !validScope || Boolean(processing)} onClick={() => void run('analyze')} className="rounded-lg px-4 py-2 text-sm bg-sky-600 text-white disabled:opacity-40">Analisar documento</button>
          : outdated ? <button type="button" disabled={Boolean(processing)} onClick={() => void run('prepare')} className="rounded-lg px-4 py-2 text-sm bg-sky-600 text-white disabled:opacity-40">Atualizar prévia</button>
          : <button type="button" disabled={Boolean(processing) || (!analysis.catalog_id && (!quota || quota.remaining_catalog_slots <= 0))} onClick={() => void run('confirm')} className="rounded-lg px-4 py-2 text-sm bg-sky-600 text-white disabled:opacity-40">{analysis.catalog_id ? 'Abrir catálogo importado' : quota && quota.remaining_catalog_slots <= 0 ? 'Sem vagas para novos catálogos' : 'Confirmar importação'}</button>}
      </div>
    </div>
  </ResponsiveModal>;
}
