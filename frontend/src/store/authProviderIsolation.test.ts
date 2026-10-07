import axios from 'axios';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  mode: 'legacy' as 'clerk' | 'legacy' | 'none',
  resetStudioState: vi.fn(),
  setActiveUserId: vi.fn(),
  signOut: vi.fn(),
}));
vi.mock('../services/authConfig', () => ({
  get authProviderMode() { return mocks.mode; },
  get isClerkConfigured() { return mocks.mode === 'clerk'; },
}));
vi.mock('./studioStore', () => ({
  useStudioStore: {
    getState: () => ({ resetStudioState: mocks.resetStudioState, setActiveUserId: mocks.setActiveUserId }),
  },
}));
vi.mock('axios', async () => {
  const actual = await vi.importActual<typeof import('axios')>('axios');
  return { ...actual, default: { ...actual.default, get: vi.fn(), post: vi.fn() } };
});

import { useAuthStore } from './authStore';
import { clearAuthRuntime, configureAuthProvider, getAuthProvider, setTokenReady } from '../services/authTokenProvider';

const credentials = { username: 'person@example.test', password: 'test-password' };
const resetPayload = { uid: 'legacy-id', token: 'legacy-reset-token', new_password: 'new-test-password' };
const identity = { id: 27, name: 'Real user', email: 'person@example.test', externalAuthId: 'user_clerk_27' };

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  clearAuthRuntime();
  mocks.mode = 'legacy';
  mocks.signOut.mockResolvedValue(undefined);
  Object.assign(window, { Clerk: { signOut: mocks.signOut } });
  useAuthStore.setState({
    user: null, token: null, isAuthenticated: false, authStatus: 'signed_out',
    authProvider: 'legacy', activeOrganizationId: null, error: null,
    isLoading: false, isAuthModalOpen: false,
  });
  vi.mocked(axios.get).mockImplementation(async url => ({ data:
    String(url).endsWith('/profile/')
      ? { id: 27, username: 'person', email: identity.email }
      : [{ id: 2, name: 'Authorized organization' }],
  }));
  vi.mocked(axios.post).mockResolvedValue({ data: { access: 'legacy-test-access', message: 'Recovery accepted' } });
});
afterEach(() => {
  clearAuthRuntime();
  Object.assign(window, { Clerk: undefined });
});

const legacyMutations = [
  { name: 'password login', run: () => useAuthStore.getState().login(credentials) },
  { name: 'Google credential login', run: () => useAuthStore.getState().googleLogin('google-id-token') },
  { name: 'registration', run: () => useAuthStore.getState().register({ ...credentials, email: identity.email }) },
  { name: 'password recovery request', run: () => useAuthStore.getState().requestPasswordReset(identity.email) },
  { name: 'password reset confirmation', run: () => useAuthStore.getState().confirmPasswordReset(resetPayload) },
];

it.each(['clerk', 'none'] as const)('%s rejects every direct legacy credential mutation before HTTP or workspace reset', async mode => {
  mocks.mode = mode;
  useAuthStore.setState({ user: identity, token: 'sdk-access', isAuthenticated: true, authStatus: 'ready', authProvider: mode, activeOrganizationId: 2 });
  configureAuthProvider(mode, mode === 'clerk' ? async () => 'sdk-access' : undefined, identity.externalAuthId);
  setTokenReady(true);
  for (const mutation of legacyMutations) {
    await expect(mutation.run(), mutation.name).rejects.toThrow();
  }
  expect(axios.post).not.toHaveBeenCalled();
  expect(axios.get).not.toHaveBeenCalled();
  expect(mocks.resetStudioState).not.toHaveBeenCalled();
  expect(useAuthStore.getState().user).toEqual(identity);
  expect(useAuthStore.getState().activeOrganizationId).toBe(2);
  expect(getAuthProvider()).toBe(mode);
});

