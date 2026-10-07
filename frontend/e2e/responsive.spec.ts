import { test, expect, type Page } from '@playwright/test';

const viewports = [
  [320,568], [360,800], [375,667], [390,844], [393,852], [412,915], [430,932],
  [768,1024], [820,1180], [844,390], [932,430], [1024,768], [1280,800], [1440,900], [1920,1080],
];
const routes = ['/', '/studio', '/dashboard', '/catalogs', '/products', '/products/new',
  '/categories', '/media', '/organizations', '/explore', '/search?q=camisa', '/inbox', '/view/maison_verdana', '/c/maison_verdana'];

async function fixtures(page: Page) {
  await page.addInitScript(() => {
    sessionStorage.setItem('catana_splash_shown', 'true');
    localStorage.setItem('access_token', 'responsive-test');
    localStorage.setItem('refresh_token', 'responsive-test');
  });
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    let body: unknown = [];
    if (path.includes('/auth/')) body = { access: 'responsive-test', refresh: 'responsive-test', user: { id: 1, username: 'qa', name: 'QA Mobile', email: 'qa@example.test', role: 'admin' } };
    else if (path === '/api/profile/') body = {id: 1, username: 'qa', name: 'QA Mobile', email: 'qa@example.test', role: 'admin'};
    else if (path.includes('/public/catalogs/')) return route.fulfill({ status: 404, json: { detail: 'Fixture uses canonical demo fallback' } });
    else if (path === '/api/organizations/') body = [{ id: 1, name: 'Atelier de teste', owner: 1, created_at: '2026-01-01', updated_at: '2026-01-01', default_sede: 1, sedes: [{ id: 1, name: 'Sede principal', organization: 1, created_at: '2026-01-01', updated_at: '2026-01-01', members_count: 1 }] }];
    else if (path === '/api/media/stats/') body = { total_files: 1, folders_count: 0, total_size: 1024, total_size_formatted: '1 KB', images_count: 1, videos_count: 0, documents_count: 0, favorites_count: 0 };
    else if (path === '/api/media/') body = [{ id: 1, name: 'Imagem editorial de teste', media_type: 'image', file: '/logo/catana_logo_white.png', mime_type: 'image/png', file_size: 1024, file_size_formatted: '1 KB', width: 100, height: 100, duration: null, folder: null, folder_name: null, tags: [], is_favorite: false, usage_count: 0, uploaded_by: 1, created_at: '2026-01-01', updated_at: '2026-01-01' }];
    else if (path === '/api/catalogs/') body = [{ id: 1, title: 'Catálogo editorial de teste', description: 'Documento de revisão', is_public: false, created_at: '2026-01-01', updated_at: '2026-01-01' }];
    else if (path.includes('unread_count')) body = { count: 0 };
    else if (path === '/api/products/' || path === '/api/explore/products/') body = [{ id: 1, name: 'Camisa editorial com nome longo para validar largura', sku: 'CAT-001', price: '129.90', currency: 'BRL', stock: 3, category: null, image_url: null, description: 'Produto de teste', created_at: '2026-01-01', updated_at: '2026-01-01' }];
    else if (path.includes('/search/')) body = { products: [], catalogs: [], profiles: [], total: 0 };
    else if (path.includes('/dashboard/') || path.includes('/stats')) body = { catalogs: 1, products: 1, library: 0, history: 0 };
    else if (path.includes('/subscription') || path.includes('/billing/')) body = { plan: 'free', status: 'active', usage: {}, limits: {} };
    await route.fulfill({ json: body });
  });
}

async function noOverflow(page: Page) {
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
}

