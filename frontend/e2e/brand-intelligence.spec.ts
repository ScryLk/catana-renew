import { test, expect, type Page } from '@playwright/test';

const BRAND_ID = '11111111-1111-4111-8111-111111111111';
const CREATED_BRAND_ID = '22222222-2222-4222-8222-222222222222';
const organization = {
  id: 1, name: 'Atelier QA', owner: 1, default_sede: 1,
  created_at: '2026-01-01', updated_at: '2026-01-01',
  sedes: [{ id: 1, name: 'Sede QA', organization: 1, members_count: 1,
    created_at: '2026-01-01', updated_at: '2026-01-01' }],
};
const legacyBrand = {
  id: 'brand-legacy-atelier', name: 'Atelier local', segment: 'Moda & Luxo',
  logoUrl: '/logo/catana_logo_white.png', paletteName: 'Paleta local',
  customPalette: { name: 'Paleta local', primary: '#112233', secondary: '#F8F8F8', accent: '#AA7744' },
  brandMarkdown: '# Atelier local\n\nPreservar o manual local para recuperação.',
  toneOfVoice: 'Claro e acolhedor', catalogs: [], createdAt: '2026-01-01',
};
const legacyBackup = JSON.stringify([legacyBrand]);

type EvidenceStatus = 'user_supplied' | 'inferred' | 'confirmed' | 'rejected';
interface RuleFixture {
  id: string; type: 'MUST' | 'PREFER' | 'AVOID'; category: string; rule: string;
  source: string; status: EvidenceStatus; confidence?: number;
}
interface BrandFixture {
  id: string; organization: number; name: string; segment: string; logo_url: string;
  palette_name: string; custom_palette: Record<string, unknown>; brand_markdown: string;
  tone_of_voice: string; commercial_contact: Record<string, unknown>; created_at: string;
  current_version: number; status: string; colors: Array<Record<string, unknown>>;
  guidelines: RuleFixture[]; memories: RuleFixture[];
  intelligence: Record<string, { value: unknown; source: string; status: EvidenceStatus; confidence?: number }>;
  assets: unknown[];
}
function brandFixture(overrides: Partial<BrandFixture> = {}): BrandFixture {
  return {
    id: BRAND_ID, organization: 1, name: 'Atelier QA', segment: 'Moda & Luxo',
    logo_url: '', palette_name: 'Paleta QA',
    custom_palette: { name: 'Paleta QA', primary: '#112233', secondary: '#F8F8F8', accent: '#AA7744' },
    brand_markdown: '# Atelier QA\n\nManual aprovado pelo responsável.',
    tone_of_voice: 'Claro e acolhedor', commercial_contact: { email: 'atelier@example.test' },
    created_at: '2026-01-01', current_version: 2, status: 'active',
    colors: [{ hex: '#112233', role: 'primary', source: 'user', status: 'user_supplied' }],
    guidelines: [
      { id: 'rule-approved', type: 'MUST', category: 'visual', rule: 'Preservar contraste legível', source: 'manual', status: 'confirmed' },
      { id: 'rule-inferred', type: 'PREFER', category: 'visual', rule: 'Preferir fundos claros', source: 'catalog-analysis', status: 'inferred', confidence: 0.82 },
      { id: 'rule-rejected', type: 'AVOID', category: 'copy', rule: 'Aplicar urgência promocional', source: 'catalog-analysis', status: 'rejected', confidence: 0.61 },
    ],
    memories: [],
    intelligence: {
      tone: { value: 'Sensorial', source: 'manual-analysis', status: 'inferred', confidence: 0.73 },
      positioning: { value: 'Distante', source: 'catalog-analysis', status: 'inferred', confidence: 0.59 },
    },
    assets: [], ...overrides,
  };
}

