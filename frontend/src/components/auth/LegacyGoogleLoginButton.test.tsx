import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  mode: 'legacy' as 'clerk' | 'legacy' | 'none',
  info: vi.fn(),
  error: vi.fn(),
}));
vi.mock('../../services/authConfig', () => ({
  get authProviderMode() { return mocks.mode; },
}));
vi.mock('sonner', () => ({ toast: { info: mocks.info, error: mocks.error } }));

import { LegacyGoogleLoginButton } from './LegacyGoogleLoginButton';

let container: HTMLDivElement;
let root: Root;
const onSuccess = vi.fn();
const onError = vi.fn();
const initialize = vi.fn();
const renderButton = vi.fn();
const prompt = vi.fn();

function installGoogleSdk() {
  window.google = { accounts: { id: { initialize, renderButton, prompt } } };
}
function gisScripts() {
  return document.querySelectorAll<HTMLScriptElement>('script[src="https://accounts.google.com/gsi/client"]');
}
async function mount() {
  await act(async () => root.render(<LegacyGoogleLoginButton onSuccess={onSuccess} onError={onError} />));
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubEnv('VITE_GOOGLE_CLIENT_ID', '');
  vi.stubEnv('DEV', true);
  mocks.mode = 'legacy';
  window.google = undefined;
  window._catanaGsiInitialized = false;
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  gisScripts().forEach(script => script.remove());
  window.google = undefined;
  window._catanaGsiInitialized = false;
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

it.each([
  { mode: 'clerk', clientId: '' },
  { mode: 'clerk', clientId: 'legacy-client.apps.googleusercontent.com' },
  { mode: 'none', clientId: '' },
  { mode: 'none', clientId: 'legacy-client.apps.googleusercontent.com' },
] as const)('cannot mount a legacy Google flow in $mode mode with client="$clientId"', async ({ mode, clientId }) => {
  mocks.mode = mode;
  vi.stubEnv('VITE_GOOGLE_CLIENT_ID', clientId);
  installGoogleSdk();
  await mount();
  expect(container.childElementCount).toBe(0);
  expect(gisScripts()).toHaveLength(0);
  expect(initialize).not.toHaveBeenCalled();
  expect(renderButton).not.toHaveBeenCalled();
  expect(prompt).not.toHaveBeenCalled();
  expect(onSuccess).not.toHaveBeenCalled();
});

it('retains the explicit legacy development mock without downloading Google GIS', async () => {
  await mount();
  await act(async () => container.querySelector('button')?.click());
  expect(gisScripts()).toHaveLength(0);
  expect(onSuccess).toHaveBeenCalledExactlyOnceWith('mock-google-test-token');
  expect(mocks.info).toHaveBeenCalledTimes(1);
  expect(initialize).not.toHaveBeenCalled();
});

it('a missing production legacy Google client reports configuration failure without a fake credential', async () => {
  vi.stubEnv('DEV', false);
  await mount();
  await act(async () => container.querySelector('button')?.click());
  expect(gisScripts()).toHaveLength(0);
  expect(mocks.error).toHaveBeenCalledTimes(1);
  expect(onSuccess).not.toHaveBeenCalled();
  expect(initialize).not.toHaveBeenCalled();
});

it('loads Google GIS only for a configured legacy client and forwards its credential to the legacy callback', async () => {
  vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'legacy-client.apps.googleusercontent.com');
  await mount();
  expect(gisScripts()).toHaveLength(1);
  installGoogleSdk();
  await act(async () => gisScripts()[0].dispatchEvent(new Event('load')));
  expect(initialize).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
    client_id: 'legacy-client.apps.googleusercontent.com', auto_select: false,
    cancel_on_tap_outside: true, callback: expect.any(Function),
  }));
  expect(renderButton).toHaveBeenCalledTimes(1);
  const configuration = initialize.mock.calls[0][0] as { callback: (response: { credential?: string }) => void };
  configuration.callback({ credential: 'google-id-token' });
  expect(onSuccess).toHaveBeenCalledExactlyOnceWith('google-id-token');
  configuration.callback({});
  expect(onError).toHaveBeenCalledExactlyOnceWith('Nenhuma credencial retornada pelo Google.');
});

it('reuses an already loaded legacy Google SDK without downloading another script', async () => {
  vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'legacy-client.apps.googleusercontent.com');
  installGoogleSdk();
  await mount();
  expect(gisScripts()).toHaveLength(0);
  expect(initialize).toHaveBeenCalledTimes(1);
  expect(renderButton).toHaveBeenCalledTimes(1);
});

it('a GIS download failure stays a controlled legacy error and does not manufacture credentials', async () => {
  vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'legacy-client.apps.googleusercontent.com');
  await mount();
  await act(async () => gisScripts()[0].dispatchEvent(new Event('error')));
  expect(onError).toHaveBeenCalledExactlyOnceWith('Falha ao carregar o servico de autenticacao do Google.');
  expect(onSuccess).not.toHaveBeenCalled();
  expect(initialize).not.toHaveBeenCalled();
});

it('an unmounted legacy button does not accept a late GIS credential', async () => {
  vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'legacy-client.apps.googleusercontent.com');
  installGoogleSdk();
  await mount();
  const configuration = initialize.mock.calls[0][0] as { callback: (response: { credential?: string }) => void };
  await act(async () => root.render(null));
  configuration.callback({ credential: 'late-google-id-token' });
  expect(onSuccess).not.toHaveBeenCalled();
});
