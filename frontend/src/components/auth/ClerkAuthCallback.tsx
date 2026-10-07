import { useEffect, useRef, useState } from 'react';
import { useClerk } from '@clerk/clerk-react';
import { authProviderMode, isClerkConfigured } from '../../services/authConfig';
import { socialAuthError } from './socialAuthError';

function ConfiguredCallback() {
  const clerk = useClerk();
  const started = useRef(false);
  const mounted = useRef(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    mounted.current = true;
    // Clerk React 5.61.9 can swallow the underlying callback rejection. Keep
    // recovery available independently of that wrapper's returned promise.
    const recoveryTimer = window.setTimeout(() => {
      if (mounted.current) setError(current => current || 'O acesso ainda não foi concluído. Você pode voltar e tentar novamente.');
    }, 10000);
    if (!started.current) {
      started.current = true;
      // Clerk consumes/validates OAuth state and completes sign-in, transfer or verification.
      void clerk.handleRedirectCallback({
        signInUrl: '/login',
        signUpUrl: '/register',
        continueSignUpUrl: '/register',
        firstFactorUrl: '/login',
        secondFactorUrl: '/login',
        resetPasswordUrl: '/forgot-password',
        signInForceRedirectUrl: '/studio',
        signUpForceRedirectUrl: '/studio',
      }).catch(failure => { if (mounted.current) setError(socialAuthError(failure)); });
    }
    return () => { mounted.current = false; window.clearTimeout(recoveryTimer); };
  }, [clerk]);
  return <main className="min-h-screen flex items-center justify-center p-6 bg-background text-foreground">
    <div className="max-w-sm space-y-4 text-center">
      {error ? <p role="alert">{error}</p> :
        <p role="status">Concluindo seu acesso ao Catana…</p>}
      <a href="/login" className="inline-flex min-h-11 items-center underline">Voltar para o acesso</a>
    </div>
  </main>;
}

export function ClerkAuthCallback() {
  if (authProviderMode !== 'clerk' || !isClerkConfigured)
    return <main className="p-6"><p role="alert">O acesso está indisponível. Contate o suporte.</p><a href="/login">Voltar para o acesso</a></main>;
  return <ConfiguredCallback />;
}
