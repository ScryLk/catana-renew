import { test, expect, type Page, type Locator, type Request } from '@playwright/test';
import { createHash } from 'node:crypto';
import { deflateSync } from 'node:zlib';
import { isDeepStrictEqual } from 'node:util';
import { importEditingBridge } from './import-editing-bridge';

const ENDPOINT = '/api/v2/studio/catalogs/import-document/';
const IMPORT_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const BRAND_ID = '11111111-1111-4111-8111-111111111111';
const organization = {
  id: 1, name: 'Import QA', owner: 1, default_sede: 1,
  created_at: '2026-01-01', updated_at: '2026-01-01',
  sedes: [{ id: 1, name: 'Sede QA', organization: 1, members_count: 1,
    created_at: '2026-01-01', updated_at: '2026-01-01' }],
};
const otherOrganization = { ...organization, id: 2, name: 'Outro contexto QA', default_sede: 2,
  sedes: [{ ...organization.sedes[0], id: 2, organization: 2 }] };
const brand = {
  id: BRAND_ID, organization: 1, name: 'Marca aprovada QA', segment: 'Indústria',
  logo_url: '', palette_name: 'Azul QA', custom_palette: { name: 'Azul QA', primary: '#124E78', secondary: '#FAF8F1', accent: '#F8C23A' },
  brand_markdown: '# Manual fornecido pelo usuário', tone_of_voice: 'Claro', commercial_contact: {},
  current_version: 2, status: 'active', created_at: '2026-01-01', colors: [], guidelines: [], memories: [], assets: [],
  intelligence: { positioning: { value: 'Sustentável', source: 'catalog-analysis', status: 'inferred', confidence: 0.6 } },
};
type Mode = 'preserve' | 'editable' | 'redesign';
type Json = Record<string, unknown>;
interface ImportRequest { action?: string; import_id?: string | null; organization?: string | number; mode?: string; title?: string; brand_id?: string | null }
interface CatalogFixture {
  id: number; organization: number; title: string; total_pages: number; brand: string | null; brand_name: string;
  brand_version: number | null; brand_snapshot: { id?: string; name?: string; version?: number; palette?: Json }; brand_snapshot_hash: string;
  page_width: number; page_height: number;
  import_metadata: { importId: string; mode: string; sourceFingerprint: string; report: Json; share_enabled: boolean };
  spreads: Array<{ id: number; spread_index: number; left_page: SourcePage; right_page: SourcePage | null; left_page_elements: SourcePage[]; right_page_elements: SourcePage[] }>;
}
type SourcePage = ReturnType<typeof makePreview>['pages'][number];
interface Asset { body: Buffer; width: number; height: number; hash: string }
interface FixtureState {
  quotaUsed?: number; quotaConfirmFailures?: number;
  analyses: ImportRequest[]; preparations: ImportRequest[]; confirmations: ImportRequest[]; cancellations: ImportRequest[]; brandWrites: Json[];
  assetRequests: Array<{ path: string; authorization: string | undefined }>;
  catalogs: CatalogFixture[]; analysisFailures: number; lostConfirmationResponses: number;
  spreadWrites: Array<{ body: Json; unchanged: boolean }>;
  analysisGate?: Promise<void>; releaseAnalysis?: () => void;
  preview?: ReturnType<typeof makePreview>;
}

// Inert, invented sources only: no customer attachment, external image or paid AI.
// The PDF and source/fallback/crop pixels make the mocked browser contract deterministic.
function sourceDimensions(count: number, mixed: boolean): number[][] {
  return mixed ? [[595, 842], [612, 792], [400, 400], [792, 612], [300, 900], [900, 300], [595, 842], [595, 842]].slice(0, count)
    : Array.from({ length: count }, () => [595, 842]);
}
function syntheticPdf(count = 7, mixed = false) {
  const objects: string[] = [];
  const add = (value: string) => { objects.push(value); return objects.length; };
  add('<< /Type /Catalog /Pages 2 0 R >>');
  add(`<< /Type /Pages /Kids [${Array.from({ length: count }, (_, i) => `${i * 2 + 3} 0 R`).join(' ')}] /Count ${count} >>`);
  for (let index = 0; index < count; index++) {
    const [width, height] = sourceDimensions(count, mixed)[index];
    const contents = `q 0.07 0.31 0.47 rg 0 ${height - 80} ${width} 80 re f Q`;
    add(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] /Resources << >> /Contents ${objects.length + 2} 0 R >>`);
    add(`<< /Length ${contents.length} >>\nstream\n${contents}\nendstream`);
  }
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object, index) => { offsets.push(Buffer.byteLength(pdf)); pdf += `${index + 1} 0 obj\n${object}\nendobj\n`; });
  const start = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map(offset => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${start}\n%%EOF\n`;
  return Buffer.from(pdf);
}
function crc32(bytes: Buffer) {
  let crc = 0xffffffff;
  for (const byte of bytes) { crc ^= byte; for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0); }
  return (crc ^ 0xffffffff) >>> 0;
}
function png(width: number, height: number, rgb: Buffer) {
  const chunk = (kind: string, body: Buffer) => {
    const type = Buffer.from(kind); const size = Buffer.alloc(4); size.writeUInt32BE(body.length);
    const checksum = Buffer.alloc(4); checksum.writeUInt32BE(crc32(Buffer.concat([type, body])));
    return Buffer.concat([size, type, body, checksum]);
  };
  const header = Buffer.alloc(13); header.writeUInt32BE(width); header.writeUInt32BE(height, 4); header[8] = 8; header[9] = 2;
  const rows = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y++) rgb.copy(rows, y * (width * 3 + 1) + 1, y * width * 3, (y + 1) * width * 3);
  return Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), chunk('IHDR', header), chunk('IDAT', deflateSync(rows)), chunk('IEND', Buffer.alloc(0))]);
}
function pagePixels(width: number, height: number, pageNumber: number) {
  const rgb = Buffer.alloc(width * height * 3);
  for (let index = 0; index < rgb.length; index += 3) { rgb[index] = 250; rgb[index + 1] = 248; rgb[index + 2] = 241; }
  const rectangle = (x: number, y: number, w: number, h: number, color: number[]) => {
    for (let row = y; row < Math.min(y + h, height); row++) for (let col = x; col < Math.min(x + w, width); col++) {
      const index = (row * width + col) * 3; rgb[index] = color[0]; rgb[index + 1] = color[1]; rgb[index + 2] = color[2];
    }
  };
  rectangle(0, 0, width, 80, [18, 78, 120]);
  rectangle(18, 18, 90, 22, [248, 194, 58]);
  rectangle(30, 150, Math.floor(width / 2), Math.floor(height / 4), [70 + pageNumber * 5, 135, 155]);
  const clean = Buffer.from(rgb);
  for (let line = 0; line < 3; line++) rectangle(80, 100 + line * 12, 250 - line * 30, 5, [25, 35, 45]);
  const cropWidth = Math.min(280, width - 80);
  const crop = Buffer.alloc(cropWidth * 40 * 3);
  for (let y = 0; y < 40; y++) rgb.copy(crop, y * cropWidth * 3, ((100 + y) * width + 80) * 3, ((100 + y) * width + 80 + cropWidth) * 3);
  return { source: png(width, height, rgb), fallback: png(width, height, clean), appearance: png(cropWidth, 40, crop), cropWidth };
}

