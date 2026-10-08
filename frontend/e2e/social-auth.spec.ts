import { test, expect, type Page } from '@playwright/test';

// Normal responsive runs keep their real SDK resolution and never run this fixture.
test.skip(process.env.CATANA_SOCIAL_AUTH_E2E !== 'true', 'Requires the explicit social-auth browser configuration.');

type Scenario = 'success' | 'cancel' | 'disabled' | 'callback_error';
type RequestRecord = { path: string; method: string; authorization: string | undefined; body: unknown };
const profile = { id: 47, username: 'social_qa', name: 'QA Social', email: 'social@example.test', role: 'admin' };
const organizations = [{ id: 23, name: 'Atelier Social', owner: 47, created_at: '2026-01-01', updated_at: '2026-01-01', default_sede: 31, sedes: [{ id: 31, name: 'Sede principal', organization: 23 }] }];

async function browserFixture(page: Page, options: {
  theme?: 'light' | 'dark'; scenario?: Scenario; legacy?: boolean;
  profileGate?: Promise<void>; organizationGate?: Promise<void>;
} = {}) {
  await page.addInitScript(({ theme, scenario, legacy }) => {
    sessionStorage.setItem('catana_splash_shown', 'true');
    if (!sessionStorage.getItem('catana_social_fixture_initialized')) {
      sessionStorage.setItem('catana_social_fixture_initialized', 'true');
      sessionStorage.setItem('catana_clerk_mock_scenario', scenario);
      localStorage.setItem('katana_theme', theme);
      if (!legacy) {
        // An old legacy session cannot make a Clerk browser ready.
        localStorage.setItem('access_token', 'stale-legacy-access');
        localStorage.setItem('refresh_token', 'stale-legacy-refresh');
      }
    }
  }, { theme: options.theme || 'light', scenario: options.scenario || 'success', legacy: Boolean(options.legacy) });
  const requests: RequestRecord[] = [];
  const googleRequests: string[] = [];
  page.on('request', request => {
    const url = new URL(request.url());
    if (url.hostname === 'accounts.google.com') googleRequests.push(url.pathname);
  });
  await page.route('**/api/**', async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    let body: unknown = null;
    try { body = request.postDataJSON(); } catch { /* Non-JSON request bodies are irrelevant to this contract. */ }
    requests.push({ path, method: request.method(), authorization: request.headers().authorization, body });
    if (path === '/api/auth/token/refresh/') return route.fulfill({ status: 401, json: { detail: 'No legacy session' } });
    if (path === '/api/auth/google/') return route.fulfill({ json: { access: 'legacy-browser-access', refresh: 'legacy-browser-refresh' } });
    if (path === '/api/profile/') {
      if (options.profileGate) await options.profileGate;
      return route.fulfill({ json: profile });
    }
    if (path === '/api/organizations/') {
      if (options.organizationGate) await options.organizationGate;
      return route.fulfill({ json: organizations });
    }
    if (path.includes('/subscription') || path.includes('/billing/')) return route.fulfill({ json: { plan: 'free', status: 'active', usage: {}, limits: {} } });
    await route.fulfill({ json: [] });
  });
  return { requests, googleRequests };
}

async function state(page: Page) {
  return page.evaluate(async () => {
    // These imports inspect the real stores without adding a production test hook.
    // Reuse Vite's loaded URL, including its HMR revision, instead of creating a second store.
    const resourceUrl = (pathname: string) => {
      const loaded = performance.getEntriesByType('resource')
        .map(entry => new URL(entry.name))
        .filter(url => url.origin === location.origin && url.pathname === pathname)
        .sort((a, b) => Number(b.searchParams.get('t') || 0) - Number(a.searchParams.get('t') || 0));
      return loaded[0]?.href || pathname;
    };
    const { useAuthStore } = await import(/* @vite-ignore */ resourceUrl('/src/store/authStore.ts'));
    const context = await import(/* @vite-ignore */ resourceUrl('/src/services/workspaceContext.ts'));
    const { isTokenReady } = await import(/* @vite-ignore */ resourceUrl('/src/services/authTokenProvider.ts'));
    const auth = useAuthStore.getState();
    return {
      status: auth.authStatus,
      userId: auth.user?.id || null,
      subject: auth.user?.externalAuthId || null,
      organizationId: auth.activeOrganizationId,
      tokenReady: isTokenReady(),
      contextUserId: context.getContextUserId(),
      contextOrganizationId: context.getContextOrganizationId(),
    };
  });
}

