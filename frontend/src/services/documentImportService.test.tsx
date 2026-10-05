import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import api from './api';
import { documentImportService, documentImportWarning, fetchDocumentAsset, protectedDocumentAssetPath, validateDocumentFile } from './documentImportService';
import { normalizeDocumentPage, type DocumentPageIR } from '../types/documentImport';
import { normalizeCatalogDocument, type CatalogPageData } from '../data/editorialCatalog.mock';
import { useStudioStore } from '../store/studioStore';
import { DocumentPageRenderer } from '../components/studio/DocumentPageRenderer';
import { ProtectedDocumentImage } from '../components/studio/ProtectedDocumentImage';
import * as importService from './documentImportService';

const snapshot = (id = '11111111-1111-4111-8111-111111111111') => ({url: `/api/v2/studio/catalogs/import-document/assets/${id}/`, hash: `hash-${id}`, widthPixels: 1224, heightPixels: 1584});
const sourcePage = (number = 1): DocumentPageIR => ({pageNumber: number, width: number === 2 ? 792 : 612, height: number === 2 ? 612 : 792, unit: 'pt', visibility: 'hybrid', sourceSnapshot: snapshot(), fallbackSnapshot: snapshot('22222222-2222-4222-8222-222222222222'),
  elements: [{id: `t${number}`, type: 'text', text: 'Preço R$ 12,34', x: 0.1, y: 0.1, width: 0.5, height: 0.1, editable: true, fontSize: 14, resolvedFont: 'Arial', appearance: {asset: snapshot('33333333-3333-4333-8333-333333333333'), x: 0.08, y: 0.09, width: 0.54, height: 0.13}, provenance: {sourcePage: number, sourceElement: `t${number}`, sourceText: 'Preço R$ 12,34', sourceTextHash: 'immutable-text-hash', sourceBoundingBox: [61.2, 79.2, 367.2, 158.4]}}]});
const page = (number = 1): CatalogPageData => ({id: `source-${number}`, pageNumber: number, type: 'hero', renderMode: 'document', documentPage: sourcePage(number), backgroundColor: '#FFFFFF', textColor: '#000000', accentColor: '#000000', products: []});
const detail = (count = 7) => ({id: 51, organization: 1, title: 'Documento de origem', total_pages: count, import_metadata: {importId: 'import-1', mode: 'editable', share_enabled: false, quality: {passed: true, sourceRetained: true, geometryRetained: true, pageCountRetained: true}}, threads: [], unassigned_products: [],
  spreads: Array.from({length: Math.ceil(count / 2)}, (_, index) => ({spread_index: index, left_page: page(index * 2 + 1), right_page: index * 2 + 2 <= count ? page(index * 2 + 2) : null}))});