function makePreview(mode: Mode, count: number, mixed: boolean, assets: Map<string, Asset>, title: string, brandId?: string) {
  let assetNumber = 0;
  const store = (body: Buffer, width: number, height: number) => {
    const id = `00000000-0000-4000-8000-${String(++assetNumber).padStart(12, '0')}`;
    const url = `${ENDPOINT}assets/${id}/`; const hash = createHash('sha256').update(body).digest('hex');
    assets.set(url, { body, width, height, hash });
    return { url, assetId: id, mediaId: id, hash, widthPixels: width, heightPixels: height };
  };
  const dimensions = sourceDimensions(count, mixed);
  const pages = Array.from({ length: count }, (_, index) => {
    const [width, height] = dimensions[index]; const pageNumber = index + 1;
    const pixels = pagePixels(width, height, pageNumber);
    const sourceSnapshot = store(pixels.source, width, height);
    const fallbackSnapshot = store(pixels.fallback, width, height);
    const appearanceAsset = store(pixels.appearance, pixels.cropWidth, 40);
    const text = pageNumber === 3 ? 'Capacidades 15 L e 30 L' : `Texto original da página ${pageNumber}`;
    const documentPage = {
      pageNumber, width, height, unit: 'pt', rotation: 0, mediaBox: [0, 0, width, height], cropBox: [0, 0, width, height],
      pageType: 'born_digital', visibility: mode === 'preserve' ? 'source_only' : 'hybrid', sourceSnapshot, fallbackSnapshot,
      elements: [{ id: `text-${pageNumber}`, type: 'text', text, sourceText: text,
        x: 80 / width, y: 100 / height, width: pixels.cropWidth / width, height: 40 / height,
        rotation: 0, zIndex: 1, editable: true, confidence: 0.96, color: '#19232D', opacity: 1,
        fontFamily: 'Helvetica', resolvedFont: 'Arial', fontSize: 18, fontWeight: 400, fontFallback: true,
        provenance: { sourcePage: pageNumber, sourceElement: `text-${pageNumber}`, sourceText: text,
          sourceBoundingBox: [80, 100, 80 + pixels.cropWidth, 140], sourceTextHash: createHash('sha256').update(text).digest('hex'), confidence: 0.96 },
        appearance: { asset: appearanceAsset, x: 80 / width, y: 100 / height, width: pixels.cropWidth / width, height: 40 / height } }],
      quality: { status: mode === 'preserve' ? 'preserved' : 'needs_review', sourcePreserved: true, editableCount: 1, fallbackCount: 1,
        verification: { method: 'source_pixel_comparison', exactPixels: true, meanAbsoluteChannelError: 0 } },
    };
    return { id: `import-page-${pageNumber}`, pageNumber, renderMode: 'document', documentPage, pageWidth: width, pageHeight: height,
      sourceUnit: 'pt', products: [] };
  });
  const report = { pageCount: count, sourcePreservedCount: count, pagesPreserved: count, editableCount: mode === 'preserve' ? 0 : count,
    fallbackCount: count, sourceOnlyPageCount: mode === 'preserve' ? count : 0, commercialValuesInvented: 0, mode,
    ocrAvailable: false, warnings: ['Fonte Helvetica preservada na aparência; a edição usa Arial.'],
    quality: { passed: true, sourceRetained: true, pageCountRetained: true, geometryRetained: true, status: mode === 'preserve' ? 'faithful' : 'hybrid' } };
  const document_ir = { schemaVersion: 1, filename: 'source-qa.pdf', pageCount: count, pages: pages.map(page => page.documentPage),
    candidates: [{ name: 'Sacos QA', capacities: ['15 L', '30 L'], price: null, sku: null, availability: null, sourcePage: 3 }], report };
  return { import_id: IMPORT_ID, status: 'ready', title, mode, source_fingerprint: createHash('sha256').update(syntheticPdf(count, mixed)).digest('hex'),
    total_pages: count, pages, document_ir, report, expires_at: '2099-01-01T00:00:00Z', brand_id: brandId || null };
}
function multipartField(request: Request, key: string) {
  return request.postData()?.match(new RegExp(`name="${key}"\\r\\n\\r\\n([^\\r]*)`))?.[1];
}
async function fixture(page: Page, options: { count?: number; mixed?: boolean; holdAnalysis?: boolean; analysisFailures?: number; lostConfirmationResponses?: number } = {}) {
  const state: FixtureState = { analyses: [], preparations: [], confirmations: [], cancellations: [], brandWrites: [], assetRequests: [], catalogs: [], spreadWrites: [],
    analysisFailures: options.analysisFailures || 0, lostConfirmationResponses: options.lostConfirmationResponses || 0 };
  if (options.holdAnalysis) state.analysisGate = new Promise<void>(resolve => { state.releaseAnalysis = resolve; });
  const assets = new Map<string, Asset>();
  await page.addInitScript(({ organization }) => {
    sessionStorage.setItem('catana_splash_shown', 'true');
    localStorage.setItem('active_organization', JSON.stringify(organization));
    localStorage.setItem('active_sede', JSON.stringify(organization.sedes[0]));
  }, { organization });
  await page.route('**/api/**', async route => {
    const request = route.request(); const url = new URL(request.url()); const path = url.pathname; const method = request.method();
    if (method === 'OPTIONS') return route.fulfill({ status: 204 });
    if (path.startsWith(`${ENDPOINT}assets/`)) {
      const authorization = request.headers().authorization;
      state.assetRequests.push({ path, authorization });
      if (!authorization?.startsWith('Bearer ')) return route.fulfill({ status: 401, json: { detail: 'Private document asset requires authentication' } });
      const asset = assets.get(path);
      return route.fulfill(asset ? { contentType: 'image/png', body: asset.body, headers: { 'Cache-Control': 'private, no-store' } } : { status: 404, json: { detail: 'Asset not found' } });
    }
    if (path === ENDPOINT) {
      if (method === 'DELETE') { state.cancellations.push({ import_id: url.searchParams.get('import_id') }); return route.fulfill({ status: 204 }); }
      if (method === 'GET') return route.fulfill({ json: state.catalogs.length ? {...state.preview, status: 'confirmed', catalog_id: 901} : state.preview || { detail: 'Preview not found' } });
      const isJson = request.headers()['content-type']?.includes('application/json');
      const body: ImportRequest = isJson ? request.postDataJSON() : { action: multipartField(request, 'action') || 'analyze',
        organization: multipartField(request, 'organization'), mode: multipartField(request, 'mode'), title: multipartField(request, 'title'),
        brand_id: multipartField(request, 'brand_id') };
      if (body.action === 'cancel') { state.cancellations.push(body); return route.fulfill({ json: { import_id: IMPORT_ID, status: 'cancelled' } }); }
      if (body.action === 'prepare') {
        state.preparations.push(body);
        if (body.import_id !== IMPORT_ID || !state.preview) return route.fulfill({ status: 404, json: { detail: 'Preview not found' } });
        state.preview = makePreview(body.mode as Mode, options.count || 7, options.mixed || false, assets, body.title || state.preview.title, body.brand_id || undefined);
        return route.fulfill({ json: state.preview });
      }
      if (body.action === 'confirm') {
        state.confirmations.push(body);
        if (state.quotaConfirmFailures) {
          state.quotaConfirmFailures--; state.quotaUsed = 5;
          return route.fulfill({status: 403, json: {code: 'catalog_limit_exceeded', error: 'Limite de catálogos ativos atingido.', organization: 1, active_catalogs: 5, max_active_catalogs: 5, remaining_catalog_slots: 0}});
        }
        if (body.import_id !== IMPORT_ID || Number(body.organization) !== 1) return route.fulfill({ status: 400, json: { detail: 'Invalid import or organization' } });
        if (!state.catalogs.length && state.preview) {
          const preview = state.preview; const snapshot = body.brand_id ? { id: BRAND_ID, name: brand.name, version: 2, palette: brand.custom_palette } : {};
          state.catalogs.push({ id: 901, organization: 1, title: body.title || preview.title, total_pages: preview.total_pages,
            brand: body.brand_id || null, brand_name: body.brand_id ? brand.name : '', brand_version: body.brand_id ? 2 : null,
            brand_snapshot: snapshot, brand_snapshot_hash: body.brand_id ? 'approved-brand-snapshot' : '', page_width: preview.pages[0].pageWidth, page_height: preview.pages[0].pageHeight,
            import_metadata: { importId: IMPORT_ID, mode: body.mode || preview.mode, sourceFingerprint: preview.source_fingerprint, report: preview.report, share_enabled: false },
            spreads: Array.from({ length: Math.ceil(preview.total_pages / 2) }, (_, index) => ({ id: 910 + index, spread_index: index,
              left_page: preview.pages[index * 2], right_page: preview.pages[index * 2 + 1] || null,
              left_page_elements: [preview.pages[index * 2]], right_page_elements: preview.pages[index * 2 + 1] ? [preview.pages[index * 2 + 1]] : [] })) });
        }
        if (state.lostConfirmationResponses > 0) { state.lostConfirmationResponses--; if (state.quotaUsed != null) state.quotaUsed++; return route.fulfill({ status: 503, json: { detail: 'Confirmação recebida; a resposta foi interrompida.' } }); }
        return route.fulfill({ status: state.confirmations.length === 1 ? 201 : 200, json: { ...state.preview, import_id: IMPORT_ID,
          status: 'confirmed', catalog_id: 901, spreads_count: state.catalogs[0].spreads.length } });
      }
      state.analyses.push(body);
      if (Number(body.organization) !== 1 || !['preserve', 'editable', 'redesign'].includes(body.mode || '')) return route.fulfill({ status: 400, json: { detail: 'Analysis requires organization and an explicit supported mode' } });
      if (state.analysisFailures > 0) { state.analysisFailures--; return route.fulfill({ status: 503, json: { detail: 'Análise indisponível temporariamente.' } }); }
      state.preview = makePreview(body.mode as Mode, options.count || 7, options.mixed || false, assets, body.title || 'Fonte QA', body.brand_id || undefined);
      if (state.analysisGate) await state.analysisGate;
      try { return await route.fulfill({ json: state.preview }); } catch { /* A cancelled fetch must not revive the modal. */ }
      return;
    }
    if (path.startsWith('/api/brands/')) {
      if (method !== 'GET') state.brandWrites.push({ path, method, body: request.postDataJSON() });
      return route.fulfill({ json: path === '/api/brands/' ? Number(url.searchParams.get('organization')) === 1 ? [brand] : [] : brand });
    }
    if (path === '/api/v2/studio/catalogs/101/' && method === 'PUT') {
      state.quotaUsed = Math.max(0, (state.quotaUsed || 0) - 1);
      return route.fulfill({json: {id: 101, status: 'archived'}});
    }
    if (path === '/api/v2/studio/catalogs/') return route.fulfill({ json: state.quotaUsed ? [{id: 101, title: 'Catálogo existente', status: 'active', organization: 1}] : state.catalogs });
    if (path === '/api/v2/studio/catalogs/901/spreads/bulk/' && method === 'POST') {
      const body = request.postDataJSON();
      const unchanged = body.total_pages === state.preview?.pages.length && body.spreads.every((spread: {spread_index:number;left_page_elements:SourcePage[];right_page_elements:SourcePage[]}) => {
        const index=spread.spread_index;
        const expectedLeft=state.preview?.pages[index*2], expectedRight=state.preview?.pages[index*2+1];
        return isDeepStrictEqual(spread.left_page_elements,expectedLeft ? [expectedLeft] : []) && isDeepStrictEqual(spread.right_page_elements,expectedRight ? [expectedRight] : []);
      });
      state.spreadWrites.push({body,unchanged});
      return route.fulfill({json:{qualityGate:null,import_metadata:{...state.catalogs[0]?.import_metadata,quality:{passed:unchanged}}}});
    }
    if (path === '/api/v2/studio/catalogs/901/') {
      if (method !== 'GET') return route.fulfill({ json: state.catalogs[0] });
      return route.fulfill(state.catalogs[0] ? { json: state.catalogs[0] } : { status: 404, json: { detail: 'No catalog exists before confirmation' } });
    }
    if (/generate|\/chat\//.test(path)) return route.fulfill({ status: 418, json: { detail: 'Paid AI is outside this browser fixture' } });
    let body: unknown = [];
    if (path.includes('/auth/')) body = { access: 'document-qa-local-only', user: { id: 1, username: 'qa', name: 'QA Import', email: 'qa@example.test', role: 'admin' } };
    else if (path === '/api/profile/') body = { id: 1, username: 'qa', name: 'QA Import', email: 'qa@example.test', role: 'admin' };
    else if (path === '/api/organizations/') body = [organization, otherOrganization];
    else if (path.includes('unread_count')) body = { count: 0 };
    else if (path === '/api/v2/studio/quotas/') body = {organization: 1, active_catalogs: state.quotaUsed ?? state.catalogs.length, max_active_catalogs: 5, remaining_catalog_slots: 5 - (state.quotaUsed ?? state.catalogs.length), plan_tier: 'free', plan_name: 'Free'};
    else if (path.includes('/stats')) body = { catalogs: 0, products: 0, library: 0, history: 0 };
    else if (path.includes('/subscription') || path.includes('/billing/')) body = { plan: 'free', status: 'active', usage: {}, limits: {} };
    return route.fulfill({ json: body });
  });
  return state;
}
async function storeModule(page: Page) {
  return page.evaluate(() => performance.getEntriesByType('resource').filter(entry => /\/src\/store\/studioStore\.ts(?:\?|$)/.test(entry.name)).at(-1)?.name || '/src/store/studioStore.ts');
}
async function storeState(page: Page) {
  return page.evaluate(async moduleUrl => { const { useStudioStore } = await import(moduleUrl); const state = useStudioStore.getState();
    return { catalogSyncStatus: state.catalogSyncStatus, pages: state.pages, totalPages: state.totalPages, activeCatalogId: state.activeCatalogId, activeBrandId: state.activeBrandId,
      activeOrganizationId: state.activeOrganizationId, catalogBrandContext: state.catalogBrandContext, qualityGate: state.qualityGate, importMetadata: state.importMetadata, messages: state.messages, historyLength: state.historyStack.length }; }, await storeModule(page));
}
async function openImport(page: Page) {
  await page.goto('/studio');
  await expect(page.getByRole('heading', { name: 'O que vamos criar hoje?' })).toBeVisible();
  await page.getByRole('button', { name: 'Importar catálogo', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Importar catálogo', exact: true });
  await expect(dialog).toBeVisible(); return dialog;
}
async function upload(dialog: Locator, count = 7, title = 'Catálogo sintético QA', mixed = false) {
  await dialog.getByLabel('Arquivo PDF', { exact: true }).setInputFiles({ name: 'source-qa.pdf', mimeType: 'application/pdf', buffer: syntheticPdf(count, mixed) });
  await dialog.getByLabel('Título do catálogo', { exact: true }).fill(title);
}
async function analyze(dialog: Locator) {
  await dialog.getByRole('button', { name: 'Analisar documento', exact: true }).click();
  await expect(dialog.getByRole('button', { name: 'Confirmar importação', exact: true })).toBeEnabled();
  await expect(dialog.getByRole('region', { name: 'Prévia do documento' })).toBeVisible();
}
async function confirm(page: Page, dialog: Locator) {
  await dialog.getByRole('button', { name: 'Confirmar importação', exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect.poll(async () => (await storeState(page)).activeCatalogId).toBe('901');
}
async function readyPage(dialog: Locator, view: 'original' | 'reconstructed') {
  const rendered = dialog.locator(`[data-render-mode="document"][data-document-view="${view}"]`).first();
  await expect(rendered).toBeVisible();
  await expect.poll(() => rendered.locator('[data-document-asset-state="pending"], [data-document-asset-state="error"]').count()).toBe(0);
  await expect.poll(() => rendered.locator('[data-document-asset-state="ready"]').count()).toBeGreaterThan(0);
  return rendered;
}
async function sourceResolutionScreenshot(page: Page, renderer: Locator, path: string) {
  // Normalize both real rendered layers to source pixel dimensions. This removes
  // viewport scaling from the fidelity measurement while retaining the renderer's
  // actual blob images, crop placement, stacking and object-fit behavior.
  await renderer.evaluate(element => {
    const clone = element.cloneNode(true) as HTMLElement;
    clone.id = 'qa-source-resolution';
    clone.style.cssText = 'position:fixed;left:0;top:0;width:595px;height:842px;z-index:2147483647;overflow:hidden;background:white;container-type:inline-size;';
    document.body.appendChild(clone);
  });
  const normalized = page.locator('#qa-source-resolution');
  await normalized.locator('img').evaluateAll(images => Promise.all(images.map(image => (image as HTMLImageElement).decode())));
  const pixels = await normalized.screenshot({ path, animations: 'disabled' });
  await normalized.evaluate(element => element.remove());
  return pixels;
}
async function noOverflow(page: Page, dialog: Locator) {
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  const box = await dialog.boundingBox(); const viewport = page.viewportSize()!;
  expect(box).not.toBeNull(); expect(box!.x).toBeGreaterThanOrEqual(-1);
  expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width + 1);
  expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height + 1);
}
async function faithfulAspectRatio(renderer: Locator, width: number, height: number) {
  const box = await renderer.boundingBox(); expect(box).not.toBeNull();
  expect(Math.abs(box!.width / box!.height - width / height)).toBeLessThan(0.005);
}

test('PDF-only controls disclose the 25 MB limit and reject Word or oversize sources before network analysis', async ({ page }) => {
  const state = await fixture(page); const dialog = await openImport(page);
  await expect(dialog.getByRole('radio', { name: /^Preservar original/ })).toBeChecked();
  await expect(dialog.getByText(/25\s*MB/)).toBeVisible();
  await expect(dialog.getByText('Para importar Word, exporte o documento como PDF.')).toBeVisible();
  await dialog.getByLabel('Arquivo PDF', { exact: true }).setInputFiles({ name: 'source.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', buffer: Buffer.from('not a PDF') });
  await expect(dialog.getByRole('button', { name: 'Analisar documento', exact: true })).toBeDisabled();
  await dialog.getByLabel('Arquivo PDF', { exact: true }).setInputFiles({ name: 'oversize.pdf', mimeType: 'application/pdf', buffer: Buffer.alloc(25 * 1024 * 1024 + 1, 32) });
  await expect(dialog.getByRole('button', { name: 'Analisar documento', exact: true })).toBeDisabled();
  expect(state.analyses).toHaveLength(0); expect(state.catalogs).toHaveLength(0);
});

test('source preview and its report use private authenticated assets; cancelling never creates a catalog', async ({ page }) => {
  const state = await fixture(page); const dialog = await openImport(page); await upload(dialog); await analyze(dialog);
  await faithfulAspectRatio(await readyPage(dialog, 'original'), 595, 842);
  await expect(dialog.getByRole('region', { name: 'Relatório de importação' })).toContainText('7');
  expect(state.catalogs).toHaveLength(0); expect(state.confirmations).toHaveLength(0);
  expect(state.analyses[0]).toMatchObject({ action: 'analyze', organization: '1', mode: 'preserve' });
  expect(state.analyses[0].brand_id).toBeUndefined();
  expect(state.assetRequests.length).toBeGreaterThan(0);
  expect(state.assetRequests.every(request => request.authorization?.startsWith('Bearer '))).toBe(true);
  expect((await storeState(page)).pages).toHaveLength(0);
  await dialog.getByRole('button', { name: /Cancelar/ }).click();
  await expect(dialog).toBeHidden(); expect(state.catalogs).toHaveLength(0);
  await expect.poll(() => state.cancellations.length).toBe(1);
  expect(state.brandWrites).toHaveLength(0);
});

test('confirmation preserves all seven mixed source pages and reopening does not create an eighth page for the odd spread slot', async ({ page }) => {
  const state = await fixture(page, { mixed: true }); const dialog = await openImport(page); await upload(dialog, 7, 'Catálogo sintético QA', true); await analyze(dialog);
  for (const source of state.preview!.pages) {
    await dialog.getByLabel('Página da prévia', { exact: true }).selectOption({ label: `Página ${source.pageNumber}` });
    await faithfulAspectRatio(await readyPage(dialog, 'original'), source.documentPage.width, source.documentPage.height);
  }
  await confirm(page, dialog);
  const imported = await storeState(page);
  expect(imported.totalPages).toBe(7); expect(imported.pages).toHaveLength(7);
  expect(imported.pages.map((p: SourcePage) => [p.documentPage.width, p.documentPage.height])).toEqual([[595, 842], [612, 792], [400, 400], [792, 612], [300, 900], [900, 300], [595, 842]]);
  expect(imported.pages.map((p: SourcePage) => p.pageNumber)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  expect(imported.pages.every((p: SourcePage) => p.products.length === 0 && p.renderMode === 'document')).toBe(true);
  expect(imported.pages).toEqual(state.preview!.pages);
  expect(imported.activeBrandId).toBeNull();
  expect(state.catalogs).toHaveLength(1); expect(state.catalogs[0].spreads).toHaveLength(4);
  expect(state.catalogs[0].spreads[3].right_page_elements).toEqual([]);
  expect(state.catalogs[0].import_metadata.share_enabled).toBe(false);
  const originalHashes = imported.pages.map((p: SourcePage) => p.documentPage.sourceSnapshot.hash);
  await page.evaluate(async moduleUrl => { const { useStudioStore } = await import(moduleUrl); await useStudioStore.getState().flushSaveSpread(); }, await storeModule(page));
  expect(state.spreadWrites.at(-1)?.unchanged).toBe(true);
  expect((await storeState(page)).importMetadata?.quality?.passed).toBe(true);
  await page.evaluate(async moduleUrl => { const { useStudioStore } = await import(moduleUrl); await useStudioStore.getState().loadExistingCatalog('901'); }, await storeModule(page));
  const reopened = await storeState(page);
  expect(reopened.pages).toHaveLength(7); expect(reopened.totalPages).toBe(7);
  expect(reopened.pages.map((p: SourcePage) => p.documentPage.sourceSnapshot.hash)).toEqual(originalHashes);
  expect(state.preview!.document_ir.candidates[0]).toMatchObject({ price: null, sku: null, availability: null });
  expect(state.brandWrites).toHaveLength(0);
});

test('editable reconstruction initially matches source pixels and explicit text editing preserves original appearance and provenance', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const state = await fixture(page, { count: 8 }); const dialog = await openImport(page); await upload(dialog, 8);
  await dialog.getByRole('radio', { name: /^Original editável/ }).check(); await analyze(dialog);
  await dialog.getByRole('button', { name: 'Original', exact: true }).click();
  const original = await readyPage(dialog, 'original');
  const originalPixels = await sourceResolutionScreenshot(page, original, testInfo.outputPath('editable-source.png'));
  await dialog.getByRole('button', { name: 'Reconstruído', exact: true }).click();
  const reconstructed = await readyPage(dialog, 'reconstructed');
  const reconstructedPixels = await sourceResolutionScreenshot(page, reconstructed, testInfo.outputPath('editable-reconstructed.png'));
  // Compare decoded pixels, avoiding differences in PNG ancillary metadata.
  const pixelDifference = await page.evaluate(async ({ original, reconstructed }) => {
    const decode = async (base64: string) => { const image = new Image(); image.src = `data:image/png;base64,${base64}`; await image.decode(); const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height; const ctx = canvas.getContext('2d')!; ctx.drawImage(image, 0, 0); return { width: image.width, height: image.height, data: ctx.getImageData(0, 0, image.width, image.height).data }; };
    const a = await decode(original); const b = await decode(reconstructed);
    if (a.width !== b.width || a.height !== b.height) return { sameSize: false, changedPixels: -1 };
    let changedPixels = 0; for (let i = 0; i < a.data.length; i += 4) if (a.data[i] !== b.data[i] || a.data[i + 1] !== b.data[i + 1] || a.data[i + 2] !== b.data[i + 2]) changedPixels++;
    return { sameSize: true, changedPixels };
  }, { original: originalPixels.toString('base64'), reconstructed: reconstructedPixels.toString('base64') });
  expect(pixelDifference).toEqual({ sameSize: true, changedPixels: 0 });
  await confirm(page, dialog);
  const before = (await storeState(page)).pages[0].documentPage;
  await page.getByRole('button', { name: 'Editar texto: Texto original da página 1', exact: true }).click();
  await page.getByLabel('Texto do documento', { exact: true }).fill('Texto corrigido explicitamente');
  await page.getByRole('button', { name: 'Aplicar edição', exact: true }).click();
  const after = (await storeState(page)).pages[0].documentPage;
  expect(after.elements[0].text).toBe('Texto corrigido explicitamente');
  expect(after.sourceSnapshot).toEqual(before.sourceSnapshot);
  expect(after.elements[0].provenance).toEqual(before.elements[0].provenance);
  expect(after.elements[0].appearance).toEqual(before.elements[0].appearance);
  expect(state.analyses[0].mode).toBe('editable'); expect(state.catalogs).toHaveLength(1);
});

test('redesign links only the explicitly selected Brand and keeps inferred Brand knowledge unpromoted', async ({ page }) => {
  const state = await fixture(page, { count: 8 }); const dialog = await openImport(page); await upload(dialog, 8);
  await expect(dialog.getByLabel('Marca do catálogo', { exact: true })).toHaveValue('');
  await dialog.getByRole('radio', { name: /^Rediagramar com marca/ }).check();
  await dialog.getByLabel('Marca do catálogo', { exact: true }).selectOption(BRAND_ID);
  await analyze(dialog); await confirm(page, dialog);
  expect(state.analyses[0]).toMatchObject({ mode: 'redesign', brand_id: BRAND_ID, organization: '1' });
  expect(state.confirmations[0]).toMatchObject({ action: 'confirm', import_id: IMPORT_ID, mode: 'redesign', brand_id: BRAND_ID });
  expect((await storeState(page)).activeBrandId).toBe(BRAND_ID);
  expect(state.catalogs[0].brand_snapshot.version).toBe(2);
  expect(state.brandWrites).toHaveLength(0); expect(brand.intelligence.positioning.status).toBe('inferred');
});

test('changing mode or Brand after analysis requires reviewing an updated preview before confirmation', async ({ page }) => {
  const state = await fixture(page); const dialog = await openImport(page); await upload(dialog); await analyze(dialog);
  const sourceFingerprint = state.preview!.source_fingerprint;
  await dialog.getByRole('radio', { name: /^Rediagramar com marca/ }).check();
  await dialog.getByLabel('Marca do catálogo', { exact: true }).selectOption(BRAND_ID);
  await expect(dialog.getByRole('button', { name: 'Confirmar importação', exact: true })).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Atualizar prévia', exact: true }).click();
  await expect(dialog.getByRole('button', { name: 'Confirmar importação', exact: true })).toBeEnabled();
  expect(state.analyses).toHaveLength(1); expect(state.preparations).toHaveLength(1); expect(state.catalogs).toHaveLength(0);
  expect(state.preparations[0]).toMatchObject({ action: 'prepare', import_id: IMPORT_ID, mode: 'redesign', brand_id: BRAND_ID });
  expect(state.preview!.source_fingerprint).toBe(sourceFingerprint);
  await confirm(page, dialog); expect(state.catalogs[0].brand).toBe(BRAND_ID); expect(state.brandWrites).toHaveLength(0);
});

test('an analysis error retains file and title for a real retry without creating a catalog', async ({ page }) => {
  const state = await fixture(page, { analysisFailures: 1 }); const dialog = await openImport(page); await upload(dialog, 7, 'Título para recuperar');
  await dialog.getByRole('button', { name: 'Analisar documento', exact: true }).click();
  await expect(dialog.getByRole('button', { name: 'Tentar novamente', exact: true })).toBeVisible();
  await expect(dialog.getByLabel('Título do catálogo', { exact: true })).toHaveValue('Título para recuperar');
  await dialog.getByRole('button', { name: 'Tentar novamente', exact: true }).click();
  await expect(dialog.getByRole('button', { name: 'Confirmar importação', exact: true })).toBeEnabled();
  expect(state.analyses).toHaveLength(2); expect(state.analyses[1].title).toBe('Título para recuperar');
  expect(state.catalogs).toHaveLength(0); expect(state.confirmations).toHaveLength(0);
});

test('retrying a lost confirmation response reuses the same import and opens a single committed catalog', async ({ page }) => {
  const state = await fixture(page, { lostConfirmationResponses: 1 }); state.quotaUsed = 4; const dialog = await openImport(page); await upload(dialog); await analyze(dialog);
  await dialog.getByRole('button', { name: 'Confirmar importação', exact: true }).click();
  await expect(dialog.getByRole('button', { name: 'Tentar novamente', exact: true })).toBeVisible();
  expect(state.catalogs).toHaveLength(1);
  await dialog.getByRole('button', {name: 'Atualizar limite', exact: true}).click();
  await expect(dialog.getByRole('button', {name: 'Abrir catálogo importado', exact: true})).toBeEnabled();
  await dialog.getByRole('button', { name: 'Abrir catálogo importado', exact: true }).click();
  await expect(dialog).toBeHidden(); await expect.poll(async () => (await storeState(page)).activeCatalogId).toBe('901');
  expect(state.confirmations).toHaveLength(2);
  expect(state.confirmations.map(body => body.import_id)).toEqual([IMPORT_ID, IMPORT_ID]);
  expect(state.analyses).toHaveLength(1); expect(state.catalogs).toHaveLength(1);
});

test('cancelling a pending analysis ignores its late response and leaves the Studio unchanged', async ({ page }) => {
  const state = await fixture(page, { holdAnalysis: true }); const dialog = await openImport(page); await upload(dialog);
  await dialog.getByRole('button', { name: 'Analisar documento', exact: true }).click();
  await expect.poll(() => state.analyses.length).toBe(1);
  await dialog.getByRole('button', { name: 'Cancelar análise', exact: true }).click();
  await expect(dialog).toBeHidden(); state.releaseAnalysis!();
  await expect.poll(async () => (await storeState(page)).pages.length).toBe(0);
  expect(state.confirmations).toHaveLength(0); expect(state.catalogs).toHaveLength(0);
  await page.getByRole('button', { name: 'Importar catálogo', exact: true }).click();
  await expect(dialog.getByRole('button', { name: 'Confirmar importação', exact: true })).toHaveCount(0);
});

test('changing organization while analysis is pending discards the old tenant response', async ({ page }) => {
  const state = await fixture(page, { holdAnalysis: true }); const dialog = await openImport(page); await upload(dialog);
  await dialog.getByRole('button', { name: 'Analisar documento', exact: true }).click(); await expect.poll(() => state.analyses.length).toBe(1);
  // Use the membership-validated selection path owned by ContextSelector.
  await page.evaluate(async (nextOrg) => {
    // @ts-expect-error Vite serves the runtime workspace module for browser QA.
    const { selectOrganization } = await import('/src/services/workspaceContext.ts');
    selectOrganization(nextOrg);
  }, otherOrganization);
  state.releaseAnalysis!();
  await expect(dialog.getByRole('button', { name: 'Confirmar importação', exact: true })).toHaveCount(0);
  await expect.poll(async () => (await storeState(page)).activeOrganizationId).toBe(2);
  expect((await storeState(page)).pages).toHaveLength(0); expect(state.catalogs).toHaveLength(0); expect(state.confirmations).toHaveLength(0);
});

test('the document text editor remains readable and reachable at 320px while edits and restore retain the source', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 320, height: 680 });
  await fixture(page, { count: 2 }); const importDialog = await openImport(page); await upload(importDialog, 2);
  await importDialog.getByRole('radio', { name: /^Original editável/ }).check(); await analyze(importDialog); await confirm(page, importDialog);
  await page.getByRole('tab', { name: 'Catálogo', exact: true }).click();
  const before = (await storeState(page)).pages[0].documentPage;
  const sourceTextButton = page.getByRole('button', { name: 'Editar texto: Texto original da página 1', exact: true });
  await sourceTextButton.click();
  const editor = page.getByRole('dialog', { name: 'Editar texto do documento', exact: true });
  await expect(editor).toBeVisible(); await noOverflow(page, editor);
  for (const label of ['Aplicar edição', 'Restaurar texto original', 'Fechar edição']) {
    const button = editor.getByRole('button', { name: label, exact: true }); await expect(button).toBeVisible();
    const bounds = await button.boundingBox(); expect(bounds!.width).toBeGreaterThanOrEqual(44); expect(bounds!.height).toBeGreaterThanOrEqual(44);
  }
  await editor.getByLabel('Texto do documento', { exact: true }).fill('Texto corrigido no telefone');
  await editor.screenshot({ path: testInfo.outputPath('text-editor-320.png'), animations: 'disabled' });
  await editor.getByRole('button', { name: 'Aplicar edição', exact: true }).click(); await expect(editor).toBeHidden();
  const edited = (await storeState(page)).pages[0].documentPage;
  expect(edited.elements[0].text).toBe('Texto corrigido no telefone'); expect(edited.sourceSnapshot).toEqual(before.sourceSnapshot);
  expect(edited.elements[0].provenance).toEqual(before.elements[0].provenance);
  await sourceTextButton.click(); await editor.getByRole('button', { name: 'Restaurar texto original', exact: true }).click();
  await expect(editor).toBeHidden();
  const restored = (await storeState(page)).pages[0].documentPage;
  expect(restored.elements[0].text).toBe(before.elements[0].text); expect(restored.sourceSnapshot).toEqual(before.sourceSnapshot);
  expect(restored.elements[0].appearance).toEqual(before.elements[0].appearance);
});

