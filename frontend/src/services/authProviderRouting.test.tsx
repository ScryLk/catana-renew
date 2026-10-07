import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  mode: 'clerk' as 'clerk' | 'legacy' | 'none',
  configured: true,
  view: 'login' as 'login' | 'register' | 'forgot-password',
  login: vi.fn(),
  googleLogin: vi.fn(),
  register: vi.fn(),
  requestPasswordReset: vi.fn(),
  confirmPasswordReset: vi.fn(),
  clearError: vi.fn(),
  openAuthModal: vi.fn(),
  closeAuthModal: vi.fn(),
  authenticateWithRedirect: vi.fn(),
}));

vi.mock('./authConfig', () => ({
  get authProviderMode() { return mocks.mode; },
  get isClerkConfigured() { return mocks.mode === 'clerk' && mocks.configured; },
  clerkPublishableKey: 'pk_test_configured',
}));
vi.mock('../store/authStore', () => {
  const state = {
    login: mocks.login,
    googleLogin: mocks.googleLogin,
    register: mocks.register,
    requestPasswordReset: mocks.requestPasswordReset,
    confirmPasswordReset: mocks.confirmPasswordReset,
    clearError: mocks.clearError,
    openAuthModal: mocks.openAuthModal,
    closeAuthModal: mocks.closeAuthModal,
    isLoading: false,
    isAuthenticated: false,
    error: null,
    get authModalView() { return mocks.view; },
    authStatus: 'signed_out',
  };
  return {
    useAuthStore: Object.assign(
      (selector?: (value: typeof state) => unknown) => selector ? selector(state) : state,
      { getState: () => state },
    ),
    isAuthReady: () => false,
  };
});
vi.mock('../store/studioStore', () => ({
  useStudioStore: (selector?: (value: { theme: string }) => unknown) =>
    selector ? selector({ theme: 'light' }) : { theme: 'light' },
}));
vi.mock('../components/auth/MultiAgentShowcase', () => ({ MultiAgentShowcase: () => null }));
vi.mock('@clerk/clerk-react', () => ({
  SignIn: () => <div data-clerk-widget="sign-in">Clerk sign in</div>,
  SignUp: () => <div data-clerk-widget="sign-up">Clerk sign up</div>,
  useSignIn: () => ({ isLoaded: true, signIn: { authenticateWithRedirect: mocks.authenticateWithRedirect } }),
  useSignUp: () => ({ isLoaded: true, signUp: { authenticateWithRedirect: mocks.authenticateWithRedirect } }),
  useAuth: () => ({ isLoaded: true, isSignedIn: false }),
}));

import { AuthModal } from '../components/auth/AuthModal';
import { Login } from '../pages/Login';
import { Register } from '../pages/Register';
import { ResetPassword } from '../pages/ResetPassword';

let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  mocks.mode = 'clerk';
  mocks.configured = true;
  mocks.view = 'login';
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  document.querySelectorAll('script[src*="accounts.google.com/gsi/client"]').forEach(script => script.remove());
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

it('Clerk AuthModal shows Clerk authentication without a legacy form or standalone Google GIS', async () => {
  await act(async () => root.render(<MemoryRouter><AuthModal isOpen /></MemoryRouter>));
  expect(document.querySelector('script[src*="accounts.google.com/gsi/client"]')).toBeNull();
  expect(document.body.querySelector('[data-clerk-widget="sign-in"]')).not.toBeNull();
  expect(document.body.querySelector('input[name="username"], input#auth-username')).toBeNull();
  expect(mocks.login).not.toHaveBeenCalled();
  expect(mocks.googleLogin).not.toHaveBeenCalled();
});

const entryPoints = [
  { name: 'login modal', view: 'login', render: () => <AuthModal isOpen />, widget: 'sign-in', legacyInput: '#auth-username' },
  { name: 'registration modal', view: 'register', render: () => <AuthModal isOpen />, widget: 'sign-up', legacyInput: '#name, #fullName, input[type="email"]' },
  { name: 'recovery modal', view: 'forgot-password', render: () => <AuthModal isOpen />, widget: 'sign-in', legacyInput: 'input[type="email"]' },
  { name: 'login page', view: 'login', render: () => <Login />, widget: 'sign-in', legacyInput: '#username' },
  { name: 'registration page', view: 'register', render: () => <Register />, widget: 'sign-up', legacyInput: '#fullName' },
  { name: 'reset page', view: 'forgot-password', render: () => <ResetPassword />, widget: 'sign-in', legacyInput: '#new-password' },
] as const;

