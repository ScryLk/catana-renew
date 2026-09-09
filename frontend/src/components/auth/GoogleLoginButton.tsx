import React, { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: any) => void;
          renderButton: (parent: HTMLElement, options: any) => void;
          prompt: () => void;
        };
      };
    };
  }
}

interface GoogleLoginButtonProps {
  onSuccess: (credential: string) => void;
  onError?: (error: string) => void;
  isLoading?: boolean;
}

export const GoogleLoginButton: React.FC<GoogleLoginButtonProps> = ({
  onSuccess,
  onError,
  isLoading = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

  useEffect(() => {
    // Se o script ja foi carregado anteriormente
    if (window.google?.accounts?.id) {
      setScriptLoaded(true);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => setScriptLoaded(true);
    script.onerror = () => {
      if (onError) onError('Falha ao carregar o servico de autenticacao do Google.');
    };
    document.body.appendChild(script);

    return () => {
      // Deixa o script em cache
    };
  }, [onError]);

  useEffect(() => {
    if (!scriptLoaded || !containerRef.current || !clientId) return;

    try {
      window.google?.accounts.id.initialize({
        client_id: clientId,
        callback: (response: any) => {
          if (response.credential) {
            onSuccess(response.credential);
          } else if (onError) {
            onError('Nenhuma credencial retornada pelo Google.');
          }
        },
      });

      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }

      const isDark = document.documentElement.classList.contains('dark');
      const calculatedWidth = containerRef.current?.offsetWidth || 340;

      // Renderiza o botao oficial do Google com tema adaptativo e largura responsiva
      window.google?.accounts.id.renderButton(containerRef.current, {
        theme: isDark ? 'filled_black' : 'outline',
        size: 'large',
        type: 'standard',
        shape: 'rectangular',
        text: 'continue_with',
        logo_alignment: 'left',
        width: Math.min(Math.max(calculatedWidth, 240), 400),
        locale: 'pt-BR',
      });
    } catch (err) {
      console.error('Erro ao inicializar Google Identity Services:', err);
    }
  }, [scriptLoaded, clientId, onSuccess, onError]);

  // Se nao ha Client ID configurado (desenvolvimento inicial sem chaves cadastradas)
  const handleDevMockClick = () => {
    if (import.meta.env.DEV) {
      toast.info('Modo Dev: simulando login Google com credenciais de teste.');
      onSuccess('mock-google-test-token');
    } else {
      toast.error('Google Client ID nao configurado em producao.');
    }
  };

  if (!clientId) {
    return (
      <button
        type="button"
        disabled={isLoading}
        onClick={handleDevMockClick}
        className="w-full h-11 px-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800/80 text-zinc-900 dark:text-zinc-100 text-xs font-medium flex items-center justify-center gap-3 transition-all cursor-pointer shadow-xs disabled:opacity-50"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24">
          <path
            fill="#4285F4"
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
          />
          <path
            fill="#34A853"
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          />
          <path
            fill="#FBBC05"
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
          />
          <path
            fill="#EA4335"
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
          />
        </svg>
        <span>Continuar com o Google</span>
      </button>
    );
  }

  return (
    <div className="w-full flex justify-center items-center overflow-hidden">
      <div ref={containerRef} className="w-full min-h-[44px] flex justify-center" />
    </div>
  );
};