for (const width of [320, 390, 1440]) {
  test(`source, reconstructed and comparison previews remain usable at ${width}px with eight source pages`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: width === 320 ? 680 : 900 });
    const state = await fixture(page, { count: 8 }); const dialog = await openImport(page); await upload(dialog, 8);
    await dialog.getByRole('radio', { name: /^Original editável/ }).check(); await analyze(dialog);
    await dialog.getByLabel('Página da prévia', { exact: true }).selectOption({ label: 'Página 8' });
    for (const label of ['Original', 'Reconstruído', 'Comparação']) {
      await dialog.getByRole('button', { name: label, exact: true }).click();
      const renderers = dialog.locator('[data-render-mode="document"]');
      for (const renderer of await renderers.all()) await faithfulAspectRatio(renderer, 595, 842);
      await noOverflow(page, dialog);
      await dialog.getByRole('region', { name: 'Prévia do documento' }).scrollIntoViewIfNeeded();
      await dialog.screenshot({ path: testInfo.outputPath(`preview-${width}-${label === 'Original' ? 'source' : label === 'Reconstruído' ? 'reconstructed' : 'comparison'}.png`), animations: 'disabled' });
    }
    await expect(dialog.getByRole('button', { name: 'Confirmar importação', exact: true })).toBeEnabled();
    await confirm(page, dialog); expect((await storeState(page)).pages).toHaveLength(8); expect(state.catalogs).toHaveLength(1);
    if (width < 1024) await page.getByRole('tab', { name: 'Catálogo', exact: true }).click();
    await page.screenshot({ path: testInfo.outputPath(`studio-${width}-imported.png`), fullPage: true, animations: 'disabled' });
  });
}