const setScope = (organization = 1) => {localStorage.setItem('active_organization', JSON.stringify({id: organization})); useStudioStore.getState().setActiveUserId(101);};
const deferred = <T,>() => {let resolve!: (value: T) => void; const promise = new Promise<T>(yes => {resolve = yes;}); return {promise, resolve};};
beforeEach(() => {vi.useFakeTimers(); localStorage.clear(); useStudioStore.getState().resetStudioState(); useStudioStore.setState({isExportModalOpen: false}); setScope();});
afterEach(() => {useStudioStore.getState().resetStudioState(); vi.clearAllTimers(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals();});

describe('Private analysis and explicit confirmation', () => {
  it('analyzes PDF without persistence or background removal, then supports explicit prepare/cancel', async () => {
    const post = vi.spyOn(api, 'post').mockResolvedValue({data: {import_id: 'import-1', status: 'ready', pages: [page()]}});
    const remove = vi.spyOn(api, 'delete').mockResolvedValue({});
    await documentImportService.analyze(new File(['%PDF-1.7'], 'catalog.pdf', {type: 'application/pdf'}), {organization: 1, title: 'Origem', mode: 'preserve'});
    const payload = post.mock.calls[0][1] as FormData;
    expect(payload.get('action')).toBe('analyze'); expect(payload.get('organization')).toBe('1'); expect(payload.get('mode')).toBe('preserve'); expect(payload.get('remove_background')).toBe('false');
    expect(useStudioStore.getState().activeCatalogId).toBeNull(); expect(useStudioStore.getState().pages).toEqual([]);
    await documentImportService.prepare('import-1', {title: 'Origem', mode: 'redesign', brandId: 'brand-1'});
    expect(post.mock.calls[1][1]).toMatchObject({action: 'prepare', import_id: 'import-1', mode: 'redesign', brand_id: 'brand-1'});
    await documentImportService.cancel('import-1'); expect(remove).toHaveBeenCalledWith('/api/v2/studio/catalogs/import-document/', {params: {import_id: 'import-1'}});
  });
  it('truthfully rejects DOCX, wrong MIME, empty and oversized input', () => {
    expect(() => validateDocumentFile(new File(['word'], 'catalog.docx'))).toThrow('exporte o documento como PDF');
    expect(() => validateDocumentFile(new File(['html'], 'catalog.pdf', {type: 'text/html'}))).toThrow('Apenas PDF');
    expect(() => validateDocumentFile(new File([], 'catalog.pdf'))).toThrow('25 MB');
    const oversized = {name: 'catalog.pdf', type: 'application/pdf', size: 25 * 1024 * 1024 + 1} as File;
    expect(() => validateDocumentFile(oversized)).toThrow('25 MB');
  });
  it('confirms idempotently by the same import ID and atomically reloads seven exact pages', async () => {
    vi.spyOn(documentImportService, 'confirm').mockResolvedValue({import_id: 'import-1', catalog_id: 51, status: 'confirmed'});
    vi.spyOn(api, 'post').mockResolvedValue({data: {}});
    vi.spyOn(api, 'get').mockImplementation(async (url) => ({data: String(url).includes('/51/') ? detail() : []}));
    useStudioStore.setState({catalogBrandContext: {brandId: 'old', brandVersion: 9, brandSnapshot: {secret: true}, brandSnapshotHash: 'old'}, unassignedProducts: [{id: 'old-product', category: 'old', index: '1', name: 'old'}], historyStack: [[page(9)]], messages: [{id: 'old-msg', role: 'user', content: 'old', timestamp: '00:00'}]});
    expect(await useStudioStore.getState().confirmDocumentImport('import-1', {title: 'Origem', mode: 'editable'})).toBe(true);
    expect(documentImportService.confirm).toHaveBeenCalledWith('import-1', {title: 'Origem', mode: 'editable', organization: 1});
    expect(useStudioStore.getState()).toMatchObject({activeCatalogId: '51', totalPages: 7, unassignedProducts: [], historyStack: [], activeBrandId: null, importMetadata: {share_enabled: false}});
    expect(useStudioStore.getState().pages).toHaveLength(7); expect(useStudioStore.getState().pages[1].documentPage?.width).toBe(792);
    useStudioStore.getState().goToSpread(3); expect(useStudioStore.getState().currentSpread).toEqual([7, 7]);
    useStudioStore.getState().nextSpread(); expect(useStudioStore.getState().currentSpread).toEqual([7, 7]);
    await useStudioStore.getState().confirmDocumentImport('import-1', {title: 'Origem', mode: 'editable'});
    expect(documentImportService.confirm).toHaveBeenCalledTimes(2); expect(useStudioStore.getState().activeCatalogId).toBe('51');
  });
  it('does not hydrate a late confirmation or fetch the saved document in another organization', async () => {
    const late = deferred<{import_id: string; catalog_id: number}>();
    vi.spyOn(documentImportService, 'confirm').mockReturnValue(late.promise); const get = vi.spyOn(api, 'get');
    const promise = useStudioStore.getState().confirmDocumentImport('import-1', {title: 'Origem', mode: 'preserve'});
    setScope(2); late.resolve({import_id: 'import-1', catalog_id: 51});
    expect(await promise).toBe(false); expect(get).not.toHaveBeenCalled(); expect(useStudioStore.getState().pages).toEqual([]);
  });
  it('invalidates a pending same-organization generation when the imported catalog is hydrated', async () => {
    const old = deferred<{data: Record<string, unknown>}>();
    vi.spyOn(api, 'post').mockReturnValue(old.promise);
    vi.spyOn(documentImportService, 'confirm').mockResolvedValue({import_id: 'import-1', catalog_id: 51});
    vi.spyOn(api, 'get').mockImplementation(async url => ({data: String(url).includes('/51/') ? detail(1) : []}));
    const generating = useStudioStore.getState().triggerCatalogGeneration('Documento antigo');
    expect(await useStudioStore.getState().confirmDocumentImport('import-1', {title: 'Origem', mode: 'preserve'})).toBe(true);
    old.resolve({data: {catalogId: 'old-gen', studioCatalogId: 99, title: 'Geração antiga', category: 'Antiga', totalPages: 1, pages: [page(99)]}});
    await generating; await vi.advanceTimersByTimeAsync(2000);
    expect(useStudioStore.getState()).toMatchObject({activeCatalogId: '51', isGeneratingCatalog: false, generationTargetCatalog: null});
    expect(useStudioStore.getState().pages[0].documentPage).toEqual(sourcePage());
  });
  it('keeps authorized work on the current catalog when an unconfirmed preview is simply closed', async () => {
    useStudioStore.setState({activeCatalogId: '40', pages: [page()], totalPages: 1});
    const result = deferred<{data: {sprite_url: string}}>();
    vi.spyOn(api, 'post').mockReturnValue(result.promise);
    const generating = useStudioStore.getState().generateSprite('Elemento anterior', 1);
    useStudioStore.getState().cancelDocumentImport();
    result.resolve({data: {sprite_url: '/media/authorized-sprite.png'}});
    expect(await generating).toBe('/media/authorized-sprite.png');
    expect(useStudioStore.getState().pages[0].overlays?.[0].imageUrl).toBe('/media/authorized-sprite.png');
  });
  it('ignores an older CoPilot stream patch and local fallback after the import changes the active document', async () => {
    useStudioStore.setState({activeCatalogId: '40', hasStartedSession: true, pages: [page()], totalPages: 1, currentSpread: [1, 1], threads: [{id: 'old', title: 'Anterior', mode: 'orchestrator', roleId: 'orchestrator', createdAt: '00:00', messages: []}], activeThreadId: 'old'});
    const chunk = deferred<{done: boolean; value?: Uint8Array}>();
    const read = vi.fn().mockReturnValue(chunk.promise); const cancel = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ok: true, body: {getReader: () => ({read, cancel})}}));
    const patch = vi.spyOn(useStudioStore.getState(), 'applySpreadPatch'); const fallback = vi.spyOn(useStudioStore.getState(), 'executeCopilotCommand');
    const chatting = useStudioStore.getState().sendMessageToAgent('Alterar o título');
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
    expect(read).toHaveBeenCalledTimes(1);
    vi.spyOn(api, 'post').mockResolvedValue({data: {}});
    vi.spyOn(documentImportService, 'confirm').mockResolvedValue({import_id: 'import-1', catalog_id: 51});
    vi.spyOn(api, 'get').mockImplementation(async url => ({data: String(url).includes('/51/') ? detail(1) : []}));
    await useStudioStore.getState().confirmDocumentImport('import-1', {title: 'Origem', mode: 'preserve'});
    chunk.resolve({done: false, value: new TextEncoder().encode('data: {"event":"patch","patch":{"updates":[{"page":1,"title":"Título antigo"}]}}\n')});
    await chatting;
    expect(patch).not.toHaveBeenCalled(); expect(fallback).not.toHaveBeenCalled(); expect(cancel).toHaveBeenCalledTimes(1);
    expect(useStudioStore.getState().activeCatalogId).toBe('51');
  });
  it('preserves the previous document and retries its failed save before confirming a new import', async () => {
    useStudioStore.setState({activeCatalogId: '40', hasStartedSession: true, pages: [page()], totalPages: 1, currentSpread: [1, 1], catalogTitle: 'Edição anterior', saveStatus: 'unsaved', threads: [{id: 'old', title: 'Anterior', mode: 'orchestrator', roleId: 'orchestrator', createdAt: '00:00', messages: []}], activeThreadId: 'old'});
    const previousSave = vi.spyOn(api, 'post').mockRejectedValueOnce(new Error('Save offline')).mockResolvedValue({data: {}});
    const confirm = vi.spyOn(documentImportService, 'confirm').mockResolvedValue({import_id: 'import-1', catalog_id: 51});
    vi.spyOn(api, 'get').mockImplementation(async url => ({data: String(url).includes('/51/') ? detail(1) : []}));
    await expect(useStudioStore.getState().confirmDocumentImport('import-1', {title: 'Novo', mode: 'editable'})).rejects.toThrow('salvar o catálogo atual');
    expect(confirm).not.toHaveBeenCalled(); expect(useStudioStore.getState().activeCatalogId).toBe('40');
    expect(useStudioStore.getState().pages[0].documentPage).toEqual(sourcePage());
    expect(await useStudioStore.getState().confirmDocumentImport('import-1', {title: 'Novo', mode: 'editable'})).toBe(true);
    expect(previousSave).toHaveBeenCalledTimes(2); expect(previousSave.mock.invocationCallOrder[1]).toBeLessThan(confirm.mock.invocationCallOrder[0]);
    expect(useStudioStore.getState().activeCatalogId).toBe('51');
  });
  it('keeps confirmation recoverable after the catalog was saved but private reload failed', async () => {
    vi.spyOn(documentImportService, 'confirm').mockResolvedValue({import_id: 'import-1', catalog_id: 51});
    const get = vi.spyOn(api, 'get').mockRejectedValueOnce(new Error('Network')).mockImplementation(async url => ({data: String(url).includes('/51/') ? detail(1) : []}));
    await expect(useStudioStore.getState().confirmDocumentImport('import-1', {title: 'Origem', mode: 'preserve'})).rejects.toThrow('Network');
    expect(useStudioStore.getState().activeCatalogId).toBeNull();
    expect(await useStudioStore.getState().confirmDocumentImport('import-1', {title: 'Origem', mode: 'preserve'})).toBe(true);
    expect(get).toHaveBeenCalledTimes(3); expect(useStudioStore.getState().pages).toHaveLength(1); expect(useStudioStore.getState().currentSpread).toEqual([1, 1]);
  });
});

