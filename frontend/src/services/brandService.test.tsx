import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import api from './api';
import { adaptBrand, brandPayload, brandService, brandVisualUpdate, catalogBrandSnapshot, groupBrandCatalogs, pendingLegacyBrands, readBrandCache, readLegacyBrands, writeBrandCache } from './brandService';
import { useStudioStore, type Brand } from '../store/studioStore';
import { generateBrandTemplateMarkdown, parseBrandMarkdown } from '../utils/brandMarkdownParser';
import { GenerativeBlockRenderer } from '../components/studio/GenerativeBlockRenderer';
import type { CatalogPageData, GenerativeBlock } from '../data/editorialCatalog.mock';
import * as colorExtractor from '../utils/colorExtractor';

const palette = {name: 'Paleta Marca', primary: '#102A43', secondary: '#627D98', accent: '#E8EEF4', background: '#FFFFFF', locked: true, contrastRatio: 'legacy metadata'};
const backendBrand = (id = 'uuid-brand-1', organization = 1) => ({id, organization, name: 'Marca Industrial', logo_url: '/media/logo.png', custom_palette: palette, brand_markdown: 'AVOID [color]: Evitar dourado', tone_of_voice: 'Técnico e direto', commercial_contact: {whatsapp: '+5511999990000', email: 'contato@example.com', website: 'https://example.com'}, created_at: '2026-10-01T00:00:00Z', current_version: 1, status: 'active'});
const brand = (id = 'uuid-brand-1', organization = 1) => adaptBrand(backendBrand(id, organization));
const setScope = (organization = 1, user = 101) => {
  localStorage.setItem('active_organization', JSON.stringify({id: organization, name: `Empresa ${organization}`}));
  useStudioStore.getState().setActiveUserId(user);
};
const deferred = <T,>() => { let resolve!: (value: T) => void; let reject!: (error: Error) => void; const promise = new Promise<T>((yes, no) => {resolve = yes; reject = no;}); return {promise, resolve, reject}; };

beforeEach(() => { localStorage.clear(); useStudioStore.getState().resetStudioState(); });
afterEach(() => { useStudioStore.getState().cancelCatalogGeneration(); vi.useRealTimers(); vi.restoreAllMocks(); });