test('full quota is visible before analysis and archiving preserves the same eight-page preview', async ({page}) => {
  const state = await fixture(page, {count: 8}); state.quotaUsed = 5;
  const dialog = await openImport(page);
  await expect(dialog.getByText('5 de 5 catálogos ativos', {exact: true})).toBeVisible();
  await upload(dialog, 8);
  await dialog.getByRole('button', {name: 'Analisar documento', exact: true}).click();
  await expect(dialog.getByRole('region', {name: 'Prévia do documento'})).toBeVisible();
  await expect(dialog.getByRole('button', {name: 'Sem vagas para novos catálogos'})).toBeDisabled();
  await dialog.getByRole('button', {name: 'Comparação', exact: true}).click();
  await dialog.getByLabel('Página da prévia').selectOption('3');
  await dialog.getByRole('button', {name: 'Gerenciar catálogos', exact: true}).click();
  page.once('dialog', prompt => prompt.accept());
  await dialog.getByRole('button', {name: 'Arquivar', exact: true}).click();
  await expect(dialog.getByRole('button', {name: 'Confirmar importação', exact: true})).toBeEnabled();
  await expect(dialog.getByLabel('Página da prévia')).toHaveValue('3');
  await expect(dialog.getByRole('button', {name: 'Comparação', exact: true})).toHaveAttribute('aria-pressed', 'true');
  expect(state.analyses).toHaveLength(1);
  await confirm(page, dialog); expect(state.catalogs).toHaveLength(1);
});