for (const [width, height] of viewports) {
  test(`critical routes fit ${width}x${height}`, async ({ page }) => {
    await fixtures(page);
    await page.setViewportSize({ width, height });
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    for (const route of routes) {
      await page.goto(route);
      await expect(page.locator('#root')).not.toBeEmpty();
      await page.waitForTimeout(250);
      await noOverflow(page);
      if (route === '/studio') {
        await expect(page.getByRole('heading', { name: 'O que vamos criar hoje?' })).toBeVisible();
        if (width < 768) await expect(page.getByRole('tab', { name: 'Assistente' })).toBeVisible();
      }
      if (route === '/products') await expect(page.getByText('CAT-001', { exact: false })).toBeVisible();
      if (route === '/view/maison_verdana') await expect(page.getByTestId('reader-publication-viewport')).toBeVisible();
      expect(errors, `runtime errors at ${route}`).toEqual([]);
    }
  });
}

async function waitForWorkspace(page: Page) {
  await expect.poll(() => page.evaluate(async () => {
    // @ts-expect-error Vite serves the application store for this browser fixture.
    const { useStudioStore } = await import('/src/store/studioStore.ts');
    return useStudioStore.getState().catalogSyncStatus;
  })).toBe('ready');
}

async function openCatalog(page: Page) {
  await waitForWorkspace(page);
  await page.evaluate(async () => {
    // Seed existing store with canonical document fixtures; no production test hook.
    // @ts-expect-error Vite serves application TS modules for this dev-browser integration test.
    const { useStudioStore } = await import('/src/store/studioStore.ts');
    // @ts-expect-error Vite serves canonical catalog fixtures.
    const { CANONICAL_DEMO_TEMPLATES } = await import('/src/data/demoCatalogs.data.ts');
    const pages = CANONICAL_DEMO_TEMPLATES[0].pages;
    useStudioStore.setState({ hasStartedSession: true, pages, totalPages: pages.length, currentSpread: [1,2], catalogTitle: 'QA editorial', isCoPilotOpen: true });
  });
}