const historicalSnapshot = {
  id: BRAND_ID, name: 'Atelier anterior', version: 1,
  palette: { primary: '#332211', secondary: '#FFFFFF', accent: '#AA7744' },
  tone_of_voice: 'Tom aprovado na edição original',
};
const historicalCatalog = {
  id: 101, organization: 1, title: 'Edição histórica', total_pages: 2, spread_count: 1,
  brand: BRAND_ID, brand_name: 'Atelier anterior',
  brand_version: 1, brand_snapshot: historicalSnapshot, brand_snapshot_hash: 'historical-fingerprint',
  primary_color: '#332211', secondary_color: '#FFFFFF', accent_color: '#AA7744',
  palette_data: { name: 'Paleta da edição original', primary: '#332211', secondary: '#FFFFFF', accent: '#AA7744' },
  style_preset: 'Editorial', created_at: '2026-01-01',
  spreads: [{ id: 201, spread_index: 0,
    left_page: { id: 'historical-cover', pageNumber: 1, type: 'cover', title: 'EDIÇÃO ORIGINAL', backgroundColor: '#332211', textColor: '#FFFFFF', accentColor: '#AA7744', products: [], overlays: [] },
    right_page: { id: 'historical-back', pageNumber: 2, type: 'backcover', title: 'Atelier anterior', backgroundColor: '#FFFFFF', textColor: '#332211', accentColor: '#AA7744', products: [], overlays: [] },
  }],
};

interface RecordedMutation { path: string; method: string; body: Record<string, unknown> }
interface ApiFixture {
  brands: BrandFixture[]; mutations: RecordedMutation[]; listRequests: string[];
  listUnavailable: boolean; saveFailures: number; legacy: boolean; catalogs: boolean;
}

/** Stateful HTTP fixtures exercise the existing UI/store/service boundary without paid AI. */
async function fixtures(page: Page, options: Partial<ApiFixture> = {}) {
  const state: ApiFixture = {
    brands: [brandFixture()], mutations: [], listRequests: [], listUnavailable: false,
    saveFailures: 0, legacy: false, catalogs: false, ...options,
  };
  await page.addInitScript(({ organization, legacy, backup }) => {
    sessionStorage.setItem('catana_splash_shown', 'true');
    localStorage.setItem('active_organization', JSON.stringify(organization));
    localStorage.setItem('active_sede', JSON.stringify(organization.sedes[0]));
    if (legacy && !localStorage.getItem('katana_studio_brands:27')) {
      localStorage.setItem('katana_studio_brands:27', backup);
    }
  }, { organization, legacy: state.legacy, backup: legacyBackup });
  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();
    if (method === 'OPTIONS') return route.fulfill({ status: 204 });
    if (path.startsWith('/api/brands/')) {
      if (method === 'GET' && path === '/api/brands/') {
        state.listRequests.push(url.search);
        if (state.listUnavailable) return route.fulfill({ status: 503, json: { detail: 'Brand storage temporarily unavailable' } });
        return route.fulfill({ json: state.brands.filter(brand => brand.organization === Number(url.searchParams.get('organization'))) });
      }
      if (method === 'GET') {
        const brand = state.brands.find(brand => path === `/api/brands/${brand.id}/`);
        return route.fulfill({ status: brand ? 200 : 404, json: brand || { detail: 'Not found' } });
      }
      const body = request.postDataJSON() as Record<string, unknown>;
      state.mutations.push({ path, method, body });
      if (state.saveFailures > 0) {
        state.saveFailures--;
        return route.fulfill({ status: 503, json: { detail: 'Save unavailable' } });
      }
      if (path === '/api/brands/migrate/') {
        const brand = brandFixture({ id: CREATED_BRAND_ID, name: legacyBrand.name, current_version: 1 });
        state.brands = [...state.brands, brand];
        return route.fulfill({ json: { brands: [brand], id_mapping: { [legacyBrand.id]: brand.id } } });
      }
      if (method === 'POST' && path === '/api/brands/') {
        const brand = brandFixture({ ...body, id: CREATED_BRAND_ID, current_version: 1 } as Partial<BrandFixture>);
        state.brands = [...state.brands, brand];
        return route.fulfill({ status: 201, json: brand });
      }
      const brand = state.brands.find(brand => path.startsWith(`/api/brands/${brand.id}/`));
      if (!brand) return route.fulfill({ status: 404, json: { detail: 'Not found' } });
      if (method === 'POST' && (path.endsWith('/guidelines/') || path.endsWith('/memories/'))) {
        const rule = { ...body, id: 'user-rule-created' } as unknown as RuleFixture;
        const rules = path.endsWith('/guidelines/') ? brand.guidelines : brand.memories;
        rules.push(rule);
        brand.current_version++;
        return route.fulfill({ status: 201, json: rule });
      }
      if (path.endsWith('/decisions/')) {
        if (body.kind === 'color') {
          if (typeof body.id !== 'number' || !Number.isInteger(body.id)) {
            return route.fulfill({ status: 400, json: { detail: 'Color index must be an integer' } });
          }
          const color = brand.colors[Number(body.id)];
          if (color) color.status = body.status;
        } else if (body.kind === 'intelligence') {
          const inference = brand.intelligence[String(body.key)];
          if (inference) inference.status = body.status as EvidenceStatus;
        } else {
          const rules = body.kind === 'guideline' ? brand.guidelines : brand.memories;
          const rule = rules.find(rule => rule.id === body.id);
          if (rule) rule.status = body.status as EvidenceStatus;
        }
        brand.current_version++;
        return route.fulfill({ json: { ok: true } });
      }
      if (method === 'PATCH') {
        Object.assign(brand, body, { current_version: brand.current_version + 1 });
        return route.fulfill({ json: brand });
      }
      if (method === 'DELETE') {
        state.brands = state.brands.filter(candidate => candidate.id !== brand.id);
        return route.fulfill({ status: 204 });
      }
      return route.fulfill({ status: 400, json: { detail: 'Unexpected Brand fixture request' } });
    }
    let body: unknown = [];
    if (path.includes('/auth/')) body = { access: 'brand-qa-local-only', user: { id: 27, username: 'qa', name: 'QA Brand', email: 'qa@example.test', role: 'admin' } };
    else if (path === '/api/profile/') body = { id: 27, username: 'qa', name: 'QA Brand', email: 'qa@example.test', role: 'admin' };
    else if (path === '/api/organizations/') body = [organization];
    else if (path === '/api/v2/studio/catalogs/') body = state.catalogs ? [historicalCatalog] : [];
    else if (path === '/api/v2/studio/catalogs/101/') body = historicalCatalog;
    else if (path.includes('unread_count')) body = { count: 0 };
    else if (path.includes('/stats')) body = { catalogs: 0, products: 0, library: 0, history: 0 };
    else if (path.includes('/subscription') || path.includes('/billing/')) body = { plan: 'free', status: 'active', usage: {}, limits: {} };
    else if (/generate|\/chat\//.test(path)) return route.fulfill({ status: 418, json: { detail: 'Paid generation is outside browser QA' } });
    await route.fulfill({ json: body });
  });
  return state;
}