test('quota changing at confirmation keeps analysis and offers recovery without blind retry', async ({page}) => {
  const state = await fixture(page); state.quotaUsed = 4; state.quotaConfirmFailures = 1;
  const dialog = await openImport(page); await upload(dialog); await analyze(dialog);
  await dialog.getByRole('button', {name: 'Confirmar importação', exact: true}).click();
  await expect(dialog.getByRole('alert')).toContainText('Limite de catálogos');
  await expect(dialog.getByRole('button', {name: 'Tentar novamente', exact: true})).toHaveCount(0);
  await expect(dialog.getByRole('region', {name: 'Prévia do documento'})).toBeVisible();
  await dialog.getByRole('button', {name: 'Gerenciar catálogos', exact: true}).click();
  page.once('dialog', prompt => prompt.accept());
  await dialog.getByRole('button', {name: 'Arquivar', exact: true}).click();
  await expect(dialog.getByRole('button', {name: 'Confirmar importação', exact: true})).toBeEnabled();
  await confirm(page, dialog); expect(state.analyses).toHaveLength(1); expect(state.catalogs).toHaveLength(1);
});


test('real private PDF resolves commands without browser source text, saves groups, reloads and restores', async ({page}) => {
  test.setTimeout(120000);
  await page.setViewportSize({width: 1440, height: 1000});
  await fixture(page, {count: 1});
  const bridge = await importEditingBridge();
  const catalogId = String(bridge.initial.catalog_id);
  let firstLoad = true;
  let chats = 0;
  try {
    await page.route('**/api/v2/studio/**', async route => {
      const request = route.request(), path = new URL(request.url()).pathname;
      if (!(path === `/api/v2/studio/catalogs/${catalogId}/` || path.startsWith(`/api/v2/studio/catalogs/${catalogId}/spreads`) || path === `/api/v2/studio/catalogs/${catalogId}/chat/execution/` || path.includes('/import-document/assets/') || path === '/api/v2/studio/chat/stream/')) return route.fallback();
      if (firstLoad && request.method() === 'GET' && path === `/api/v2/studio/catalogs/${catalogId}/`) {
        firstLoad = false;
        return route.fulfill({json: bridge.initial.initial});
      }
      const body = request.postData() ? request.postDataJSON() : undefined;
      if (path === '/api/v2/studio/chat/stream/') {
        if (chats++ === 0) expect(body.editable_text_index).toEqual([]);
      }
      const reply = await bridge.request(request.method(), path, body);
      expect(reply.bridge_error).toBeUndefined();
      return route.fulfill({status: Number(reply.status), contentType: String(reply.content_type), body: Buffer.from(String(reply.base64), 'base64')});
    });
    await page.goto('/studio');
    await expect.poll(async () => (await storeState(page)).catalogSyncStatus).toBe('ready');
    await page.evaluate(async ({moduleUrl, catalogId}) => {const {useStudioStore} = await import(moduleUrl); await useStudioStore.getState().loadExistingCatalog(catalogId);}, {moduleUrl: await storeModule(page), catalogId});
    const before = (await storeState(page)).pages[0].documentPage;
    expect(before.elements.every((e: {text?: string; provenance?: unknown}) => e.text === undefined && e.provenance === undefined)).toBe(true);
    const input = page.getByRole('textbox', {name: 'Instrução ou comando para o assistente de design'});
    await input.fill('na página 1, troque PRODUTOS por ITENS'); await input.press('Enter');
    await expect.poll(async () => (await storeState(page)).pages[0].documentPage.elements.some((e: {text?: string}) => e.text === 'ITENS')).toBe(true);
    await expect(page.getByText("Texto da página atualizado para 'ITENS'.", {exact: true})).toBeVisible();
    await page.evaluate(async moduleUrl => {const {useStudioStore} = await import(moduleUrl); await useStudioStore.getState().flushSaveSpread();}, await storeModule(page));
    await page.reload();
    await expect.poll(async () => (await storeState(page)).catalogSyncStatus).toBe('ready');
    await page.evaluate(async ({moduleUrl, catalogId}) => {const {useStudioStore} = await import(moduleUrl); await useStudioStore.getState().loadExistingCatalog(catalogId);}, {moduleUrl: await storeModule(page), catalogId});
    let saved = (await storeState(page)).pages[0].documentPage;
    expect(saved.elements.some((e: {text?: string}) => e.text === 'ITENS')).toBe(true);
    expect(saved.sourceSnapshot).toEqual(before.sourceSnapshot);
    // Restore via the existing source-preserving editor path before testing the full original phrase.
    await page.evaluate(async moduleUrl => {const {useStudioStore} = await import(moduleUrl); const s = useStudioStore.getState(); const element = s.pages[0].documentPage!.elements.find(e => e.text === 'ITENS')!; s.resetDocumentText(1, element.id); await s.flushSaveSpread();}, await storeModule(page));
    await input.fill('altere catálogo de produtos para Catálogo na página 1'); await input.press('Enter');
    await expect.poll(async () => (await storeState(page)).pages[0].documentPage.elements.filter((e: {edited?: boolean}) => e.edited).length).toBe(2);
    saved = (await storeState(page)).pages[0].documentPage;
    expect(saved.elements.filter((e: {edited?: boolean}) => e.edited).map((e: {text: string}) => e.text)).toEqual(['Catálogo', '']);
    expect(saved.elements.some((e: {text?: string}) => e.text === 'SOCIAL FOOTER')).toBe(true);
    await page.evaluate(async moduleUrl => {const {useStudioStore} = await import(moduleUrl); const s = useStudioStore.getState(); s.undo(); await s.flushSaveSpread();}, await storeModule(page));
    saved = (await storeState(page)).pages[0].documentPage;
    expect(saved.elements.some((e: {text?: string}) => e.text === 'PRODUTOS')).toBe(true);
    expect(saved.sourceSnapshot).toEqual(before.sourceSnapshot);
  } finally {bridge.close();}
});