it.each([
  { name: 'password login', path: '/api/auth/token/', payload: credentials, run: () => useAuthStore.getState().login(credentials) },
  { name: 'Google login', path: '/api/auth/google/', payload: { credential: 'google-id-token' }, run: () => useAuthStore.getState().googleLogin('google-id-token') },
  { name: 'registration', path: '/api/register/', payload: { ...credentials, email: identity.email }, run: () => useAuthStore.getState().register({ ...credentials, email: identity.email }) },
])('explicit legacy $name keeps its API contract and resolves real profile/membership', async ({ path, payload, run }) => {
  await run();
  expect(axios.post).toHaveBeenCalledWith(expect.stringContaining(path), payload, { withCredentials: true });
  expect(axios.get).toHaveBeenCalledTimes(2);
  expect(useAuthStore.getState().user?.id).toBe(27);
  expect(useAuthStore.getState().authStatus).toBe('ready');
  expect(useAuthStore.getState().activeOrganizationId).toBe(2);
  expect(getAuthProvider()).toBe('legacy');
  expect(localStorage.getItem('access_token')).toBe('legacy-test-access');
  expect(mocks.signOut).not.toHaveBeenCalled();
});

it('explicit legacy recovery request and confirmation retain their payloads', async () => {
  await expect(useAuthStore.getState().requestPasswordReset(identity.email)).resolves.toEqual(expect.objectContaining({ message: 'Recovery accepted' }));
  await expect(useAuthStore.getState().confirmPasswordReset(resetPayload)).resolves.toEqual(expect.objectContaining({ message: 'Recovery accepted' }));
  expect(axios.post).toHaveBeenNthCalledWith(1, expect.stringContaining('/api/auth/password-reset/'), { email: identity.email });
  expect(axios.post).toHaveBeenNthCalledWith(2, expect.stringContaining('/api/auth/password-reset/confirm/'), resetPayload);
  expect(mocks.signOut).not.toHaveBeenCalled();
});

it('Clerk logout signs out through its SDK and clears Catana runtime without legacy logout HTTP', async () => {
  mocks.mode = 'clerk';
  configureAuthProvider('clerk', async () => 'sdk-access', identity.externalAuthId);
  setTokenReady(true);
  useAuthStore.setState({ user: identity, token: 'sdk-access', isAuthenticated: true, authStatus: 'ready', authProvider: 'clerk', activeOrganizationId: 2 });
  await useAuthStore.getState().logout();
  expect(mocks.signOut).toHaveBeenCalledTimes(1);
  expect(axios.post).not.toHaveBeenCalled();
  expect(useAuthStore.getState().user).toBeNull();
  expect(useAuthStore.getState().isAuthenticated).toBe(false);
  expect(useAuthStore.getState().activeOrganizationId).toBeNull();
  expect(useAuthStore.getState().authStatus).toBe('signed_out');
});

it.each(['missing', 'rejected'] as const)('Clerk logout with a %s SDK exposes recovery without legacy fallback', async failure => {
  mocks.mode = 'clerk';
  useAuthStore.setState({ authProvider: 'clerk', authStatus: 'ready', user: identity, isAuthenticated: true });
  if (failure === 'missing') Object.assign(window, { Clerk: undefined });
  else mocks.signOut.mockRejectedValue(new Error('provider unavailable'));
  await useAuthStore.getState().logout();
  expect(axios.post).not.toHaveBeenCalled();
  expect(useAuthStore.getState().authStatus).toBe('error');
  expect(useAuthStore.getState().error).toMatch(/sessão/);
});

it('legacy logout keeps the cookie-based API contract and does not sign out Clerk', async () => {
  await useAuthStore.getState().logout();
  expect(axios.post).toHaveBeenCalledWith(expect.stringContaining('/api/auth/logout/'), {}, { withCredentials: true });
  expect(mocks.signOut).not.toHaveBeenCalled();
});

it('a configured Clerk app cannot run legacy logout even if an obsolete state field names legacy', async () => {
  mocks.mode = 'clerk';
  useAuthStore.setState({ authProvider: 'legacy', authStatus: 'ready', user: identity, isAuthenticated: true });
  await useAuthStore.getState().logout();
  expect(axios.post).not.toHaveBeenCalled();
  expect(mocks.signOut).toHaveBeenCalledTimes(1);
});

it('an invalid provider never falls back to legacy logout', async () => {
  mocks.mode = 'none';
  useAuthStore.setState({ authProvider: 'none' });
  await useAuthStore.getState().logout();
  expect(axios.post).not.toHaveBeenCalled();
  expect(mocks.signOut).not.toHaveBeenCalled();
});
