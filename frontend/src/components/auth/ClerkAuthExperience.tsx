import { socialAuthError } from './socialAuthError';
import { useEffect, useRef, useState } from 'react';
import { SignIn, SignUp, useSignIn, useSignUp } from '@clerk/clerk-react';
import { dark } from '@clerk/themes';
import { Loader2, X } from 'lucide-react';
import { authProviderMode, isClerkConfigured } from '../../services/authConfig';
import { isAuthReady, useAuthStore } from '../../store/authStore';
import { useStudioStore } from '../../store/studioStore';
import { ResponsiveModal } from '../mobile/ResponsiveModal';
import { MultiAgentShowcase } from './MultiAgentShowcase';
import './clerk-auth.css';

export type AuthView = 'login' | 'register' | 'forgot-password';

export function ClerkGoogleAuthButton({ view = 'login' }: { view?: AuthView }) {
  const signInState = useSignIn();
  const signUpState = useSignUp();
  const inFlight = useRef(false);
  const mounted = useRef(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const loaded = view === 'register' ? signUpState.isLoaded : signInState.isLoaded;

  const start = async () => {
    if (inFlight.current || !loaded) return;
    const resource = view === 'register' ? signUpState.signUp : signInState.signIn;
    if (!resource) return;
    inFlight.current = true;
    setPending(true);
    setError(null);
    try {
      await resource.authenticateWithRedirect({
        strategy: 'oauth_google',
        redirectUrl: '/auth/callback',
        redirectUrlComplete: '/studio',
      });
      // The SDK navigates away. Catana readiness is resolved solely by ClerkAuthSync.
    } catch (failure) {
      if (mounted.current) setError(socialAuthError(failure));
    } finally {
      inFlight.current = false;
      if (mounted.current) setPending(false);
    }
  };

  return <div className="space-y-3">
    <button type="button" disabled={!loaded || pending} onClick={() => void start()}
      className="w-full min-h-11 px-4 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 text-sm font-medium flex items-center justify-center gap-3 disabled:opacity-50">
      {pending && <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />}
      Continuar com o Google
    </button>
    {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
  </div>;
}

function ConfiguredClerkAuthExperience({ view }: { view: AuthView }) {
  const theme = useStudioStore(state => state.theme);
  const status = useAuthStore(state => state.authStatus);
  const [activeView, setActiveView] = useState(view);
  useEffect(() => setActiveView(view), [view]);
  const appearance = {
    ...(theme === 'dark' ? { baseTheme: dark } : { baseTheme: undefined }),
    variables: {
      colorPrimary: theme === 'dark' ? '#C5A880' : '#18181b',
      colorBackground: theme === 'dark' ? '#131316' : '#ffffff',
      colorText: theme === 'dark' ? '#f4f4f5' : '#18181b',
      colorInputBackground: theme === 'dark' ? '#27272a' : '#fafafa',
      colorInputText: theme === 'dark' ? '#f4f4f5' : '#18181b',
    },
    elements: {
      rootBox: 'w-full min-w-0',
      cardBox: 'w-full min-w-0 shadow-none',
      card: 'w-full min-w-0 bg-transparent shadow-none border-0 p-0',
      header: 'hidden',
      socialButtonsRoot: 'hidden',
      dividerRow: 'hidden',
      footer: 'hidden',
      formButtonPrimary: 'min-h-11 rounded-xl',
      formFieldInput: 'min-h-11 rounded-xl',
    },
  };
  return <section data-auth-provider="clerk" className="min-w-0 space-y-5">
    <header className="text-center space-y-2">
      <h2 className="text-xl font-bold">{activeView === 'register' ? 'Criar sua conta' : activeView === 'forgot-password' ? 'Recuperar senha' : 'Bem-vindo(a)'}</h2>
      <p className="text-sm text-muted-foreground">{activeView === 'forgot-password'
        ? 'Informe seu e-mail e use a opção de recuperação de senha no formulário abaixo.'
        : 'Continue para acessar seu espaço de trabalho Catana.'}</p>
    </header>
    {status === 'loading' || status === 'resolving_identity' ?
      <p role="status" className="text-sm">Verificando sua conta e suas organizações…</p> : <>
      {activeView !== 'forgot-password' && <ClerkGoogleAuthButton view={activeView} />}
      {activeView === 'register' ? <SignUp routing="virtual" appearance={appearance}
        forceRedirectUrl="/studio" signInUrl="/login" /> :
        <SignIn routing="virtual" appearance={appearance} forceRedirectUrl="/studio"
          signUpUrl="/register" oauthFlow="redirect" />}
      <div id="clerk-captcha" />
      <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 text-sm">
        {activeView !== 'login' && <button type="button" onClick={() => setActiveView('login')} className="min-h-11 underline">Entrar</button>}
        {activeView !== 'register' && <button type="button" onClick={() => setActiveView('register')} className="min-h-11 underline">Criar conta</button>}
        {activeView !== 'forgot-password' && <button type="button" onClick={() => setActiveView('forgot-password')} className="min-h-11 underline">Recuperar senha</button>}
      </div>
    </>}
  </section>;
}

export function ClerkAuthExperience({ view = 'login' }: { view?: AuthView }) {
  if (authProviderMode !== 'clerk' || !isClerkConfigured)
    return <p role="alert" className="text-sm">O acesso está indisponível. Contate o suporte para verificar a configuração de autenticação.</p>;
  return <ConfiguredClerkAuthExperience view={view} />;
}

export function ClerkAuthModal({ isOpen, onClose, canDismiss = true }: {
  isOpen: boolean; onClose?: () => void; canDismiss?: boolean;
}) {
  const view = useAuthStore(state => state.authModalView);
  const status = useAuthStore(state => state.authStatus);
  const theme = useStudioStore(state => state.theme);
  const ready = isAuthReady({ authStatus: status });
  const wasOpen = useRef(false);
  useEffect(() => {
    if (ready && wasOpen.current) onClose?.();
    wasOpen.current = isOpen;
  }, [isOpen, ready, onClose]);
  if (!isOpen) return null;
  const dismiss = () => {
    if (!canDismiss) return;
    useAuthStore.getState().closeAuthModal();
    onClose?.();
  };
  return <ResponsiveModal label="Autenticação" onDismiss={dismiss} dismissible={canDismiss}
    className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-md">
    <div className="relative w-full max-w-[460px] lg:max-w-[1040px] max-h-[calc(100dvh-24px)] rounded-[32px] border shadow-2xl overflow-y-auto flex bg-white text-zinc-900 dark:bg-[#131316] dark:text-zinc-100">
      {canDismiss && <button type="button" onClick={dismiss} aria-label="Fechar modal" className="absolute top-3 right-3 z-10 min-h-11 min-w-11 flex items-center justify-center"><X className="h-4 w-4" /></button>}
      <div className="w-full min-w-0 lg:w-5/12 p-6 sm:p-10">
        <img src={theme === 'dark' ? '/logo/catana_logo_white.png' : '/logo/catana_logo_dark.png'} alt="Catana" className="h-8 w-auto mx-auto mb-6" />
        <ClerkAuthExperience view={view} />
      </div>
      <div className="hidden lg:block w-7/12 relative min-h-[640px] bg-zinc-950 overflow-hidden"><MultiAgentShowcase /></div>
    </div>
  </ResponsiveModal>;
}

export function ClerkAuthPage({ view = 'login' }: { view?: AuthView }) {
  const theme = useStudioStore(state => state.theme);
  return <main className="min-h-screen flex items-center justify-center bg-zinc-100 dark:bg-zinc-950 p-4">
    <div className="w-full min-w-0 max-w-[1040px] rounded-[32px] border bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white overflow-hidden flex">
      <div className="w-full min-w-0 lg:w-5/12 p-6 sm:p-10">
        <img src={theme === 'dark' ? '/logo/catana_logo_white.png' : '/logo/catana_logo_dark.png'} alt="Catana" className="h-8 w-auto mb-6" />
        <ClerkAuthExperience view={view} />
      </div>
      <div className="hidden lg:block w-7/12 relative min-h-[640px] bg-zinc-950"><MultiAgentShowcase /></div>
    </div>
  </main>;
}