describe('Existing Brand contracts and safe legacy migration', () => {
  it('imports exact-user legacy once, retaining IDs, contacts, palette, logo, Markdown and original storage', async () => {
    const legacy: Brand = {...brand('legacy-brand'), logoUrl: 'data:image/png;base64,AAAA', catalogs: [{id: '101', title: 'Catálogo v1', totalPages: 4, category: 'Bombas', updatedAt: 'Agora'}]};
    const raw = JSON.stringify([legacy]);
    localStorage.setItem('katana_studio_brands:101', raw);
    localStorage.setItem('katana_studio_brands:202', JSON.stringify([{...legacy, id: 'private-other-user', name: 'Não importar'}]));
    const post = vi.spyOn(api, 'post').mockResolvedValue({data: {brands: [backendBrand()], id_mapping: {'legacy-brand': 'uuid-brand-1'}}});
    const imported = await brandService.migrate(101, 1);
    expect(imported.idMapping['legacy-brand']).toBe('uuid-brand-1');
    expect(post.mock.calls[0][1]).toEqual({organization: 1, brands: [{...legacy, guidelines_input: parseBrandMarkdown(legacy.brandMarkdown || '').guidelines}]});
    expect(localStorage.getItem('katana_studio_brands:101')).toBe(raw);
    expect(imported.brands[0]).toMatchObject({commercialContact: legacy.commercialContact, customPalette: legacy.customPalette, logoUrl: '/media/logo.png', brandMarkdown: legacy.brandMarkdown});
    await brandService.migrate(101, 1);
    expect(post).toHaveBeenCalledTimes(1);
    expect(pendingLegacyBrands(101, 1)).toEqual([]);
    expect(pendingLegacyBrands(202, 1)[0].id).toBe('private-other-user');
  });

  it('does not mark failed imports or read anonymous/global legacy keys', async () => {
    localStorage.setItem('katana_studio_brands:101', JSON.stringify([brand('legacy')]));
    localStorage.setItem('katana_studio_brands', JSON.stringify([brand('global')]));
    localStorage.setItem('katana_studio_brands:anonymous', JSON.stringify([brand('demo')]));
    vi.spyOn(api, 'post').mockRejectedValue(new Error('Unavailable'));
    await expect(brandService.migrate(101, 1)).rejects.toThrow('Unavailable');
    expect(pendingLegacyBrands(101, 1)).toHaveLength(1);
    expect(readLegacyBrands('anonymous')).toEqual([]);
    expect(readLegacyBrands(303)).toEqual([]);
  });

  it('rasterizes legacy SVG locally using the full image, keeping the original rollback copy', async () => {
    const svg = 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=';
    const legacy = {...brand('legacy-svg'), logoUrl: svg};
    const raw = JSON.stringify([legacy]); localStorage.setItem('katana_studio_brands:101', raw);
    const crop = vi.spyOn(colorExtractor, 'cropImageToDataUrl').mockResolvedValue('data:image/png;base64,AAAA');
    const post = vi.spyOn(api, 'post').mockResolvedValue({data: {brands: [backendBrand()], id_mapping: {'legacy-svg': 'uuid-brand-1'}}});
    await brandService.migrate(101, 1);
    expect(crop).toHaveBeenCalledWith(svg, {x: 0, y: 0, width: 1, height: 1});
    expect(post.mock.calls[0][1]).toMatchObject({brands: [{logoUrl: 'data:image/png;base64,AAAA'}]});
    expect(localStorage.getItem('katana_studio_brands:101')).toBe(raw);
  });

  it('retains legacy SVG and migration pending state when browser decoding fails', async () => {
    const legacy = {...brand('legacy-svg'), logoUrl: 'data:image/svg+xml;base64,broken'};
    localStorage.setItem('katana_studio_brands:101', JSON.stringify([legacy]));
    vi.spyOn(colorExtractor, 'cropImageToDataUrl').mockRejectedValue(new Error('Decode failed'));
    const post = vi.spyOn(api, 'post');
    await expect(brandService.migrate(101, 1)).rejects.toThrow('original neste navegador foi preservada');
    expect(post).not.toHaveBeenCalled();
    expect(pendingLegacyBrands(101, 1)[0].logoUrl).toBe(legacy.logoUrl);
  });

  it('scopes canonical cache to both organization and authenticated user', () => {
    writeBrandCache(101, 1, [brand('A', 1), brand('B', 2)]);
    expect(readBrandCache(101, 1).map(item => item.id)).toEqual(['A']);
    expect(readBrandCache(101, 2)).toEqual([]);
    expect(readBrandCache(202, 1)).toEqual([]);
  });

  it('groups catalogs by real Brand ID, retaining unlinked catalogs without name heuristics', () => {
    const grouped = groupBrandCatalogs([brand('A'), {...brand('B'), name: 'Marca Industrial Extra'}], [
      {id: 1, title: 'A', brand_id: 'A', brand_name: 'Marca Industrial Extra'},
      {id: 2, title: 'Avulso', brand_id: null, brand_name: 'Marca Industrial'},
      {id: 3, title: 'Não recriar marca', brand_id: 'missing', brand_name: 'Inventada'},
    ]);
    expect(grouped.brands.map(item => item.catalogs.map(catalog => catalog.id))).toEqual([['1'], []]);
    expect(grouped.unlinkedCatalogs.map(item => item.id)).toEqual(['2', '3']);
    expect(grouped.brands).toHaveLength(2);
  });

  it('imports its own accented Portuguese palette template and preserves untrusted guideline provenance', () => {
    const parsed = parseBrandMarkdown(generateBrandTemplateMarkdown('Marca Teste'));
    expect(parsed.name).toBe('Marca Teste');
    expect(parsed.palette).toMatchObject({primary: '#18181B', secondary: '#52525B', accent: '#B08D57'});
    expect(parsed.guidelines).toHaveLength(3);
    expect(parsed.guidelines.every(rule => rule.status === 'inferred' && rule.source === 'brand_markdown')).toBe(true);
    const payload = brandPayload({name: 'Marca', brandMarkdown: 'AVOID [color]: Evitar dourado', customPalette: palette}, 1);
    expect(payload.guidelines_input[0]).toMatchObject({type: 'AVOID', category: 'color', status: 'inferred'});
    expect(payload.custom_palette).toEqual(palette);
  });

  it('preserves background, surface, extra colors and provenance when saving three-swatches or renaming', () => {
    const saved: Brand = {...brand(), customPalette: {...palette, background: '#F0EEE8', surface: '#E0DED8'}, colors: [
      {role: 'primary', hex: palette.primary, source: 'brand_manual', status: 'confirmed'},
      {role: 'neutral', hex: '#888888', source: 'logo_analysis', status: 'inferred', confidence: 0.7},
      {role: 'forbidden', hex: '#FFD700', source: 'user_input', status: 'user_supplied'},
    ]};
    const update = brandVisualUpdate(saved, 'Nome atualizado', {primary: palette.primary, secondary: palette.secondary, accent: palette.accent}, 'user_input');
    expect(update.customPalette).toMatchObject({background: '#F0EEE8', surface: '#E0DED8', contrastRatio: 'legacy metadata'});
    expect(update.colors).toEqual(expect.arrayContaining(saved.colors!));
    expect(saved.colors).toHaveLength(3);
  });

  it('records an explicit color inference decision without fabricating a confirmed local state', async () => {
    const post = vi.spyOn(api, 'post').mockResolvedValue({data: {}});
    vi.spyOn(api, 'get').mockResolvedValue({data: {...backendBrand(), colors: [{role: 'neutral', hex: '#888888', source: 'logo_analysis', status: 'confirmed'}]}});
    const updated = await brandService.decide('uuid-brand-1', {kind: 'color', id: '0', status: 'confirmed'});
    expect(post).toHaveBeenCalledWith('/api/brands/uuid-brand-1/decisions/', {kind: 'color', id: 0, status: 'confirmed'});
    expect(updated.colors?.[0].status).toBe('confirmed');
  });
});