test('phone Studio keeps prompt, thread and document across pane changes and rotation', async ({ page }) => {
  await fixtures(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/studio');
  await expect(page.getByRole('heading', { name: 'O que vamos criar hoje?' })).toBeVisible();
  await page.getByRole('button', { name: 'Abrir navegação do Studio' }).click();
  await expect(page.getByRole('dialog', { name: 'Catana Studio' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Catana Studio' })).toBeHidden();
  await openCatalog(page);
  const input = page.getByRole('textbox', { name: 'Instrução ou comando para o assistente de design' });
  await input.fill('Preservar o briefing ao girar');
  await page.locator('.agent-input input[type=file]').setInputFiles({ name: 'briefing.txt', mimeType: 'text/plain', buffer: Buffer.from('Briefing editorial para teste responsivo') });
  await expect(page.getByText('briefing.txt', { exact: true })).toBeVisible();
  await page.getByRole('tab', { name: 'Catálogo' }).click();
  await expect(input).toBeHidden();
  await expect(page.getByTestId('studio-publication-viewport')).toBeVisible();
  await expect.poll(() => page.locator('[data-testid=studio-publication-viewport] .origin-top-left').evaluate((element) => element.getBoundingClientRect().width)).toBeLessThanOrEqual(366);
  await page.getByRole('button', { name: 'Abrir página 2', exact: true }).click();
  await page.getByRole('button', { name: 'Mais ferramentas' }).click();
  await expect(page.getByRole('dialog', { name: 'Ferramentas do catálogo' })).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Produtos do catálogo' }).click();
  await expect(page.getByRole('dialog', { name: 'Produtos', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('tab', { name: 'Assistente' }).click();
  await expect(input).toHaveValue('Preservar o briefing ao girar');
  await page.setViewportSize({ width: 844, height: 390 });
  await noOverflow(page);
  await expect(input).toHaveValue('Preservar o briefing ao girar');
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(input).toHaveValue('Preservar o briefing ao girar');
});

test('mobile management search, more navigation and modal Escape', async ({ page }) => {
  await fixtures(page);
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto('/products');
  await page.getByRole('button', { name: 'Abrir busca global' }).click();
  await expect(page.getByRole('dialog', { name: 'Busca global' })).toBeVisible();
  await page.getByRole('textbox', { name: 'Busca global' }).fill('camisa');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Mais destinos' }).click();
  await page.getByRole('link', { name: 'Organizações', exact: true }).click();
  await expect(page).toHaveURL(/organizations/);
  await noOverflow(page);
});

test('reader fit and page selection survive orientation; zoom remains locally scrollable', async ({ page }) => {
  await fixtures(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/view/maison_verdana');
  await expect(page.getByTestId('reader-publication-viewport')).toBeVisible();
  await page.getByRole('button', { name: 'Próxima página', exact: true }).click();
  await expect(page.getByRole('slider', { name: 'Selecionar página' })).toHaveValue('1');
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('slider', { name: 'Selecionar página' })).toHaveValue('1');
  await page.getByRole('button', { name: 'Aumentar zoom', exact: true }).click();
  await noOverflow(page);
  await page.getByRole('button', { name: 'Alternar tema de ambiência' }).click();
  await noOverflow(page);
});

for (const [width, height] of [[390,844], [768,1024], [1440,900]]) {
  test(`representative screenshots ${width}`, async ({ page }, testInfo) => {
    await fixtures(page);
    await page.setViewportSize({ width, height });
    for (const [route, name] of [['/studio','studio-home'], ['/products','products'], ['/products/new','create-product'], ['/dashboard','dashboard'], ['/view/maison_verdana','reader']]) {
      await page.goto(route);
      await page.waitForTimeout(400);
      await page.screenshot({ path: testInfo.outputPath(`${name}-${width}.png`), fullPage: true });
    }
    await page.goto('/studio');
    await openCatalog(page);
    await page.waitForTimeout(400);
    await page.screenshot({ path: testInfo.outputPath(`studio-assistant-${width}.png`) });
    if (width < 768) await page.getByRole('tab', { name: 'Catálogo' }).click();
    await page.waitForTimeout(300);
    await page.screenshot({ path: testInfo.outputPath(`studio-canvas-${width}.png`) });
  });
}

for (const [width, height] of [[320,568], [844,390], [1440,900]]) {
  test(`editor dialogs fit and restore focus ${width}x${height}`, async ({ page }) => {
    await fixtures(page);
    await page.setViewportSize({ width, height });
    await page.goto('/studio');
    await openCatalog(page);
    for (const [flag, label] of [['isNewCatalogModalOpen','Novo catálogo'], ['isExportModalOpen','Exportar catálogo'], ['isBrandModalOpen','Marca'],
      ['isAccountSettingsOpen','Configurações da conta'], ['isExcelImportModalOpen','Importar produtos'],
      ['isSystemDesignModalOpen','Sistema editorial'], ['isRoleManagerOpen','Agentes e cargos'],
      ['isCouncilModalOpen','Conselho editorial'], ['isPalettePanelOpen','Paleta'], ['isSkillsModalOpen','Habilidades']]) {
      const focusOrigin = page.locator('button:visible').first();
      await focusOrigin.focus();
      await page.evaluate(async (key) => {
        // @ts-expect-error Existing Vite module, loaded for integration fixtures.
        const { useStudioStore } = await import('/src/store/studioStore.ts');
        useStudioStore.setState({ [key]: true });
      }, flag);
      const dialog = page.getByRole('dialog', { name: label, exact: true });
      await expect(dialog).toBeVisible();
      const box = await dialog.boundingBox();
      expect(box!.width).toBeLessThanOrEqual(width + 1);
      expect(box!.height).toBeLessThanOrEqual(height + 1);
      await noOverflow(page);
      await page.keyboard.press('Escape');
      await expect(dialog).toBeHidden();
      await expect(focusOrigin, `Focus returns after ${label}`).toBeFocused();
    }
  });
}

test('reader exposes products through a touch-friendly sheet and named product dialog', async ({ page }) => {
  await fixtures(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/view/maison_verdana');
  await expect(page.getByTestId('reader-publication-viewport')).toBeVisible();
  for (let index = 0; index < 6 && !(await page.getByRole('button', { name: 'Ver produtos da página' }).count()); index++) {
    await page.getByRole('button', { name: 'Próxima página', exact: true }).click();
  }
  await page.getByRole('button', { name: 'Ver produtos da página' }).click();
  const sheet = page.getByRole('dialog', { name: 'Produtos da página' });
  await expect(sheet).toBeVisible();
  await sheet.locator('button').nth(1).click();
  await expect(page.getByRole('dialog', { name: 'Detalhes do produto' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Detalhes do produto' })).toBeHidden();
});

test('authentication fits phone and does not dismiss a required login', async ({ page }) => {
  await fixtures(page);
  await page.route('**/api/auth/**', (route) => route.fulfill({ status: 401, json: { detail: 'Unauthenticated fixture' } }));
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto('/login');
  const dialog = page.getByRole('dialog', { name: 'Autenticação', exact: true });
  await expect(dialog).toBeVisible();
  await noOverflow(page);
  await page.keyboard.press('Escape');
  await expect(dialog).toBeVisible();
  await page.setViewportSize({ width: 844, height: 390 });
  await noOverflow(page);
  await expect.poll(async () => (await dialog.boundingBox())!.height).toBeLessThanOrEqual(390);
});

test('simulated visual keyboard keeps the focused assistant input inside the active viewport', async ({ page }) => {
  await fixtures(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/studio');
  await openCatalog(page);
  const input = page.getByRole('textbox', { name: 'Instrução ou comando para o assistente de design' });
  await input.fill('Briefing com teclado aberto');
  await page.evaluate(() => {
    // Headless simulation of a keyboard resize; physical iOS/Android remains manual QA.
    Object.defineProperty(window.visualViewport!, 'height', { configurable: true, value: 430 });
    window.visualViewport!.dispatchEvent(new Event('resize'));
  });
  await expect.poll(async () => (await input.boundingBox())!.y + (await input.boundingBox())!.height).toBeLessThanOrEqual(430);
  await expect(input).toHaveValue('Briefing com teclado aberto');
});

test('reader swipe advances at fit zoom and is ignored while zoomed', async ({ page }) => {
  await fixtures(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/view/maison_verdana');
  const viewport = page.getByTestId('reader-publication-viewport');
  await expect(viewport).toBeVisible();
  const swipe = async () => {
    await viewport.dispatchEvent('pointerdown', { pointerId: 1, pointerType: 'touch', isPrimary: true, clientX: 300, clientY: 400 });
    await viewport.dispatchEvent('pointerup', { pointerId: 1, pointerType: 'touch', isPrimary: true, clientX: 120, clientY: 410 });
  };
  await swipe();
  await expect(page.getByRole('slider', { name: 'Selecionar página' })).toHaveValue('1');
  await page.getByRole('button', { name: 'Aumentar zoom', exact: true }).click();
  await swipe();
  await expect(page.getByRole('slider', { name: 'Selecionar página' })).toHaveValue('1');
});

test('phone inbox shows one conversation pane and returns to the list', async ({ page }) => {
  await fixtures(page);
  const conversation = { id: 1, origin_type: 'catalog', context: { title: 'Consulta ao catálogo editorial', subtitle: 'Atelier' }, updated_at: '2026-01-01', unread_count: 0, messages: [{ id: 1, sender: 2, content: 'Gostaria de conhecer a coleção.', created_at: '2026-01-01' }] };
  await page.route('**/api/conversations/**', (route) => route.fulfill({ json: new URL(route.request().url()).pathname === '/api/conversations/' ? [conversation] : conversation }));
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto('/inbox');
  await page.getByRole('button', { name: /Consulta ao catálogo editorial/ }).click();
  await expect(page.getByRole('textbox', { name: 'Mensagem' })).toBeVisible();
  await noOverflow(page);
  await page.getByRole('button', { name: 'Voltar às conversas' }).click();
  await expect(page.getByRole('textbox', { name: 'Mensagem' })).toBeHidden();
});

test('desktop Studio preserves sidebar shortcuts, CoPilot visibility and document coordinates', async ({ page }) => {
  await fixtures(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/studio');
  await openCatalog(page);
  const documentBefore = await page.evaluate(async () => {
    // @ts-expect-error Existing Vite module for fixture inspection.
    const { useStudioStore } = await import('/src/store/studioStore.ts');
    return JSON.stringify(useStudioStore.getState().pages);
  });
  await page.keyboard.press('Control+b');
  await page.keyboard.press('Control+j');
  await expect(page.locator('#studio-assistant')).toBeHidden();
  await page.keyboard.press('Control+j');
  await expect(page.locator('#studio-assistant')).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('tab', { name: 'Catálogo' }).click();
  await page.setViewportSize({ width: 1440, height: 900 });
  const documentAfter = await page.evaluate(async () => {
    // @ts-expect-error Existing Vite module for fixture inspection.
    const { useStudioStore } = await import('/src/store/studioStore.ts');
    return JSON.stringify(useStudioStore.getState().pages);
  });
  expect(documentAfter).toBe(documentBefore);
  await noOverflow(page);
});

test('shared management chrome follows light and dark themes on phone', async ({ page }) => {
  await fixtures(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/dashboard');
  await page.evaluate(async () => {
    // @ts-expect-error Existing Vite module; use the application's theme action.
    const { useStudioStore } = await import('/src/store/studioStore.ts');
    if (useStudioStore.getState().theme === 'dark') useStudioStore.getState().toggleTheme();
  });
  await expect(page.locator('html')).not.toHaveClass(/dark/);
  await noOverflow(page);
  await expect(page.locator('.management-header')).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  await page.evaluate(async () => {
    // @ts-expect-error Existing Vite module; use the application's theme action.
    const { useStudioStore } = await import('/src/store/studioStore.ts');
    useStudioStore.getState().toggleTheme();
  });
  await expect(page.locator('html')).toHaveClass(/dark/);
  await noOverflow(page);
});


test('generation progress keeps cancel and editor actions reachable on compact screens', async ({ page }) => {
  await fixtures(page);
  await page.goto('/studio');
  await waitForWorkspace(page);
  await page.evaluate(async () => {
    // @ts-expect-error Existing Vite module; seed UI without calling paid generation services.
    const { useStudioStore } = await import('/src/store/studioStore.ts');
    useStudioStore.setState({ isGeneratingCatalog: true, generationStage: 2, generationProgress: 42 });
  });
  for (const [width, height] of [[320, 568], [390, 844], [844, 390], [768, 1024]]) {
    await page.setViewportSize({ width, height });
    for (const name of ['Cancelar', 'Pular para o editor']) {
      const button = page.getByRole('button', { name, exact: true });
      await expect(button).toBeVisible();
      const box = await button.boundingBox();
      expect(box?.x).toBeGreaterThanOrEqual(0);
      expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(width);
      expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThanOrEqual(height);
    }
    await noOverflow(page);
  }
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Pular para o editor', exact: true })).toBeHidden();
});

test('tablet catalog fits inside its pane alongside the assistant', async ({ page }) => {
  await fixtures(page);
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.goto('/studio');
  await openCatalog(page);
  const viewport = page.getByTestId('studio-publication-viewport');
  await expect(viewport).toBeVisible();
  await page.waitForTimeout(400);
  const bounds = await viewport.evaluate((element) => ({ width: element.clientWidth, scrollWidth: element.scrollWidth }));
  expect(bounds, JSON.stringify(bounds)).toMatchObject({ scrollWidth: bounds.width });
});