async function mockCalls(page: Page) {
  return page.evaluate(() => JSON.parse(sessionStorage.getItem('catana_clerk_mock_calls') || '[]') as { operation: string; options?: Record<string, string> }[]);
}

async function setScenario(page: Page, scenario: Scenario) {
  await page.evaluate(value => {
    const sdk = (window as unknown as { __catanaClerkSdkMock: { setScenario: (value: string) => void } }).__catanaClerkSdkMock;
    sdk.setScenario(value);
  }, scenario);
}

async function noOverflow(page: Page) {
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
}

function assertNoLegacyAuthority(requests: RequestRecord[], googleRequests: string[]) {
  expect(requests.filter(request => request.path.startsWith('/api/auth/') || request.path === '/api/register/')).toEqual([]);
  expect(googleRequests).toEqual([]);
}

test.describe('Clerk social authentication', () => {
  for (const [width, height] of [[320, 568], [375, 667], [390, 844], [768, 1024], [1024, 768], [1440, 900], [1920, 1080]]) {
    for (const theme of ['light', 'dark'] as const) {
      test(`canonical login modal fits ${width}x${height} in ${theme}`, async ({ page }, testInfo) => {
        const fixture = await browserFixture(page, { theme });
        await page.setViewportSize({ width, height });
        await page.goto('/login');
        const modal = page.getByRole('dialog', { name: 'Autenticação' });
        await expect(modal).toBeVisible();
        await expect(modal.locator('[data-auth-provider="clerk"]')).toBeVisible();
        const google = modal.getByRole('button', { name: 'Continuar com o Google', exact: true });
        await expect(google).toHaveCount(1);
        await expect(google).toBeVisible();
        await expect(modal.locator('.cl-socialButtonsRoot')).toBeHidden();
        await expect(modal.locator('.cl-footer')).toBeHidden();
        const dimensions = await modal.locator('[data-auth-provider="clerk"]').evaluate(section => {
          const outer = section.getBoundingClientRect();
          return [...section.querySelectorAll('.cl-rootBox, .cl-cardBox, .cl-card, input')].map(node => {
            const bounds = node.getBoundingClientRect();
            return { left: bounds.left - outer.left, right: bounds.right - outer.right };
          });
        });
        for (const bounds of dimensions) { expect(bounds.left).toBeGreaterThanOrEqual(-1); expect(bounds.right).toBeLessThanOrEqual(1); }
        const email = modal.getByLabel('E-mail');
        await expect(email).toBeEditable();
        await email.focus();
        await page.keyboard.press('Tab');
        await expect(modal.getByLabel('Senha')).toBeFocused();
        expect(await email.evaluate(node => getComputedStyle(node).color)).toBe(theme === 'dark' ? 'rgb(244, 244, 245)' : 'rgb(24, 24, 27)');
        expect((await google.boundingBox())?.height).toBeGreaterThanOrEqual(44);
        await expect(page.locator('html')).toHaveClass(theme === 'dark' ? /dark/ : /^(?!.*dark).*$/);
        await google.scrollIntoViewIfNeeded();
        await noOverflow(page);
        await page.keyboard.press('Escape');
        await expect(modal).toBeVisible();
        expect((await state(page)).status).toBe('signed_out');
        await expect(page.locator('script[src*="accounts.google.com/gsi"]')).toHaveCount(0);
        assertNoLegacyAuthority(fixture.requests, fixture.googleRequests);
        await page.screenshot({ path: testInfo.outputPath(`login-${width}-${theme}.png`) });
      });
    }
  }

  test('registration and recovery reuse Clerk authority without Catana password endpoints', async ({ page }) => {
    const fixture = await browserFixture(page, { scenario: 'cancel' });
    await page.setViewportSize({ width: 320, height: 568 });
    await page.goto('/register');
    const modal = page.getByRole('dialog', { name: 'Autenticação' });
    await expect(modal.getByRole('heading', { name: 'Criar sua conta' })).toBeVisible();
    await expect(modal.getByRole('form', { name: 'Formulário Clerk de cadastro' })).toBeVisible();
    await modal.getByRole('button', { name: 'Continuar com o Google', exact: true }).click();
    await expect(modal.getByRole('alert')).toContainText('cancelado');
    expect((await mockCalls(page)).filter(call => call.operation === 'signUp.redirect')).toHaveLength(1);
    await modal.getByRole('button', { name: 'Recuperar senha', exact: true }).click();
    await expect(modal.getByRole('heading', { name: 'Recuperar senha' })).toBeVisible();
    await expect(modal.getByRole('button', { name: 'Continuar com o Google', exact: true })).toHaveCount(0);
    await expect(modal.getByRole('form', { name: 'Formulário Clerk de acesso' })).toBeVisible();
    await noOverflow(page);
    await page.goto('/forgot-password');
    await expect(page.getByRole('heading', { name: 'Recuperar senha' })).toBeVisible();
    assertNoLegacyAuthority(fixture.requests, fixture.googleRequests);
  });

  for (const scenario of ['cancel', 'disabled'] as const) {
    test(`${scenario} social connection leaves a reusable signed-out login`, async ({ page }) => {
      const fixture = await browserFixture(page, { scenario });
      await page.goto('/login');
      const google = page.getByRole('button', { name: 'Continuar com o Google', exact: true });
      await google.click();
      await expect(page.getByRole('alert')).toContainText(scenario === 'cancel' ? 'cancelado' : 'não está disponível');
      await expect(google).toBeEnabled();
      await google.click();
      await expect.poll(async () => (await mockCalls(page)).filter(call => call.operation === 'signIn.redirect').length).toBe(2);
      expect(await state(page)).toMatchObject({ status: 'signed_out', userId: null, tokenReady: false, contextUserId: null });
      expect(fixture.requests.filter(request => ['/api/profile/', '/api/organizations/'].includes(request.path))).toEqual([]);
      await setScenario(page, 'success');
      await google.click();
      await expect(page).toHaveURL(/\/studio$/);
      await expect.poll(async () => (await state(page)).status).toBe('ready');
      expect((await state(page)).userId).toBe(47);
      assertNoLegacyAuthority(fixture.requests, fixture.googleRequests);
    });
  }

  test('callback completes OAuth once and waits for numeric profile plus memberships before ready', async ({ page }) => {
    let releaseProfile!: () => void;
    let releaseOrganizations!: () => void;
    const profileGate = new Promise<void>(resolve => { releaseProfile = resolve; });
    const organizationGate = new Promise<void>(resolve => { releaseOrganizations = resolve; });
    const fixture = await browserFixture(page, { profileGate, organizationGate });
    await page.goto('/login');
    await page.getByRole('button', { name: 'Continuar com o Google', exact: true }).click();
    await expect(page).toHaveURL(/\/studio$/);
    await expect.poll(() => fixture.requests.filter(request => request.path === '/api/profile/').length).toBe(1);
    expect(await state(page)).toMatchObject({ status: 'resolving_identity', userId: null, tokenReady: false, contextUserId: null });
    releaseProfile();
    await expect.poll(() => fixture.requests.filter(request => request.path === '/api/organizations/').length).toBe(1);
    expect(await state(page)).toMatchObject({ status: 'resolving_identity', userId: null, tokenReady: false, contextOrganizationId: null });
    releaseOrganizations();
    await expect.poll(async () => (await state(page)).status).toBe('ready');
    expect(await state(page)).toEqual({ status: 'ready', userId: 47, subject: 'user_google_browser_contract', organizationId: 23, tokenReady: true, contextUserId: 47, contextOrganizationId: 23 });
    await expect(page.getByRole('dialog', { name: 'Autenticação' })).toHaveCount(0);
    const calls = await mockCalls(page);
    expect(calls.filter(call => call.operation === 'signIn.redirect')).toEqual([{ operation: 'signIn.redirect', options: { strategy: 'oauth_google', redirectUrl: '/auth/callback', redirectUrlComplete: '/studio' } }]);
    expect(calls.filter(call => call.operation === 'callback')).toHaveLength(1);
    expect(fixture.requests.find(request => request.path === '/api/profile/')?.authorization).toBe('Bearer clerk-browser-session-token');
    expect(fixture.requests.find(request => request.path === '/api/organizations/')?.authorization).toBe('Bearer clerk-browser-session-token');
    expect(await page.evaluate(() => ({ access: localStorage.getItem('access_token'), refresh: localStorage.getItem('refresh_token') }))).toEqual({ access: null, refresh: null });
    assertNoLegacyAuthority(fixture.requests, fixture.googleRequests);
  });

  test('a swallowed callback failure keeps recovery available and shows a bounded notice', async ({ page }) => {
    const fixture = await browserFixture(page, { scenario: 'callback_error' });
    await page.goto('/auth/callback');
    const recoveryLink = page.getByRole('link', { name: 'Voltar para o acesso' });
    await expect(recoveryLink).toBeVisible();
    await expect(page.getByRole('status')).toHaveText('Concluindo seu acesso ao Catana…');
    await expect(page.getByRole('alert')).toHaveCount(0);
    await expect(page.getByRole('alert')).toHaveText('O acesso ainda não foi concluído. Você pode voltar e tentar novamente.', { timeout: 15000 });
    await expect(page).toHaveURL(/\/auth\/callback$/);
    expect((await mockCalls(page)).filter(call => call.operation === 'callback')).toHaveLength(1);
    expect(fixture.requests.filter(request => ['/api/profile/', '/api/organizations/'].includes(request.path))).toEqual([]);
    await recoveryLink.click();
    await expect(page.getByRole('button', { name: 'Continuar com o Google', exact: true })).toBeEnabled();
    await expect.poll(async () => (await state(page)).status).toBe('signed_out');
    assertNoLegacyAuthority(fixture.requests, fixture.googleRequests);
  });
});