describe('Backend authority and asynchronous organization boundaries', () => {
  it('discards late Brand loads after switching organization, clearing selected identity immediately', async () => {
    const response = deferred<Brand[]>();
    vi.spyOn(brandService, 'list').mockReturnValue(response.promise);
    setScope();
    useStudioStore.setState({activeBrandId: 'A', brands: [brand('A')]});
    const loading = useStudioStore.getState().syncBrands();
    setScope(2);
    expect(useStudioStore.getState().brands).toEqual([]);
    expect(useStudioStore.getState().activeBrandId).toBeNull();
    response.resolve([brand('A')]); await loading;
    expect(useStudioStore.getState().brands).toEqual([]);
    expect(readBrandCache(101, 2)).toEqual([]);
  });

  it('keeps a failing cache read-only and supports explicit retry against the server', async () => {
    writeBrandCache(101, 1, [brand('A')]); setScope();
    const list = vi.spyOn(brandService, 'list').mockRejectedValueOnce(new Error('Offline')).mockResolvedValue([brand('B')]);
    const create = vi.spyOn(brandService, 'create');
    await useStudioStore.getState().syncBrands();
    expect(useStudioStore.getState().brandLoadStatus).toBe('error');
    expect(useStudioStore.getState().brands[0].id).toBe('A');
    await expect(useStudioStore.getState().addBrand({name: 'Offline edit'})).rejects.toThrow('sincronize');
    expect(create).not.toHaveBeenCalled();
    await useStudioStore.getState().syncBrands();
    expect(list).toHaveBeenCalledTimes(2);
    expect(useStudioStore.getState().brands[0].id).toBe('B');
  });

  it('never silently downgrades a selected cached Brand to an unlinked generation or blank catalog', async () => {
    setScope(); useStudioStore.setState({brandLoadStatus: 'error', brands: [brand('A')], activeBrandId: 'A'});
    const post = vi.spyOn(api, 'post');
    await useStudioStore.getState().createBlankCatalog('Marca offline');
    await useStudioStore.getState().triggerCatalogGeneration('Marca offline');
    expect(post).not.toHaveBeenCalled();
    expect(useStudioStore.getState().activeCatalogId).toBeNull();
    expect(useStudioStore.getState().isGeneratingCatalog).toBe(false);
  });

  it('does not hydrate a late create into another user or organization', async () => {
    const response = deferred<Brand>();
    setScope(); useStudioStore.setState({brandLoadStatus: 'ready'});
    vi.spyOn(brandService, 'create').mockReturnValue(response.promise);
    const creating = useStudioStore.getState().addBrand({name: 'A'});
    const rejection = expect(creating).rejects.toThrow('contexto mudou');
    setScope(2, 202); response.resolve(brand('A')); await rejection;
    expect(useStudioStore.getState().brands).toEqual([]);
    expect(useStudioStore.getState().activeBrandId).toBeNull();
  });

  it('does not hydrate late blank catalog creation into a different organization', async () => {
    const response = deferred<{data: {id: number; organization: number}}>();
    setScope(); useStudioStore.setState({brandLoadStatus: 'ready', brands: [brand('A')], activeBrandId: 'A'});
    vi.spyOn(api, 'post').mockReturnValue(response.promise);
    const creating = useStudioStore.getState().createBlankCatalog('A');
    setScope(2); response.resolve({data: {id: 101, organization: 1}}); await creating;
    expect(useStudioStore.getState().activeCatalogId).toBeNull();
    expect(useStudioStore.getState().pages).toEqual([]);
  });

  it('keeps the original catalog snapshot when current Brand version changes or inference is reviewed', async () => {
    setScope(); useStudioStore.setState({brandLoadStatus: 'ready', brands: [brand('A')], catalogBrandContext: catalogBrandSnapshot({brand_id: 'A', brand_version: 1, brand_snapshot: {identity: {name: 'Original'}}, brand_snapshot_hash: 'v1'})});
    vi.spyOn(brandService, 'update').mockResolvedValue({...brand('A'), name: 'Atualizada', currentVersion: 2});
    await useStudioStore.getState().updateBrand('A', {name: 'Atualizada'});
    const snapshot = useStudioStore.getState().catalogBrandContext;
    expect(snapshot.brandVersion).toBe(1);
    expect(snapshot.brandSnapshot).toEqual({identity: {name: 'Original'}});
    expect(snapshot.brandSnapshotHash).toBe('v1');
  });

  it('captures Brand selection at generation start and ignores cancelled operation responses', async () => {
    vi.useFakeTimers(); setScope();
    useStudioStore.setState({brandLoadStatus: 'ready', brands: [brand('A'), brand('B')], activeBrandId: 'A'});
    const old = deferred<{data: Record<string, unknown>}>();
    const current = deferred<{data: Record<string, unknown>}>();
    const post = vi.spyOn(api, 'post').mockReturnValueOnce(old.promise).mockReturnValueOnce(current.promise);
    const first = useStudioStore.getState().triggerCatalogGeneration('Primeiro');
    useStudioStore.getState().cancelCatalogGeneration(); useStudioStore.getState().setActiveBrandId('B');
    const second = useStudioStore.getState().triggerCatalogGeneration('Segundo');
    const generated = {catalogId: 'generated', studioCatalogId: 101, title: 'Catálogo', category: 'Bombas', palette, totalPages: 1, pages: [{id: 'p1', pageNumber: 1, type: 'cover', backgroundColor: '#FFFFFF', textColor: '#102A43', accentColor: '#E8EEF4'}]};
    old.resolve({data: {...generated, brandId: 'A'}}); await first;
    expect(useStudioStore.getState().generationTargetCatalog).toBeNull();
    current.resolve({data: {...generated, brandId: 'B', brandVersion: 2}}); await second;
    expect(useStudioStore.getState().generationTargetCatalog).toMatchObject({brandId: 'B', catalogId: '101'});
    expect(post.mock.calls.map(call => call[1])).toMatchObject([{brand_id: 'A', organization: 1}, {brand_id: 'B', organization: 1}]);
  });

  it('restores server snapshot, generative blocks and failed quality gate without client promotion', async () => {
    setScope();
    const gate = {passed: false, publishable: false, status: 'needs_review', reasons: ['BRAND_REVIEW']};
    vi.spyOn(api, 'get').mockResolvedValue({data: {id: 101, organization: 1, title: 'Histórico', brand: 'A', brand_version: 1, brand_snapshot: {identity: {name: 'Original'}}, qualityGate: gate, total_pages: 1, spreads: [{spread_index: 0, left_page: {id: 'p1', pageNumber: 1, type: 'cover', renderMode: 'generative', blocks: [{id: 'headline', type: 'headline', x: 0.1, y: 0.1, width: 0.8, height: 0.1, content: 'Original'}]}}]}});
    await useStudioStore.getState().loadExistingCatalog('101');
    expect(useStudioStore.getState().catalogBrandContext.brandVersion).toBe(1);
    expect(useStudioStore.getState().activeBrandId).toBe('A');
    expect(useStudioStore.getState().qualityGate).toEqual(gate);
    expect(useStudioStore.getState().pages[0].blocks?.[0].content).toBe('Original');
  });

  it('honors server publication-gate invalidation after saving an edited catalog', async () => {
    setScope();
    const passed = {passed: true, publishable: true, status: 'passed' as const, reasons: []};
    const review = {passed: false, publishable: false, status: 'needs_review' as const, reasons: ['DOCUMENT_CHANGED']};
    useStudioStore.setState({activeCatalogId: '101', qualityGate: passed, pages: [{id: 'p1', pageNumber: 1, type: 'cover', backgroundColor: '#FFFFFF', textColor: '#102A43', accentColor: '#E8EEF4'}]});
    vi.spyOn(api, 'post').mockResolvedValue({data: {qualityGate: review}});
    await useStudioStore.getState().flushSaveSpread();
    expect(useStudioStore.getState().qualityGate).toEqual(review);
    useStudioStore.getState().openExportModal();
    expect(useStudioStore.getState().isExportModalOpen).toBe(false);
  });
});

it('renders Brand logos without hover enlargement or cropping while preserving normal image treatment', () => {
  const page: CatalogPageData = {id: 'p1', pageNumber: 1, type: 'cover', renderMode: 'generative', backgroundColor: '#FFF', textColor: '#102A43', accentColor: '#E8EEF4'};
  const block: GenerativeBlock = {id: 'logo', type: 'image', role: 'brand_hallmark', imageUrl: '/media/logo.png', cropMode: 'cover', x: 0.1, y: 0.1, width: 0.4, height: 0.1};
  const markup = renderToStaticMarkup(<GenerativeBlockRenderer block={block} page={page} />);
  expect(markup).toContain('object-fit:contain');
  expect(markup).not.toContain('group-hover:scale');
  expect(renderToStaticMarkup(<GenerativeBlockRenderer block={{...block, role: 'editorial'}} page={page} />)).toContain('group-hover:scale-105');
});
