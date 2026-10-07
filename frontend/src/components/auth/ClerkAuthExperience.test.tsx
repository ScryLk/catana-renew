import { StrictMode, act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import axios from 'axios';

const sdk = vi.hoisted(() => ({
  signIn: vi.fn(), signUp: vi.fn(), callback: vi.fn(), token: vi.fn(),
  user: null as { id: string } | null,
  configured: true,
}));
vi.mock('../../services/authConfig', () => ({
  authProviderMode: 'clerk', clerkPublishableKey: 'pk_test_configured',
  get isClerkConfigured() { return sdk.configured; },
}));
vi.mock('@clerk/clerk-react', () => ({
  useSignIn: () => ({ isLoaded: true, signIn: { authenticateWithRedirect: sdk.signIn } }),
  useSignUp: () => ({ isLoaded: true, signUp: { authenticateWithRedirect: sdk.signUp } }),
  useUser: () => ({ isLoaded: true, isSignedIn: !!sdk.user, user: sdk.user }),
  useAuth: () => ({ getToken: sdk.token }),
  useClerk: () => ({ handleRedirectCallback: sdk.callback }),
  SignIn: (props: { routing: string; forceRedirectUrl: string; oauthFlow: string }) =>
    <div data-widget="sign-in" data-routing={props.routing} data-complete={props.forceRedirectUrl} data-oauth={props.oauthFlow}>Password and recovery</div>,
  SignUp: (props: { routing: string; forceRedirectUrl: string }) =>
    <div data-widget="sign-up" data-routing={props.routing} data-complete={props.forceRedirectUrl}>Clerk registration</div>,
}));
vi.mock('axios', async () => {
  const actual = await vi.importActual<typeof import('axios')>('axios');
  return { ...actual, default: { ...actual.default, get: vi.fn(), post: vi.fn() } };
});
vi.mock('./MultiAgentShowcase', () => ({ MultiAgentShowcase: () => null }));
import { ClerkAuthExperience, ClerkGoogleAuthButton, ClerkAuthModal } from './ClerkAuthExperience';
import { ClerkAuthCallback } from './ClerkAuthCallback';
import { ClerkAuthSync } from './ClerkAuthSync';
import { useAuthStore, isAuthReady } from '../../store/authStore';

let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  vi.clearAllMocks();
  sdk.user = null; sdk.configured = true;
  sdk.signIn.mockResolvedValue(undefined); sdk.signUp.mockResolvedValue(undefined);
  sdk.callback.mockResolvedValue(undefined); sdk.token.mockResolvedValue('sdk-test-jwt');
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} unobserve() {} });
  localStorage.clear();
  useAuthStore.getState().setClerkAuthSettled();
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals(); });
function button(label = 'Continuar com o Google') {
  const found = [...document.querySelectorAll('button')].find(item => item.textContent?.trim() === label);
  if (!found) throw new Error(`Button missing: ${label}`);
  return found;
}

it('starts Google through the installed Clerk redirect API for both login and signup', async () => {
  await act(async () => root.render(<ClerkGoogleAuthButton />));
  await act(async () => button().click());
  expect(sdk.signIn).toHaveBeenCalledWith({ strategy: 'oauth_google', redirectUrl: '/auth/callback', redirectUrlComplete: '/studio' });
  await act(async () => root.render(<ClerkGoogleAuthButton view="register" />));
  await act(async () => button().click());
  expect(sdk.signUp).toHaveBeenCalledWith({ strategy: 'oauth_google', redirectUrl: '/auth/callback', redirectUrlComplete: '/studio' });
  expect(axios.post).not.toHaveBeenCalled();
  expect(localStorage.getItem('access_token')).toBeNull();
});

it('blocks parallel OAuth attempts and keeps the modal open until backend identity is ready', async () => {
  let complete!: () => void;
  sdk.signIn.mockReturnValue(new Promise<void>(resolve => { complete = resolve; }));
  const close = vi.fn();
  await act(async () => root.render(<ClerkAuthModal isOpen onClose={close} canDismiss={false} />));
  await act(async () => { button().click(); button().click(); });
  expect(sdk.signIn).toHaveBeenCalledTimes(1);
  expect(button().disabled).toBe(true);
  await act(async () => { complete(); });
  expect(close).not.toHaveBeenCalled();
  expect(isAuthReady(useAuthStore.getState())).toBe(false);
});