test.describe('Explicit legacy authentication', () => {
  test('configured GIS stays on the legacy endpoint and resolves a real Catana profile', async ({ page }) => {
    const fixture = await browserFixture(page, { legacy: true });
    await page.route('https://accounts.google.com/gsi/client', route => route.fulfill({ contentType: 'application/javascript', body: `
      let credentialCallback;
      window.google = { accounts: { id: {
        initialize(config) { credentialCallback = config.callback; },
        renderButton(parent) {
          const button = document.createElement('button');
          button.type = 'button'; button.textContent = 'Continuar com o Google';
          button.style.cssText = 'width:100%;min-height:44px';
          button.onclick = () => credentialCallback({ credential: 'legacy-google-browser-credential' });
          parent.replaceChildren(button);
        },
        prompt() {}
      } } };
    ` }));
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/login');
    await page.getByRole('button', { name: 'Continuar com o Google', exact: true }).click();
    await expect.poll(async () => (await state(page)).status).toBe('ready');
    expect(await state(page)).toMatchObject({ userId: 47, subject: null, organizationId: 23, contextUserId: 47, contextOrganizationId: 23, tokenReady: true });
    expect(fixture.googleRequests).toContain('/gsi/client');
    expect(fixture.requests.filter(request => request.path === '/api/auth/google/')).toEqual([{ path: '/api/auth/google/', method: 'POST', authorization: undefined, body: { credential: 'legacy-google-browser-credential' } }]);
    expect(fixture.requests.find(request => request.path === '/api/profile/')?.authorization).toBe('Bearer legacy-browser-access');
    expect((await mockCalls(page)).filter(call => call.operation.includes('redirect') || call.operation === 'callback')).toEqual([]);
  });
});