describe('Source identity, safe images and progressive editing', () => {
  it('retains a decoded private image across parent rerenders and releases its blob on scope change', async () => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    const revoke = vi.fn();
    vi.stubGlobal('URL', class extends URL {static createObjectURL = vi.fn(() => 'blob:document-image'); static revokeObjectURL = revoke;});
    const fetchAsset = vi.spyOn(importService, 'fetchDocumentAsset').mockResolvedValue(new Blob(['pixels'], {type: 'image/png'}));
    const container = document.createElement('div'); document.body.append(container); const root = createRoot(container);
    try {
      await act(async () => {root.render(<ProtectedDocumentImage snapshot={{...snapshot()}} alt="Original" />);});
      expect(fetchAsset).toHaveBeenCalledTimes(1);
      await act(async () => {container.querySelector('img')!.dispatchEvent(new Event('load'));});
      expect(container.querySelector('img')?.dataset.documentAssetState).toBe('ready');
      await act(async () => {root.render(<ProtectedDocumentImage snapshot={{...snapshot()}} alt="Original" />);});
      expect(fetchAsset).toHaveBeenCalledTimes(1); expect(revoke).not.toHaveBeenCalled();
      expect(container.querySelector('img')?.dataset.documentAssetState).toBe('ready');
      await act(async () => {setScope(2);});
      expect(fetchAsset).toHaveBeenCalledTimes(2); expect(revoke).toHaveBeenCalledWith('blob:document-image');
    } finally {await act(async () => {root.unmount();}); container.remove();}
  });
  it('fetches private raster assets with the existing authenticated client and rejects other hosts or content', async () => {
    const get = vi.spyOn(api, 'get').mockResolvedValue({data: new Blob(['pixels'], {type: 'image/png'})});
    await fetchDocumentAsset(snapshot());
    expect(get).toHaveBeenCalledWith(snapshot().url, {responseType: 'blob', signal: undefined});
    expect(protectedDocumentAssetPath(`https://attacker.example${snapshot().url}`)).toBeNull();
    await expect(fetchDocumentAsset({...snapshot(), url: `https://attacker.example${snapshot().url}`})).rejects.toThrow('inválida');
    get.mockResolvedValue({data: new Blob(['svg'], {type: 'image/svg+xml'})});
    await expect(fetchDocumentAsset(snapshot())).rejects.toThrow('Imagem de documento inválida');
  });
  it('retains source geometry and does not manufacture Products from extracted commercial text', () => {
    const normalized = normalizeCatalogDocument({pages: [{...page(), products: [{id: 'fake', category: 'fake', index: '1', name: 'Inventado', price: 'Sob consulta'}]}]});
    expect(normalized.pages[0].renderMode).toBe('document'); expect(normalized.pages[0].products).toEqual([]);
    expect(normalized.pages[0].documentPage).toEqual(sourcePage());
    const invalid = sourcePage(); invalid.elements[0].appearance!.asset.url = 'javascript:alert(1)';
    expect(normalizeDocumentPage(invalid)).toEqual(invalid);
    expect(renderToStaticMarkup(<DocumentPageRenderer page={{...page(), documentPage: invalid}} interactive />)).not.toContain('Editar texto:');
    expect(normalizeDocumentPage({...sourcePage(), sourceSnapshot: {...snapshot(), url: 'data:image/svg+xml;base64,evil'}})).toBeNull();
  });
  it('explicit text edits retain source appearance/provenance and reset exactly to source text', () => {
    const original = sourcePage(); useStudioStore.setState({activeCatalogId: '51', pages: [page()], totalPages: 1});
    useStudioStore.getState().updateDocumentText(1, 't1', 'Texto revisado');
    const edited = useStudioStore.getState().pages[0].documentPage!;
    expect(edited.elements[0]).toMatchObject({text: 'Texto revisado', edited: true, provenance: original.elements[0].provenance, appearance: original.elements[0].appearance});
    expect(edited.sourceSnapshot).toEqual(original.sourceSnapshot); expect(edited.width).toBe(original.width);
    useStudioStore.getState().updatePage(1, {documentPage: {...original, width: 999, sourceSnapshot: snapshot('99999999-9999-4999-8999-999999999999')}});
    expect(useStudioStore.getState().pages[0].documentPage?.sourceSnapshot).toEqual(original.sourceSnapshot);
    useStudioStore.getState().resetDocumentText(1, 't1'); expect(useStudioStore.getState().pages[0].documentPage?.elements[0]).toMatchObject({text: 'Preço R$ 12,34', edited: false});
    const markup = renderToStaticMarkup(<DocumentPageRenderer page={{...page(), documentPage: edited}} />);
    expect(markup).toContain('container-type:inline-size'); expect(markup).toContain('Arial'); expect(markup).toContain('Texto revisado');
    expect(renderToStaticMarkup(<DocumentPageRenderer page={{...page(), documentPage: edited}} original />)).not.toContain('Texto revisado');
  });
  it('saves the odd last page once and updates server-controlled share invalidation metadata', async () => {
    useStudioStore.setState({activeCatalogId: '51', pages: Array.from({length: 7}, (_, index) => page(index + 1)), totalPages: 7, currentSpread: [7, 7], importMetadata: {importId: 'import-1', share_enabled: true}});
    const post = vi.spyOn(api, 'post').mockResolvedValue({data: {import_metadata: {importId: 'import-1', share_enabled: false, quality: {passed: false}}}});
    await useStudioStore.getState().flushSaveSpread();
    expect(post.mock.calls[0][1]).toMatchObject({spread_index: 3, left_page_elements: [page(7)], right_page_elements: []});
    expect(useStudioStore.getState().importMetadata?.share_enabled).toBe(false);
  });
  it('keeps the real minimal backend page wrapper byte-equivalent during an untouched hydration/save', async () => {
    const outsideCrop = {id: 'vector-outside-crop', type: 'vector', x: -0.4, y: 0.1, width: 1.8, height: 0.2, editable: false, provenance: {sourcePage: 1, sourceBoundingBox: [-244.8, 79.2, 856.8, 237.6]}};
    const original = {id: 'source-1', pageNumber: 1, renderMode: 'document', documentPage: {...sourcePage(), elements: [...sourcePage().elements, outsideCrop]}, pageWidth: 612, pageHeight: 792, sourceUnit: 'pt', products: []};
    const backend = {...detail(1), spreads: [{spread_index: 0, left_page_elements: [original], right_page_elements: []}]};
    vi.spyOn(api, 'get').mockResolvedValue({data: backend});
    const post = vi.spyOn(api, 'post').mockResolvedValue({data: {import_metadata: backend.import_metadata}});
    await useStudioStore.getState().loadExistingCatalog('51');
    await useStudioStore.getState().flushSaveSpread();
    // Strict server source approval must survive opening/exporting without an edit.
    const payload = post.mock.calls[0][1] as {left_page_elements: unknown[]; right_page_elements: unknown[]};
    expect(JSON.parse(JSON.stringify(payload.left_page_elements[0]))).toEqual(original);
    expect(payload.right_page_elements).toEqual([]);
    expect(useStudioStore.getState().importMetadata?.quality).toMatchObject({passed: true});
  });
  it('retains optional commercial fields exactly on an imported redesign without adding null metadata', () => {
    const product = {id: 'p1', category: 'source', index: '1', name: 'Nome exato da fonte', price: 'R$ 12,34'};
    const redesigned = {...page(), renderMode: 'generative' as const, products: [product], blocks: [{id: 'name', type: 'headline' as const, x: 0.1, y: 0.1, width: 0.5, height: 0.1, role: 'product_name', productId: 'p1', content: product.name}]};
    const normalized = normalizeCatalogDocument({pages: [redesigned]});
    expect(JSON.parse(JSON.stringify(normalized.pages[0]))).toEqual(redesigned);
  });
  it('translates analysis warnings without exposing codes or replacing descriptive messages', () => {
    expect(documentImportWarning('font_unavailable_source_preserved')).toContain('fonte original');
    expect(documentImportWarning('unknown_source_code')).not.toContain('unknown_source_code');
    expect(documentImportWarning('O redesenho requer revisão; a representação original foi preservada.')).toBe('O redesenho requer revisão; a representação original foi preservada.');
  });
  it('opts in only after the explicit share action succeeds, ignoring a late response in another tenant', async () => {
    useStudioStore.setState({activeCatalogId: '51', pages: [page()], currentSpread: [1, 1], importMetadata: {importId: 'import-1', share_enabled: false}});
    vi.spyOn(api, 'post').mockResolvedValue({data: {}}); const pending = deferred<{data: {import_metadata: {share_enabled: boolean}}}>();
    const put = vi.spyOn(api, 'put').mockReturnValue(pending.promise);
    useStudioStore.getState().openExportModal('pdf'); expect(put).not.toHaveBeenCalled(); useStudioStore.getState().closeExportModal();
    const sharing = useStudioStore.getState().openExportModal('share'); await Promise.resolve(); await Promise.resolve();
    expect(put).toHaveBeenCalledWith('/api/v2/studio/catalogs/51/', {share_import: true});
    setScope(2); pending.resolve({data: {import_metadata: {share_enabled: true}}}); await sharing;
    expect(useStudioStore.getState().isExportModalOpen).toBe(false); expect(useStudioStore.getState().importMetadata).toBeUndefined();
  });
});