it.each([
  ['oauth_access_denied', 'cancelado'],
  ['oauth_strategy_not_enabled', 'não está disponível'],
  ['unexpected_provider_failure', 'Não foi possível'],
])('shows a safe usable error for %s without a legacy fallback', async (code, text) => {
  sdk.signIn.mockRejectedValue({ errors: [{ code, message: 'SECRET-TOKEN provider payload' }] });
  const log = vi.spyOn(console, 'log'); const errorLog = vi.spyOn(console, 'error');
  await act(async () => root.render(<ClerkGoogleAuthButton />));
  await act(async () => button().click());
  expect(document.querySelector('[role="alert"]')?.textContent).toContain(text);
  expect(document.body.textContent).not.toContain('SECRET-TOKEN');
  expect(button().disabled).toBe(false);
  expect(axios.post).not.toHaveBeenCalled();
  expect(localStorage.getItem('access_token')).toBeNull();
  expect(log).not.toHaveBeenCalled(); expect(errorLog).not.toHaveBeenCalled();
  log.mockRestore(); errorLog.mockRestore();
});

it('Google success enters only ClerkAuthSync and waits for real profile and memberships', async () => {
  let release!: () => void;
  const memberships = new Promise<{ data: { id: number; name: string }[] }>(resolve => {
    release = () => resolve({ data: [{ id: 5, name: 'Verified workspace' }] });
  });
  vi.mocked(axios.get).mockImplementation(async url => String(url).endsWith('/profile/')
    ? { data: { id: 27, username: 'qa', email: 'qa@example.test' } } : memberships);
  await act(async () => root.render(<><ClerkAuthSync /><ClerkAuthExperience /></>));
  await act(async () => button().click());
  expect(axios.get).not.toHaveBeenCalled();
  sdk.user = { id: 'user_google_clerk' };
  await act(async () => root.render(<><ClerkAuthSync /><ClerkAuthExperience /></>));
  expect(isAuthReady(useAuthStore.getState())).toBe(false);
  await act(async () => release());
  expect(useAuthStore.getState().user).toMatchObject({ id: 27, externalAuthId: 'user_google_clerk' });
  expect(useAuthStore.getState().activeOrganizationId).toBe(5);
  expect(isAuthReady(useAuthStore.getState())).toBe(true);
  expect(axios.post).not.toHaveBeenCalled();
  expect(localStorage.getItem('access_token')).toBeNull();
});

it('delegates password, verification, registration and recovery to Clerk widgets', async () => {
  await act(async () => root.render(<ClerkAuthExperience />));
  expect(container.querySelector('[data-widget="sign-in"]')?.getAttribute('data-oauth')).toBe('redirect');
  await act(async () => button('Criar conta').click());
  expect(container.querySelector('[data-widget="sign-up"]')?.getAttribute('data-routing')).toBe('virtual');
  await act(async () => button('Recuperar senha').click());
  expect(container.querySelector('[data-widget="sign-in"]')).not.toBeNull();
  expect(container.querySelector('#clerk-captcha')).not.toBeNull();
  expect(axios.post).not.toHaveBeenCalled();
});

it('missing Clerk configuration shows a controlled error without mounting authentication', async () => {
  sdk.configured = false;
  await act(async () => root.render(<ClerkAuthExperience />));
  expect(container.querySelector('[role="alert"]')?.textContent).toContain('indisponível');
  expect(container.querySelector('[data-widget]')).toBeNull();
  expect(sdk.signIn).not.toHaveBeenCalled();
});

it('completes the callback once under StrictMode and handles cancellation without raw URL errors', async () => {
  sdk.callback.mockRejectedValue({ errors: [{ code: 'oauth_access_denied', message: 'SECRET-TOKEN' }] });
  await act(async () => root.render(<StrictMode><ClerkAuthCallback /></StrictMode>));
  expect(sdk.callback).toHaveBeenCalledTimes(1);
  expect(sdk.callback).toHaveBeenCalledWith(expect.objectContaining({ signInUrl: '/login', signUpUrl: '/register', signInForceRedirectUrl: '/studio' }));
  expect(container.querySelector('[role="alert"]')?.textContent).toContain('cancelado');
  expect(container.textContent).not.toContain('SECRET-TOKEN');
  expect(container.querySelector('a')?.getAttribute('href')).toBe('/login');
  expect(axios.post).not.toHaveBeenCalled();
});
