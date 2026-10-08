/* eslint-disable react-refresh/only-export-components -- This test-only SDK boundary must export both components and hooks. */
import { type CSSProperties, type ReactNode, useSyncExternalStore } from 'react';

type Scenario = 'success' | 'cancel' | 'disabled' | 'callback_error';
type RedirectOptions = { strategy: string; redirectUrl: string; redirectUrlComplete: string };
type CallbackOptions = Record<string, string>;
type RecordedCall = { operation: string; options?: RedirectOptions | CallbackOptions };

const subject = sessionStorage.getItem('catana_clerk_mock_subject');
let snapshot = {
  isLoaded: true,
  isSignedIn: Boolean(subject),
  user: subject ? { id: subject } : null as { id: string } | null,
};
const listeners = new Set<() => void>();
function subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }
function useSnapshot() { return useSyncExternalStore(subscribe, () => snapshot); }
function record(operation: string, options?: RecordedCall['options']) {
  const calls = JSON.parse(sessionStorage.getItem('catana_clerk_mock_calls') || '[]') as RecordedCall[];
  calls.push({ operation, options });
  sessionStorage.setItem('catana_clerk_mock_calls', JSON.stringify(calls));
}
function providerError(code: string) { return { errors: [{ code }] }; }
function currentScenario(): Scenario { return (sessionStorage.getItem('catana_clerk_mock_scenario') || 'success') as Scenario; }
async function authenticateWithRedirect(operation: string, options: RedirectOptions) {
  record(operation, options);
  const scenario = currentScenario();
  if (scenario === 'cancel') throw providerError('oauth_access_denied');
  if (scenario === 'disabled') throw providerError('oauth_strategy_not_enabled');
  window.location.assign(options.redirectUrl);
}
const signIn = { authenticateWithRedirect: (options: RedirectOptions) => authenticateWithRedirect('signIn.redirect', options) };
const signUp = { authenticateWithRedirect: (options: RedirectOptions) => authenticateWithRedirect('signUp.redirect', options) };
const getToken = async () => { record('getToken'); return snapshot.isSignedIn ? 'clerk-browser-session-token' : null; };
async function completeRedirectCallback(options: CallbackOptions) {
  await Promise.resolve();
  if (currentScenario() === 'callback_error') throw providerError('oauth_access_denied');
  sessionStorage.setItem('catana_clerk_mock_subject', 'user_google_browser_contract');
  window.location.assign(options.signInForceRedirectUrl || '/studio');
}
const clerk = {
  async handleRedirectCallback(options: CallbackOptions) {
    record('callback', options);
    // Installed Clerk React 5.61.9 resolves this wrapper immediately and swallows
    // the underlying ClerkJS callback rejection; Catana cannot rely on .catch().
    void completeRedirectCallback(options).catch(() => {});
  },
  async signOut() {
    sessionStorage.removeItem('catana_clerk_mock_subject');
    snapshot = { isLoaded: true, isSignedIn: false, user: null };
    listeners.forEach(listener => listener());
  },
};

// Controls exist only in this explicitly aliased fixture, never in production modules.
declare global {
  interface Window {
    __catanaClerkSdkMock: {
      setScenario: (scenario: Scenario) => void;
      setLoaded: (loaded: boolean) => void;
      calls: () => RecordedCall[];
    };
  }
}
window.__catanaClerkSdkMock = {
  setScenario(scenario) { sessionStorage.setItem('catana_clerk_mock_scenario', scenario); },
  setLoaded(isLoaded) { snapshot = { ...snapshot, isLoaded }; listeners.forEach(listener => listener()); },
  calls() { return JSON.parse(sessionStorage.getItem('catana_clerk_mock_calls') || '[]'); },
};
(window as unknown as { Clerk: typeof clerk }).Clerk = clerk;

export function ClerkProvider({ children }: { children: ReactNode }) { return <>{children}</>; }
export function useUser() { return useSnapshot(); }
export function useAuth() { return { ...useSnapshot(), getToken }; }
export function useSignIn() { return { isLoaded: useSnapshot().isLoaded, signIn }; }
export function useSignUp() { return { isLoaded: useSnapshot().isLoaded, signUp }; }
export function useClerk() { return clerk; }

type WidgetProps = { appearance?: { elements?: Record<string, string | CSSProperties> } };
// Exercise the observed SDK CSS boundary, not hosted-form internals or real OAuth.
// ClerkJS 5.128.0's inspected source uses fit-content root, a $100-size card,
// overflow clipping and an unlayered flex social root. Tailwind utilities alone
// cannot override unlayered SDK defaults. Do not simplify this into a native form.
function CredentialForm({ register = false, appearance }: WidgetProps & { register?: boolean }) {
  const element = (name: string, base: string) => {
    const override = appearance?.elements?.[name];
    return { className: `${base} ${typeof override === 'string' ? override : ''}`, style: typeof override === 'object' ? override : undefined };
  };
  return <>
    <style>{`.cl-fixture-root { width:fit-content; } .cl-fixture-card { width:400px; max-width:calc(100vw - 40px); overflow:hidden; } .cl-fixture-social { display:flex; }`}</style>
    <div {...element('rootBox', 'cl-rootBox cl-fixture-root')}>
    <div {...element('cardBox', 'cl-cardBox cl-fixture-card')}>
    <div {...element('card', 'cl-card')}>
    <header {...element('header', 'cl-header')}>Clerk sign in</header>
    <div {...element('socialButtonsRoot', 'cl-socialButtonsRoot cl-fixture-social')}>
      <button type="button" className="cl-socialButtonsBlockButton" onClick={() => void authenticateWithRedirect(register ? 'signUp.redirect' : 'signIn.redirect', { strategy: 'oauth_google', redirectUrl: '/auth/callback', redirectUrlComplete: '/studio' })}>Continuar com o Google</button>
    </div>
    <div {...element('dividerRow', 'cl-dividerRow')}>ou</div>
    <form aria-label={register ? 'Formulário Clerk de cadastro' : 'Formulário Clerk de acesso'} className="space-y-3" onSubmit={event => event.preventDefault()}>
    <label className="block text-sm">E-mail<input className="cl-formFieldInput block w-full min-w-0 min-h-11 rounded-xl border p-3" type="email" autoComplete="email" /></label>
    <label className="block text-sm">Senha<input className="cl-formFieldInput block w-full min-w-0 min-h-11 rounded-xl border p-3" type="password" autoComplete={register ? 'new-password' : 'current-password'} /></label>
    <button type="submit" className="cl-formButtonPrimary w-full min-h-11 rounded-xl border">{register ? 'Criar conta com e-mail' : 'Entrar com e-mail'}</button>
    {!register && <button type="button" className="min-h-11">Esqueci minha senha</button>}
    </form>
    <footer {...element('footer', 'cl-footer')}>Secured by Clerk</footer>
    </div></div></div>
  </>;
}
export function SignIn(props: WidgetProps) { return <CredentialForm {...props} />; }
export function SignUp(props: WidgetProps) { return <CredentialForm {...props} register />; }