it.each(entryPoints)('$name selects the Clerk authority without legacy credential fields or calls', async ({ view, render, widget }) => {
  mocks.view = view;
  vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'legacy-google-client.apps.googleusercontent.com');
  await act(async () => root.render(<MemoryRouter initialEntries={['/reset-password?uid=legacy-user&token=legacy-token']}>{render()}</MemoryRouter>));
  expect(document.body.querySelector('[data-auth-provider="clerk"]')).not.toBeNull();
  expect(document.body.querySelector(`[data-clerk-widget="${widget}"]`)).not.toBeNull();
  expect(document.body.querySelector('input')).toBeNull();
  expect(document.querySelector('script[src*="accounts.google.com/gsi/client"]')).toBeNull();
  for (const method of [mocks.login, mocks.googleLogin, mocks.register, mocks.requestPasswordReset, mocks.confirmPasswordReset]) {
    expect(method).not.toHaveBeenCalled();
  }
});

it.each(entryPoints)('$name keeps its existing legacy form under an explicit legacy provider', async ({ view, render, legacyInput }) => {
  mocks.mode = 'legacy';
  mocks.view = view;
  await act(async () => root.render(<MemoryRouter initialEntries={['/reset-password?uid=legacy-user&token=legacy-token']}>{render()}</MemoryRouter>));
  expect(document.body.querySelector('[data-auth-provider="clerk"]')).toBeNull();
  expect(document.body.querySelector(legacyInput)).not.toBeNull();
  expect(mocks.authenticateWithRedirect).not.toHaveBeenCalled();
});

it.each(entryPoints)('$name reports unavailable Clerk configuration without crossing into legacy auth', async ({ view, render }) => {
  mocks.view = view;
  mocks.configured = false;
  await act(async () => root.render(<MemoryRouter>{render()}</MemoryRouter>));
  expect(document.body.textContent).toMatch(/Clerk|configura/i);
  expect(document.body.querySelector('[data-clerk-widget]')).toBeNull();
  expect(document.body.querySelector('input')).toBeNull();
  expect(document.querySelector('script[src*="accounts.google.com/gsi/client"]')).toBeNull();
  expect(mocks.googleLogin).not.toHaveBeenCalled();
});

it.each(entryPoints)('$name refuses an invalid provider configuration without a legacy fallback', async ({ view, render }) => {
  mocks.view = view;
  mocks.mode = 'none';
  await act(async () => root.render(<MemoryRouter>{render()}</MemoryRouter>));
  expect(document.body.querySelector('input')).toBeNull();
  expect(document.body.querySelector('[data-clerk-widget]')).toBeNull();
  expect(document.querySelector('script[src*="accounts.google.com/gsi/client"]')).toBeNull();
  expect(mocks.googleLogin).not.toHaveBeenCalled();
});

describe('deterministic configuration selection', () => {
  it.each([
    { explicit: 'clerk', clerkKey: 'pk_test_configured', google: 'legacy-client', mode: 'clerk', configured: true },
    { explicit: 'legacy', clerkKey: 'pk_test_configured', google: 'legacy-client', mode: 'legacy', configured: false },
    { explicit: 'clerk', clerkKey: '', google: 'legacy-client', mode: 'clerk', configured: false },
    { explicit: 'clerk', clerkKey: 'pk_test_placeholder', google: 'legacy-client', mode: 'clerk', configured: false },
    { explicit: 'misspelled-provider', clerkKey: 'pk_test_configured', google: 'legacy-client', mode: 'none', configured: false },
    { explicit: '', clerkKey: 'pk_test_configured', google: 'legacy-client', mode: 'clerk', configured: true },
    { explicit: '', clerkKey: '', google: 'legacy-client', mode: 'legacy', configured: false },
    { explicit: '', clerkKey: '', google: '', mode: 'legacy', configured: false },
  ])('selects $mode for explicit="$explicit", Clerk key="$clerkKey", Google client="$google"', async ({ explicit, clerkKey, google, mode, configured }) => {
    vi.stubEnv('VITE_AUTH_PROVIDER', explicit);
    vi.stubEnv('VITE_CLERK_PUBLISHABLE_KEY', clerkKey);
    vi.stubEnv('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', '');
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', google);
    vi.resetModules();
    const config = await vi.importActual<typeof import('./authConfig')>('./authConfig');
    expect(config.authProviderMode).toBe(mode);
    expect(config.isClerkConfigured).toBe(configured);
  });

  it('accepts the supported NEXT_PUBLIC Clerk key without depending on a Google client', async () => {
    vi.stubEnv('VITE_AUTH_PROVIDER', 'clerk');
    vi.stubEnv('VITE_CLERK_PUBLISHABLE_KEY', '');
    vi.stubEnv('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'pk_live_configured');
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', '');
    vi.resetModules();
    const config = await vi.importActual<typeof import('./authConfig')>('./authConfig');
    expect(config.authProviderMode).toBe('clerk');
    expect(config.isClerkConfigured).toBe(true);
  });
});