test('eight imported pages accept a closing ninth page through real API, reload, undo, redo and export', async ({page})=>{
  test.setTimeout(120000);
  await page.setViewportSize({width:1440,height:1000});
  await fixture(page,{count:8});
  const bridge=await importEditingBridge(8);
  const catalogId=String(bridge.initial.catalog_id);
  try {
    await page.route('**/api/v2/studio/**',async route=>{
      const request=route.request(),path=new URL(request.url()).pathname;
      if (!(path===`/api/v2/studio/catalogs/${catalogId}/` || path.startsWith(`/api/v2/studio/catalogs/${catalogId}/spreads`) || path===`/api/v2/studio/catalogs/${catalogId}/chat/execution/` || path.includes('/import-document/assets/') || path==='/api/v2/studio/chat/stream/')) return route.fallback();
      const reply=await bridge.request(request.method(),path,request.postData() ? request.postDataJSON() : undefined);
      expect(reply.bridge_error).toBeUndefined();
      return route.fulfill({status:Number(reply.status),contentType:String(reply.content_type),body:Buffer.from(String(reply.base64),'base64')});
    });
    await page.goto('/studio');
    await expect.poll(async () => (await storeState(page)).catalogSyncStatus).toBe('ready');
    const load=async()=>page.evaluate(async ({url,id})=>{const {useStudioStore}=await import(url);await useStudioStore.getState().loadExistingCatalog(id);},{url:await storeModule(page),id:catalogId});
    await load();
    const before=(await storeState(page)).pages.map((p:{documentPage:unknown})=>p.documentPage);
    const input=page.getByRole('textbox',{name:'Instrução ou comando para o assistente de design'});
    await input.fill('crie uma outra página de finalização do catálogo');await input.press('Enter');
    await expect.poll(async()=>(await storeState(page)).pages.length).toBe(9);
    await expect(page.getByText('Página de finalização adicionada após a página 8.',{exact:true})).toBeVisible();
    let state=await storeState(page);
    expect(state.pages[8]).toMatchObject({pageOrigin:'catana_authored',contentRole:'closing',type:'backcover'});
    expect(state.pages.slice(0,8).map((p:{documentPage:unknown})=>p.documentPage)).toEqual(before);
    await page.reload();
    await expect.poll(async () => (await storeState(page)).catalogSyncStatus).toBe('ready');
    await load();
    state=await storeState(page);
    expect(state.pages).toHaveLength(9);
    // History is scoped to the active editing session; exercise persisted undo/redo after a fresh addition.
    await page.evaluate(async url=>{const {useStudioStore}=await import(url);const s=useStudioStore.getState();s.removePage(9);await s.flushSaveSpread();},await storeModule(page));
    await input.fill('crie uma outra página de finalização do catálogo');await input.press('Enter');
    await expect.poll(async()=>(await storeState(page)).pages.length).toBe(9);
    await page.evaluate(async url=>{const {useStudioStore}=await import(url);const s=useStudioStore.getState();s.undo();await s.flushSaveSpread();},await storeModule(page));
    expect((await storeState(page)).pages).toHaveLength(8);
    await page.evaluate(async url=>{const {useStudioStore}=await import(url);const s=useStudioStore.getState();s.redo();await s.flushSaveSpread();s.openExportModal('pdf');},await storeModule(page));
    expect((await storeState(page)).pages).toHaveLength(9);
    await expect(page.locator('.pdf-page-content')).toHaveCount(9);
    const detail=await bridge.request('GET',`/api/v2/studio/catalogs/${catalogId}/`);
    const saved=JSON.parse(Buffer.from(String(detail.base64),'base64').toString());
    expect(saved.source_page_count).toBe(8);
    expect(saved.total_pages).toBe(9);
    expect(saved.spreads[4].right_page_elements).toEqual([]);
  } finally {bridge.close();}
});

