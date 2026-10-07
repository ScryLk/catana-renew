import { Fragment, useEffect, useState, type CSSProperties } from 'react';
import type { CatalogPageData } from '../../data/editorialCatalog.mock';
import type { DocumentElement } from '../../types/documentImport';
import { isEditableDocumentText, normalizeDocumentPage } from '../../types/documentImport';
import { fitDocumentText } from '../../utils/documentTextFit';
import { resolveSafeFontFamily } from '../../utils/fontRegistry';
import { useStudioStore } from '../../store/studioStore';
import { ProtectedDocumentImage } from './ProtectedDocumentImage';
import { ResponsiveModal } from '../mobile/ResponsiveModal';

const sourceFont = (font?: string) => ['Arial', 'Times New Roman', 'Courier New'].includes(font || '')
  ? `"${font}", ${font === 'Courier New' ? 'monospace' : font === 'Times New Roman' ? 'serif' : 'sans-serif'}`
  : resolveSafeFontFamily(font);

export interface DocumentPageRendererProps {
  page: CatalogPageData;
  interactive?: boolean;
  original?: boolean;
  className?: string;
  style?: CSSProperties;
  onElementEdit?: (element: DocumentElement, text: string) => void;
}
export function DocumentPageRenderer({page, interactive = false, original = false, className = '', style, onElementEdit}: DocumentPageRendererProps) {
  const document = normalizeDocumentPage(page.documentPage);
  const [editing, setEditing] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [, setFontRevision] = useState(0);
  useEffect(() => {
    let current = true;
    const fonts = window.document.fonts;
    const refresh = () => {if (current) setFontRevision(value => value + 1);};
    void fonts?.ready.then(refresh);
    fonts?.addEventListener('loadingdone', refresh);
    return () => {current = false; fonts?.removeEventListener('loadingdone', refresh);};
  }, []);
  const editText = useStudioStore(state => state.updateDocumentText);
  const resetText = useStudioStore(state => state.resetDocumentText);
  const selectElement = useStudioStore(state => state.setSelectedElementId);
  if (!document) return <div role="alert" className={className} style={style}>Esta página não possui uma representação original válida.</div>;
  const textCandidates = document.elements.filter(element => element?.editable && element.type === 'text');
  const editable = textCandidates.filter(element => isEditableDocumentText(element) && (element.appearance || element.snapshot));
  const hasCleanLayer = Boolean(document.fallbackSnapshot) && editable.length > 0;
  const showSource = original || page.sourceVisibility === 'source_only' || document.visibility === 'source_only' || !hasCleanLayer;
  const target = document.elements.find(element => element.id === editing);
  const targetFit = target ? fitDocumentText(text, sourceFont(target.resolvedFont), target.fontSize || 12, target.width * document.width, target.height * document.height, target.fontWeight) : null;
  return <div className={`document-page-content relative w-full h-full overflow-hidden bg-white ${className}`} style={{containerType: 'inline-size', ...style}}
    data-render-mode="document" data-document-page={page.pageNumber} data-document-view={original ? 'original' : 'reconstructed'}>
    <ProtectedDocumentImage snapshot={document.sourceSnapshot} alt={`Página ${page.pageNumber} do documento`} className="absolute inset-0 w-full h-full" style={{objectFit: 'fill'}} />
    {!showSource && editable.map(element => {
      const geometry: CSSProperties = {position: 'absolute', left: `${element.x * 100}%`, top: `${element.y * 100}%`, width: `${element.width * 100}%`, height: `${element.height * 100}%`, zIndex: typeof element.zIndex === 'number' ? element.zIndex : 1};
      if (!element.edited) {
        const appearance = element.appearance;
        return <ProtectedDocumentImage key={element.id} snapshot={(appearance?.asset || element.snapshot)!} alt="" style={{...geometry,
          ...(appearance ? {left: `${appearance.x * 100}%`, top: `${appearance.y * 100}%`, width: `${appearance.width * 100}%`, height: `${appearance.height * 100}%`} : {}), objectFit: 'fill'}} />;
      }
      const fit = fitDocumentText(element.text ?? element.content ?? '', sourceFont(element.resolvedFont || element.font?.resolved), element.fontSize ?? element.font?.size ?? 12, element.width * document.width, element.height * document.height, element.fontWeight);
      const size = fit.size;
      const crop = element.appearance || element;
      return <Fragment key={element.id}>
        {/* Erase only this verified edit rectangle. Unsafe source pixels stay on the base. */}
        <div style={{position: 'absolute', left: `${crop.x * 100}%`, top: `${crop.y * 100}%`, width: `${crop.width * 100}%`, height: `${crop.height * 100}%`, overflow: 'hidden', zIndex: geometry.zIndex}}>
          <ProtectedDocumentImage snapshot={document.fallbackSnapshot!} alt="" style={{position: 'absolute', left: `${-crop.x / crop.width * 100}%`, top: `${-crop.y / crop.height * 100}%`, width: `${100 / crop.width}%`, height: `${100 / crop.height}%`, maxWidth: 'none', objectFit: 'fill'}} />
        </div>
        <div style={{...geometry, whiteSpace: 'pre-wrap', overflow: 'visible', fontFamily: sourceFont(element.resolvedFont || element.font?.resolved), fontSize: `${Math.max(1, Math.min(500, size)) / document.width * 100}cqw`, fontWeight: typeof element.fontWeight === 'number' ? element.fontWeight : 400, fontStyle: element.fontStyle === 'italic' ? 'italic' : 'normal', lineHeight: 1, color: /^#[a-f0-9]{3,8}$/i.test(element.color || '') ? element.color : '#000000'}}>{element.text ?? element.content ?? ''}{fit.overflow && <span role="status" style={{fontSize: '8px', background: '#fff', color: '#9a3412'}}> Texto excede a caixa de origem</span>}</div>
      </Fragment>;
    })}
    {interactive && !original && !showSource && editable.map(element => <button type="button" key={`edit-${element.id}`} aria-label={`Editar texto: ${(element.provenance?.sourceText || element.text || element.content || '').slice(0, 40)}`}
      className="absolute z-10 bg-transparent border border-transparent hover:border-sky-500 focus-visible:border-sky-500 focus-visible:outline-none"
      style={{left: `${element.x * 100}%`, top: `${element.y * 100}%`, width: `${element.width * 100}%`, height: `${element.height * 100}%`}}
      onClick={event => {event.stopPropagation(); selectElement(element.id); setEditing(element.id); setText(element.text ?? element.content ?? '');}} />)}
    {target && <ResponsiveModal label="Editar texto do documento" onDismiss={() => setEditing(null)} className="fixed inset-0 z-[95] flex items-center justify-center p-3 bg-black/60">
    <div className="w-full max-w-lg rounded-xl bg-white text-zinc-900 border border-zinc-300 shadow-lg p-4 text-sm max-h-[calc(100dvh-24px)] overflow-y-auto" role="group" aria-label="Editar texto do documento">
      {target.fontFallback && <p>A aparência original foi preservada. Ao editar este texto, será utilizada a fonte substituta {target.resolvedFont || 'segura'}.</p>}
      <p>Texto original: {target.provenance?.sourceText || target.text}</p>
      <p>Fonte para edição: {target.resolvedFont || 'segura'}</p>
      {targetFit?.overflow && <p role="alert">O texto excede a caixa de origem. Reduza o conteúdo antes de aplicar.</p>}
      <label>Texto do documento<textarea aria-label="Texto do documento" maxLength={20000} value={text} onChange={event => setText(event.target.value)} className="block w-full resize-y border border-zinc-300 rounded p-2 min-h-24 mt-2" /></label>
      <div className="flex flex-wrap gap-2 mt-2">
        <button type="button" disabled={Boolean(targetFit?.overflow)} className="rounded-lg px-3 min-h-11 bg-sky-600 text-white disabled:opacity-40" onClick={() => {if (onElementEdit) onElementEdit(target, text); else editText(page.pageNumber, target.id, text); setEditing(null);}}>Aplicar edição</button>
        <button type="button" className="rounded-lg px-3 min-h-11 border border-zinc-300" onClick={() => {resetText(page.pageNumber, target.id); setEditing(null);}}>Restaurar texto original</button>
        <button type="button" className="rounded-lg px-3 min-h-11 border border-zinc-300" onClick={() => setEditing(null)}>Fechar edição</button>
      </div>
    </div></ResponsiveModal>}
  </div>;
}