async function studio(page: Page) {
  await page.goto('/studio');
  await expect(page.getByRole('heading', { name: 'O que vamos criar hoje?' })).toBeVisible();
}

async function noOverflow(page: Page) {
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
}

async function selector(page: Page) {
  await page.getByTitle(/Nenhuma marca vinculada|Marca ativa:/).click();
  return page.getByRole('menu');
}

async function newBrand(page: Page) {
  const menu = await selector(page);
  await menu.getByRole('menuitem', { name: '+ Nova Marca', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Marca', exact: true });
  await expect(dialog).toBeVisible();
  return dialog;
}

async function editBrand(page: Page, id = BRAND_ID) {
  // Invoke the existing editor action for a server-loaded Brand. No alternate UI or test hook.
  await page.evaluate(async ({ brandId, moduleUrl }) => {
    const { useStudioStore } = await import(moduleUrl);
    useStudioStore.getState().openBrandModal(brandId);
  }, { brandId: id, moduleUrl: await studioModuleUrl(page) });
  const dialog = page.getByRole('dialog', { name: 'Marca', exact: true });
  await expect(dialog).toBeVisible();
  return dialog;
}

async function studioModuleUrl(page: Page) {
  // Use the module already mounted by the app. HMR query strings otherwise create a second store.
  return page.evaluate(() => performance.getEntriesByType('resource')
    .filter(entry => /\/src\/store\/studioStore\.ts(?:\?|$)/.test(entry.name))
    .at(-1)?.name || '/src/store/studioStore.ts');
}

test('existing Brand selector and editor create and update server truth across reload', async ({ page }) => {
  const state = await fixtures(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await studio(page);
  await expect.poll(() => state.listRequests.length).toBeGreaterThan(0);
  const dialog = await newBrand(page);
  await dialog.getByRole('textbox', { name: 'Nome da Marca', exact: true }).fill('Atelier persistente');
  await dialog.getByRole('textbox', { name: 'Tom de voz', exact: true }).fill('Preciso, humano e acolhedor');
  await dialog.getByRole('button', { name: 'Diretrizes', exact: true }).click();
  await dialog.getByRole('textbox', { name: 'Diretrizes BRAND.md', exact: true }).fill('# Atelier persistente\n\nPreservar a tipografia legível.');
  await dialog.getByRole('button', { name: 'Cadastrar Marca', exact: true }).click();
  await expect(dialog).toBeHidden();
  expect(state.mutations).toContainEqual(expect.objectContaining({
    path: '/api/brands/', method: 'POST',
    body: expect.objectContaining({ organization: 1, name: 'Atelier persistente', tone_of_voice: 'Preciso, humano e acolhedor', brand_markdown: '# Atelier persistente\n\nPreservar a tipografia legível.' }),
  }));
  const editor = await editBrand(page, CREATED_BRAND_ID);
  await editor.getByRole('button', { name: 'Identidade', exact: true }).click();
  await expect(editor.getByRole('textbox', { name: 'Nome da Marca', exact: true })).toHaveValue('Atelier persistente');
  await editor.getByRole('textbox', { name: 'Nome da Marca', exact: true }).fill('Atelier atualizado');
  await editor.getByRole('button', { name: 'Salvar Alterações', exact: true }).click();
  await expect(editor).toBeHidden();
  expect(state.mutations).toContainEqual(expect.objectContaining({
    path: `/api/brands/${CREATED_BRAND_ID}/`, method: 'PATCH',
    body: expect.objectContaining({ organization: 1, name: 'Atelier atualizado' }),
  }));
  await page.evaluate(() => {
    for (const key of Object.keys(localStorage)) if (key.startsWith('catana:studio:v2:') && key.endsWith(':brand_cache')) localStorage.removeItem(key);
  });
  await page.reload();
  await expect(page.getByRole('heading', { name: 'O que vamos criar hoje?' })).toBeVisible();
  const menu = await selector(page);
  await expect(menu.getByRole('menuitem', { name: /Atelier atualizado/ })).toBeVisible();
  await expect(menu.getByRole('menuitem', { name: /Atelier persistente/ })).toHaveCount(0);
  expect(state.listRequests.every(query => new URLSearchParams(query).get('organization') === '1')).toBe(true);
});

test('legacy browser Brands require destination confirmation and preserve backup after one import', async ({ page }) => {
  const state = await fixtures(page, { brands: [], legacy: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await studio(page);
  const editor = await newBrand(page);
  expect(state.mutations).toHaveLength(0);
  await editor.getByRole('button', { name: 'Importar marcas deste navegador', exact: true }).click();
  const migration = page.getByRole('dialog', { name: 'Importar marcas deste navegador', exact: true });
  await expect(migration).toBeVisible();
  await expect(migration.getByText(/Atelier QA/)).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(migration).toBeHidden();
  await expect(editor).toBeVisible();
  expect(state.mutations).toHaveLength(0);
  await editor.getByRole('button', { name: 'Importar marcas deste navegador', exact: true }).click();
  await migration.getByRole('button', { name: 'Confirmar importação', exact: true }).click();
  await expect(migration).toBeHidden();
  expect(state.mutations.filter(item => item.path === '/api/brands/migrate/')).toEqual([
    { path: '/api/brands/migrate/', method: 'POST', body: expect.objectContaining({ organization: 1, brands: [expect.objectContaining(legacyBrand)] }) },
  ]);
  await expect.poll(() => page.evaluate(() => localStorage.getItem('katana_studio_brands:27'))).toBe(legacyBackup);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'O que vamos criar hoje?' })).toBeVisible();
  const menu = await selector(page);
  await expect(menu.getByRole('menuitem', { name: /Atelier local/ })).toBeVisible();
  await page.keyboard.press('Escape');
  const freshEditor = await newBrand(page);
  await expect(freshEditor.getByRole('button', { name: 'Importar marcas deste navegador', exact: true })).toHaveCount(0);
  expect(state.mutations.filter(item => item.path === '/api/brands/migrate/')).toHaveLength(1);
  expect(await page.evaluate(() => localStorage.getItem('katana_studio_brands:27'))).toBe(legacyBackup);
  await noOverflow(page);
});

test('Brand loading failure keeps Studio usable and explicit retry restores server Brands', async ({ page }) => {
  const state = await fixtures(page, { listUnavailable: true });
  await page.setViewportSize({ width: 320, height: 568 });
  await studio(page);
  const input = page.getByRole('textbox', { name: 'Instrução para criação do catálogo', exact: true });
  await input.fill('O briefing permanece disponível quando a marca está offline');
  const menu = await selector(page);
  const retry = page.getByTitle(/Nenhuma marca vinculada|Marca ativa:/).locator('..').locator('..')
    .getByRole('button', { name: 'Tentar novamente', exact: true });
  await expect(retry).toBeVisible();
  await noOverflow(page);
  const retryBox = await retry.boundingBox();
  expect(retryBox!.x).toBeGreaterThanOrEqual(0);
  expect(retryBox!.x + retryBox!.width).toBeLessThanOrEqual(320);
  await expect(menu.getByRole('menuitem', { name: /Atelier QA/ })).toHaveCount(0);
  state.listUnavailable = false;
  await retry.click();
  if (!(await menu.isVisible())) await selector(page);
  await expect(menu.getByRole('menuitem', { name: /Atelier QA/ })).toBeVisible();
  await expect(input).toHaveValue('O briefing permanece disponível quando a marca está offline');
  expect(state.listRequests.length).toBeGreaterThanOrEqual(2);
  expect(state.mutations).toHaveLength(0);
});

test('failed Brand save retains the edited draft for a user retry', async ({ page }) => {
  const state = await fixtures(page, { saveFailures: 1 });
  await studio(page);
  const editor = await newBrand(page);
  await editor.getByRole('textbox', { name: 'Nome da Marca', exact: true }).fill('Draft sem perda');
  await editor.getByRole('button', { name: 'Cadastrar Marca', exact: true }).click();
  await expect(editor).toBeVisible();
  await expect(editor.getByRole('textbox', { name: 'Nome da Marca', exact: true })).toHaveValue('Draft sem perda');
  await expect.poll(() => state.mutations.length).toBe(1);
  expect(state.brands).toHaveLength(1);
  await editor.getByRole('button', { name: 'Cadastrar Marca', exact: true }).click();
  await expect(editor).toBeHidden();
  expect(state.mutations.filter(item => item.path === '/api/brands/')).toHaveLength(2);
  expect(state.brands.find(brand => brand.id === CREATED_BRAND_ID)?.name).toBe('Draft sem perda');
});

test('renaming a Brand preserves secondary palette tokens, colors and their provenance', async ({ page }) => {
  const original = brandFixture({
    custom_palette: { name: 'Paleta QA', primary: '#112233', secondary: '#F8F8F8', accent: '#AA7744', background: '#EFEFEA', surface: '#FCFCFC', locked: true },
    colors: [
      { hex: '#112233', role: 'primary', source: 'logo_upload', status: 'user_supplied' },
      { hex: '#888888', role: 'neutral', source: 'manual', status: 'confirmed' },
      { hex: '#FFFF00', role: 'forbidden', source: 'user_input', status: 'user_supplied' },
    ],
  });
  const state = await fixtures(page, { brands: [original] });
  await studio(page);
  await expect.poll(() => state.listRequests.length).toBeGreaterThan(0);
  const editor = await editBrand(page);
  await editor.getByRole('textbox', { name: 'Nome da Marca', exact: true }).fill('Atelier com nome revisado');
  await editor.getByRole('button', { name: 'Salvar Alterações', exact: true }).click();
  await expect(editor).toBeHidden();
  expect(state.brands[0].custom_palette).toMatchObject({ background: '#EFEFEA', surface: '#FCFCFC' });
  expect(state.brands[0].colors).toEqual(expect.arrayContaining([
    { hex: '#112233', role: 'primary', source: 'logo_upload', status: 'user_supplied' },
    { hex: '#888888', role: 'neutral', source: 'manual', status: 'confirmed' },
    { hex: '#FFFF00', role: 'forbidden', source: 'user_input', status: 'user_supplied' },
  ]));
});

test('inferred intelligence changes only after explicit confirmation or rejection', async ({ page }) => {
  const state = await fixtures(page);
  await studio(page);
  await expect.poll(() => state.listRequests.length).toBeGreaterThan(0);
  const editor = await editBrand(page);
  await editor.getByRole('button', { name: 'Diretrizes', exact: true }).click();
  await expect(editor.getByRole('listitem').filter({ hasText: 'Preservar contraste legível' }).getByText('Confirmado', { exact: false })).toBeVisible();
  await expect(editor.getByRole('listitem').filter({ hasText: 'Preferir fundos claros' }).getByText('Precisa de confirmação', { exact: false })).toBeVisible();
  await expect(editor.getByRole('listitem').filter({ hasText: 'Aplicar urgência promocional' }).getByText('Rejeitado', { exact: false })).toBeVisible();
  await expect(editor.getByRole('button', { name: 'Confirmar Preferir fundos claros', exact: true })).toBeVisible();
  await expect(editor.getByRole('button', { name: 'Confirmar Aplicar urgência promocional', exact: true })).toHaveCount(0);
  await editor.getByRole('button', { name: 'Inteligência', exact: true }).click();
  const tone = editor.getByText('Sensorial', { exact: false }).locator('..');
  await expect(tone.getByText('Precisa de confirmação', { exact: false })).toBeVisible();
  await expect(tone.getByText('Fonte: manual-analysis', { exact: false })).toBeVisible();
  expect(state.mutations).toHaveLength(0);
  await editor.getByRole('button', { name: 'Confirmar tone', exact: true }).click();
  await expect.poll(() => state.brands[0].intelligence.tone.status).toBe('confirmed');
  await expect(tone.getByText('Confirmado', { exact: false })).toBeVisible();
  await expect(editor.getByRole('button', { name: 'Confirmar tone', exact: true })).toHaveCount(0);
  expect(state.mutations).toContainEqual({ path: `/api/brands/${BRAND_ID}/decisions/`, method: 'POST', body: { kind: 'intelligence', key: 'tone', status: 'confirmed' } });
  await editor.getByRole('button', { name: 'Rejeitar positioning', exact: true }).click();
  await expect.poll(() => state.brands[0].intelligence.positioning.status).toBe('rejected');
  await expect(editor.getByText('Distante', { exact: false }).locator('..').getByText('Rejeitado', { exact: false })).toBeVisible();
  expect(state.mutations).toContainEqual({ path: `/api/brands/${BRAND_ID}/decisions/`, method: 'POST', body: { kind: 'intelligence', key: 'positioning', status: 'rejected' } });
  expect(state.brands[0].guidelines.map(rule => rule.status)).toEqual(['confirmed', 'inferred', 'rejected']);
});

test('explicit Brand memory requires Save and retains type, category and user provenance', async ({ page }) => {
  const state = await fixtures(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await studio(page);
  await expect.poll(() => state.listRequests.length).toBeGreaterThan(0);
  const editor = await editBrand(page);
  await editor.getByRole('button', { name: 'Diretrizes', exact: true }).click();
  await editor.getByRole('combobox', { name: 'Salvar como', exact: true }).selectOption('memories');
  await editor.getByRole('combobox', { name: 'Tipo de regra', exact: true }).selectOption('AVOID');
  await editor.getByRole('combobox', { name: 'Categoria da regra', exact: true }).selectOption('color');
  await editor.getByRole('textbox', { name: 'Texto da regra', exact: true }).fill('Evitar dourado nas próximas coleções');
  expect(state.mutations).toHaveLength(0);
  await editor.getByRole('button', { name: 'Salvar regra', exact: true }).click();
  await expect(editor.getByRole('listitem').filter({ hasText: 'Evitar dourado nas próximas coleções' })).toContainText('Informado por você');
  expect(state.mutations).toEqual([{
    path: `/api/brands/${BRAND_ID}/memories/`, method: 'POST',
    body: { type: 'AVOID', category: 'color', rule: 'Evitar dourado nas próximas coleções', source: 'user_input', status: 'user_supplied' },
  }]);
  await expect(editor.getByRole('textbox', { name: 'Texto da regra', exact: true })).toHaveValue('');
  expect(state.brands[0].guidelines.find(rule => rule.id === 'rule-inferred')?.status).toBe('inferred');
  await noOverflow(page);
});

test('inferred palette colors need separate user confirmation or rejection', async ({ page }) => {
  const state = await fixtures(page, { brands: [brandFixture({ colors: [
    { hex: '#112233', role: 'primary', source: 'catalog-analysis', status: 'inferred', confidence: 0.8 },
    { hex: '#888888', role: 'neutral', source: 'catalog-analysis', status: 'inferred', confidence: 0.6 },
  ] })] });
  await page.setViewportSize({ width: 390, height: 844 });
  await studio(page);
  await expect.poll(() => state.listRequests.length).toBeGreaterThan(0);
  const editor = await editBrand(page);
  await editor.getByRole('button', { name: 'Inteligência', exact: true }).click();
  const primary = editor.getByText('primary: #112233', { exact: false }).locator('..');
  await expect(primary).toContainText('Precisa de confirmação');
  expect(state.mutations).toHaveLength(0);
  await editor.getByRole('button', { name: 'Confirmar cor primary', exact: true }).click();
  await expect(primary).toContainText('Confirmado');
  await expect(editor.getByRole('button', { name: 'Confirmar cor primary', exact: true })).toHaveCount(0);
  await editor.getByRole('button', { name: 'Rejeitar cor neutral', exact: true }).click();
  await expect(editor.getByText('neutral: #888888', { exact: false }).locator('..')).toContainText('Rejeitado');
  expect(state.mutations).toEqual([
    { path: `/api/brands/${BRAND_ID}/decisions/`, method: 'POST', body: { kind: 'color', id: 0, status: 'confirmed' } },
    { path: `/api/brands/${BRAND_ID}/decisions/`, method: 'POST', body: { kind: 'color', id: 1, status: 'rejected' } },
  ]);
  await noOverflow(page);
});

test('editing current Brand preserves the loaded historical catalog snapshot and document colors', async ({ page }) => {
  const state = await fixtures(page, { catalogs: true });
  await page.setViewportSize({ width: 1440, height: 900 });
  await studio(page);
  await expect.poll(() => state.listRequests.length).toBeGreaterThan(0);
  await page.evaluate(async (moduleUrl) => {
    const { useStudioStore } = await import(moduleUrl);
    await useStudioStore.getState().loadExistingCatalog('101');
  }, await studioModuleUrl(page));
  await expect(page.getByTestId('studio-publication-viewport')).toBeVisible();
  await expect(page.getByText('Este catálogo usa a versão 1. A marca está na versão 2. A identidade original foi preservada.', { exact: true })).toBeVisible();
  const before = await page.evaluate(async (moduleUrl) => {
    const { useStudioStore } = await import(moduleUrl);
    const state = useStudioStore.getState();
    return { context: state.catalogBrandContext, pages: state.pages, palette: state.activePalette, activeBrandId: state.activeBrandId };
  }, await studioModuleUrl(page));
  expect(before.context).toEqual({ brandId: BRAND_ID, brandVersion: 1, brandSnapshot: historicalSnapshot, brandSnapshotHash: 'historical-fingerprint' });
  expect(before.activeBrandId).toBe(BRAND_ID);
  const editor = await editBrand(page);
  await editor.getByRole('textbox', { name: 'Nome da Marca', exact: true }).fill('Identidade revisada');
  await editor.getByRole('button', { name: 'Salvar Alterações', exact: true }).click();
  await expect(editor).toBeHidden();
  expect(state.brands[0].current_version).toBe(3);
  const after = await page.evaluate(async (moduleUrl) => {
    const { useStudioStore } = await import(moduleUrl);
    const state = useStudioStore.getState();
    return { context: state.catalogBrandContext, pages: state.pages, palette: state.activePalette, activeBrandId: state.activeBrandId };
  }, await studioModuleUrl(page));
  expect(after).toEqual(before);
  await expect(page.getByText('Este catálogo usa a versão 1. A marca está na versão 3. A identidade original foi preservada.', { exact: true })).toBeVisible();
  expect(state.mutations.every(item => item.path.startsWith('/api/brands/'))).toBe(true);
});

for (const [width, height] of [[320, 568], [390, 844], [844, 390], [1440, 900]]) {
  test(`existing Brand dialog fits ${width}x${height} and restores focus`, async ({ page }, testInfo) => {
    const state = await fixtures(page);
    await page.setViewportSize({ width, height });
    await studio(page);
    await expect.poll(() => state.listRequests.length).toBeGreaterThan(0);
    const focusOrigin = page.getByRole('textbox', { name: 'Instrução para criação do catálogo', exact: true });
    await focusOrigin.focus();
    const editor = await editBrand(page);
    for (const tab of ['Identidade', 'Diretrizes', 'Inteligência']) {
      await editor.getByRole('button', { name: tab, exact: true }).click();
      await noOverflow(page);
      const box = await editor.boundingBox();
      expect(box!.width).toBeLessThanOrEqual(width + 1);
      expect(box!.height).toBeLessThanOrEqual(height + 1);
      await page.screenshot({ path: testInfo.outputPath(`brand-${tab}-${width}x${height}.png`) });
    }
    await page.keyboard.press('Escape');
    await expect(editor).toBeHidden();
    await expect(focusOrigin).toBeFocused();
    expect(state.mutations).toHaveLength(0);
  });
}