test('manual cover edits resolve the exact command, persist weight choices and retain eight source pages', async ({page}) => {
  test.setTimeout(180000);
  await page.setViewportSize({width:1440,height:1000});
  await fixture(page,{count:8});
  const bridge = await importEditingBridge(8);
  const catalogId = String(bridge.initial.catalog_id);
  const sourceTexts = bridge.initial.cover_texts as Record<string,string>;
  const first = sourceTexts['CATÁLOGO DE'] || sourceTexts['CATALOGO DE'];
  const title = sourceTexts['PRODUTOS'];
  expect(first).toBeTruthy(); expect(title).toBeTruthy();
  let chats = 0;
  try {
    await page.route('**/api/v2/studio/**', async route => {
      const request = route.request(), path = new URL(request.url()).pathname;
      if (!(path === `/api/v2/studio/catalogs/${catalogId}/` || path.startsWith(`/api/v2/studio/catalogs/${catalogId}/spreads`) || path === `/api/v2/studio/catalogs/${catalogId}/chat/execution/` || path.includes('/import-document/assets/') || path === '/api/v2/studio/chat/stream/')) return route.fallback();
      const body = request.postData() ? request.postDataJSON() : undefined;
      if (path === '/api/v2/studio/chat/stream/') {expect(body.editable_text_index).toEqual([]); chats++;}
      const reply = await bridge.request(request.method(), path, body);
      expect(reply.bridge_error).toBeUndefined();
      return route.fulfill({status:Number(reply.status),contentType:String(reply.content_type),body:Buffer.from(String(reply.base64),'base64')});
    });
    await page.goto('/studio');
    await expect.poll(async () => (await storeState(page)).catalogSyncStatus).toBe('ready');
    const url = await storeModule(page);
    const load = () => page.evaluate(async ({url,id}) => {const {useStudioStore} = await import(url);await useStudioStore.getState().loadExistingCatalog(id);},{url,id:catalogId});
    const reload = async () => {await page.reload(); await expect.poll(async () => (await storeState(page)).catalogSyncStatus).toBe('ready'); await load();};
    await load();
    const before = (await storeState(page)).pages;
    expect(before).toHaveLength(8);
    await page.evaluate(async ({url,first,title}) => {
      const {useStudioStore} = await import(url); const s = useStudioStore.getState();
      s.updateDocumentText(1,first,'ITENS DE'); s.updateDocumentText(1,title,'PLASWILL'); await s.flushSaveSpread();
    },{url,first,title});
    await load();
    const input = page.getByRole('textbox',{name:'Instrução ou comando para o assistente de design'});
    await input.fill('altere de ITENS para PRODUTOS'); await input.press('Enter');
    await expect(page.getByText("Texto da página atualizado para 'PRODUTOS DE'.",{exact:true})).toBeVisible();
    const text = () => storeState(page).then(s => s.pages[0].documentPage.elements.find((e:{id:string}) => e.id === first).text);
    expect(await text()).toBe('PRODUTOS DE');
    await page.evaluate(async url => {const {useStudioStore} = await import(url);const s=useStudioStore.getState();s.undo();await s.flushSaveSpread();},url);
    expect(await text()).toBe('ITENS DE');
    await page.evaluate(async url => {const {useStudioStore} = await import(url);const s=useStudioStore.getState();s.redo();await s.flushSaveSpread();},url);
    expect(await text()).toBe('PRODUTOS DE');
    await reload();
    expect(await text()).toBe('PRODUTOS DE');
    expect((await storeState(page)).messages.some((m:{content:string;executionReceipt?:{status:string};proposal?:unknown}) => m.content.includes("'PRODUTOS DE'") && m.executionReceipt?.status === 'confirmed' && m.proposal)).toBe(true);
    await input.fill('deixe o negrito destacado de PLASWILL semelhante ao da EMPRESA na segunda página'); await input.press('Enter');
    const choices = page.getByLabel('Escolher peso tipográfico');
    await expect(choices).toBeVisible();
    if (process.env.CATANA_TEST_PDF) await expect(page.getByText(/A referência não informa um peso visual confiável/)).toBeVisible();
    await choices.getByRole('button',{name:/700/}).click();
    await expect(page.getByText('Peso do texto atualizado para 700.',{exact:true})).toBeVisible();
    const titleElement = () => storeState(page).then(s => s.pages[0].documentPage.elements.find((e:{id:string}) => e.id === title));
    expect((await titleElement()).styleRevision).toEqual({fontWeight:700});
    const renderedTitle = page.locator('[data-document-page="1"] [style*="font-weight: 700"]').filter({hasText:'PLASWILL'}).first();
    await expect(renderedTitle).toBeVisible();
    const fit = await renderedTitle.evaluate(el => {
      const style = getComputedStyle(el);
      const context=document.createElement('canvas').getContext('2d')!;
      context.font=`${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
      const metrics=context.measureText(el.textContent || ''), baseline=(parseFloat(style.lineHeight)+metrics.fontBoundingBoxAscent-metrics.fontBoundingBoxDescent)/2;
      return {width:el.clientWidth,height:el.clientHeight,inkWidth:metrics.actualBoundingBoxLeft+metrics.actualBoundingBoxRight,
        inkTop:baseline-metrics.actualBoundingBoxAscent,inkBottom:baseline+metrics.actualBoundingBoxDescent};
    });
    expect(fit.inkWidth, JSON.stringify(fit)).toBeLessThanOrEqual(fit.width + 1);
    expect(fit.inkTop, JSON.stringify(fit)).toBeGreaterThanOrEqual(-1);
    expect(fit.inkBottom, JSON.stringify(fit)).toBeLessThanOrEqual(fit.height + 1);
    await expect(renderedTitle.getByRole('status')).toHaveCount(0);
    const state = await storeState(page);
    expect(state.pages.map((p:{id:string})=>p.id)).toEqual(before.map((p:{id:string})=>p.id));
    expect(state.pages.map((p:{documentPage:{sourceSnapshot:unknown}})=>p.documentPage.sourceSnapshot)).toEqual(before.map((p:{documentPage:{sourceSnapshot:unknown}})=>p.documentPage.sourceSnapshot));
    await reload();
    expect((await titleElement()).styleRevision).toEqual({fontWeight:700});
    const history = (await storeState(page)).historyLength;
    await input.fill('deixe PLASWILL em negrito'); await input.press('Enter');
    await expect(page.getByText('O título já possui esse peso tipográfico confirmado. Nenhuma alteração foi necessária.',{exact:true})).toBeVisible();
    expect((await storeState(page)).historyLength).toBe(history);
    // Explicit recovery uses retained private bytes and reconciles revisions;
    // it must never discard the manual copy or the accepted weight.
    const parseReply = (reply: Record<string,unknown>) => JSON.parse(Buffer.from(String(reply.base64),'base64').toString());
    const prepared = await bridge.request('POST','/api/v2/studio/catalogs/import-document/',{action:'reanalyze',catalog_id:Number(catalogId),preserve_edits:true});
    expect(prepared.status).toBe(200);
    const review = parseReply(prepared);
    expect(review.report.reanalysis).toMatchObject({preservedTextEdits:2,preservedStyleEdits:1,canConfirm:true,conflicts:[]});
    const confirmed = await bridge.request('POST','/api/v2/studio/catalogs/import-document/',{action:'confirm_reanalysis',catalog_id:Number(catalogId),import_id:review.import_id,replace_reconstruction:true,preserve_edits:true});
    expect(confirmed.status).toBe(200);
    await reload();
    expect(await text()).toBe('PRODUTOS DE');
    expect((await titleElement()).styleRevision).toEqual({fontWeight:700});
    await page.evaluate(async ({url,title}) => {const {useStudioStore} = await import(url);const s=useStudioStore.getState();s.resetDocumentText(1,title);await s.flushSaveSpread();},{url,title});
    await load(); expect((await titleElement()).styleRevision).toBeUndefined();
    expect((await storeState(page)).pages).toHaveLength(8);
    expect(chats).toBe(4);
  } finally {bridge.close();}
});
