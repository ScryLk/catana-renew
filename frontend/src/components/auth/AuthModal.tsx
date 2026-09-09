import React, { useState, useEffect } from 'react';
import { X, AlertCircle, Loader2 } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useStudioStore } from '../../store/studioStore';
import { GoogleLoginButton } from './GoogleLoginButton';
import { MultiAgentShowcase } from './MultiAgentShowcase';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Button } from '../ui/button';
import { Checkbox } from '../ui/checkbox';

interface AuthModalProps {
  isOpen: boolean;
  onClose?: () => void;
  canDismiss?: boolean;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  canDismiss = true,
}) => {
  const {
    login,
    googleLogin,
    register,
    isLoading,
    error,
    clearError,
    authModalView,
    openAuthModal,
    closeAuthModal,
  } = useAuthStore();

  const { theme } = useStudioStore();
  const isDark = theme === 'dark';

  // Form State
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  // Sync modal view
  const isRegisterView = authModalView === 'register';

  useEffect(() => {
    if (isOpen) {
      clearError();
      setLocalError(null);
    }
  }, [isOpen, clearError, authModalView]);

  // Handle ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && canDismiss) {
        handleDismiss();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, canDismiss]);

  if (!isOpen) return null;

  const handleDismiss = () => {
    if (canDismiss) {
      closeAuthModal();
      if (onClose) onClose();
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    if (!username.trim()) {
      setLocalError('Informe seu e-mail ou usuario.');
      return;
    }
    if (!password) {
      setLocalError('Informe sua senha.');
      return;
    }

    try {
      await login({ username, password });
      if (onClose) onClose();
    } catch {
      // Erro tratado pela store
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    if (!name.trim()) {
      setLocalError('Informe seu nome completo.');
      return;
    }
    if (!email.trim()) {
      setLocalError('Informe seu e-mail corporativo.');
      return;
    }
    if (password.length < 6) {
      setLocalError('A senha deve conter no minimo 6 caracteres.');
      return;
    }
    if (!termsAccepted) {
      setLocalError('E necessario concordar com os Termos de Uso.');
      return;
    }

    try {
      await register({
        username: email.split('@')[0] + Math.floor(Math.random() * 1000),
        first_name: name,
        email,
        password,
        account_type: 'individual',
      });
      if (onClose) onClose();
    } catch {
      // Erro tratado pela store
    }
  };

  const displayedError = localError || error;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200"
      onClick={handleDismiss}
      role="dialog"
      aria-modal="true"
    >
      <div
        className={`w-full max-w-[460px] lg:max-w-[1040px] h-auto lg:h-[640px] rounded-[32px] border shadow-2xl overflow-hidden flex flex-col lg:flex-row relative transition-all duration-200 ${
          isDark
            ? 'bg-[#131316] border-zinc-800 text-zinc-100 shadow-black/80'
            : 'bg-white border-zinc-200 text-zinc-900 shadow-zinc-900/15'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Botao de fechar global */}
        {canDismiss && (
          <button
            type="button"
            onClick={handleDismiss}
            className="absolute top-4 right-4 z-30 p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800/80 bg-zinc-900/60 backdrop-blur-md border border-zinc-700/50 transition-colors cursor-pointer"
            title="Fechar (Esc)"
            aria-label="Fechar modal"
          >
            <X className="w-4 h-4" />
          </button>
        )}

        {/* Lado Esquerdo - Area de Formulario */}
        <div className="w-full lg:w-5/12 p-7 sm:p-10 flex flex-col justify-center relative overflow-y-auto">
          {/* Cabecalho e Logotipo Cursivo Oficial */}
          <div className="mb-5 text-center">
            <div className="flex justify-center mb-3">
              <img
                src="/logo/catana_logo_dark.png"
                alt="Catana"
                className="h-8 w-auto object-contain dark:hidden"
              />
              <img
                src="/logo/catana_logo_white.png"
                alt="Catana"
                className="h-8 w-auto object-contain hidden dark:block"
              />
            </div>

            <h2 className="text-xl font-bold tracking-tight mb-1">
              {isRegisterView ? 'Criar sua conta' : 'Bem-vindo(a)'}
            </h2>
            <p className={`text-xs ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>
              {isRegisterView
                ? 'Comece a criar catalogos inteligentes com o Catana 2.0.'
                : 'Insira seus dados para continuar no Catana.'}
            </p>
          </div>

          {/* Feedback de Erro */}
          {displayedError && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-2.5 text-xs text-red-500 dark:text-red-400">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span className="font-medium leading-tight">{displayedError}</span>
            </div>
          )}

          {/* Login com Google Oficial */}
          <div className="mb-4">
            <GoogleLoginButton
              onSuccess={async (credential) => {
                try {
                  await googleLogin(credential);
                  if (onClose) onClose();
                } catch {
                  // Erro tratado pela store
                }
              }}
              isLoading={isLoading}
            />
          </div>

          {/* Divisor Visual Monocromatico */}
          <div className="relative flex items-center justify-center my-3">
            <div
              className={`border-t w-full ${
                isDark ? 'border-zinc-800' : 'border-zinc-200'
              }`}
            />
            <span
              className={`px-3 text-[10px] uppercase tracking-wider font-mono shrink-0 ${
                isDark ? 'bg-[#131316] text-zinc-500' : 'bg-white text-zinc-400'
              }`}
            >
              ou continue com
            </span>
            <div
              className={`border-t w-full ${
                isDark ? 'border-zinc-800' : 'border-zinc-200'
              }`}
            />
          </div>

          {/* Formularios Alternaveis (Login vs Registro) */}
          {!isRegisterView ? (
            <form onSubmit={handleLoginSubmit} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="auth-username" className="text-xs font-medium">
                  E-mail ou usuario
                </Label>
                <Input
                  id="auth-username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={isLoading}
                  placeholder="exemplo@email.com ou usuario"
                  className={`h-10 rounded-xl text-xs transition-all ${
                    isDark
                      ? 'bg-zinc-800/70 border-zinc-700/80 text-zinc-100 placeholder:text-zinc-500'
                      : 'bg-zinc-50 border-zinc-200 text-zinc-900 placeholder:text-zinc-400'
                  }`}
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="auth-password" className="text-xs font-medium">
                    Senha
                  </Label>
                  <a
                    href="/forgot-password"
                    className={`text-[11px] font-medium transition-colors hover:underline ${
                      isDark
                        ? 'text-zinc-400 hover:text-zinc-200'
                        : 'text-zinc-500 hover:text-zinc-800'
                    }`}
                  >
                    Esqueci a senha
                  </a>
                </div>
                <Input
                  id="auth-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                  placeholder="••••••••"
                  className={`h-10 rounded-xl text-xs transition-all ${
                    isDark
                      ? 'bg-zinc-800/70 border-zinc-700/80 text-zinc-100 placeholder:text-zinc-500'
                      : 'bg-zinc-50 border-zinc-200 text-zinc-900 placeholder:text-zinc-400'
                  }`}
                />
              </div>

              <div className="flex items-center space-x-2 pt-0.5">
                <Checkbox
                  id="auth-remember"
                  checked={rememberMe}
                  onCheckedChange={(checked) => setRememberMe(checked as boolean)}
                  className="rounded-[6px] cursor-pointer"
                />
                <label
                  htmlFor="auth-remember"
                  className={`text-xs font-medium leading-none cursor-pointer select-none ${
                    isDark ? 'text-zinc-400' : 'text-zinc-500'
                  }`}
                >
                  Lembrar de mim
                </label>
              </div>

              <Button
                type="submit"
                className={`w-full h-10 rounded-xl font-medium text-xs shadow-md transition-all cursor-pointer mt-1 ${
                  isDark
                    ? 'bg-zinc-100 hover:bg-white text-zinc-950 font-semibold shadow-black/40'
                    : 'bg-zinc-900 hover:bg-zinc-800 text-white shadow-zinc-500/10'
                }`}
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                    Entrando...
                  </>
                ) : (
                  'Entrar'
                )}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleRegisterSubmit} className="space-y-2.5">
              <div className="space-y-1">
                <Label htmlFor="reg-name" className="text-xs font-medium">
                  Nome completo
                </Label>
                <Input
                  id="reg-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={isLoading}
                  placeholder="Seu nome"
                  className={`h-9 rounded-xl text-xs transition-all ${
                    isDark
                      ? 'bg-zinc-800/70 border-zinc-700/80 text-zinc-100 placeholder:text-zinc-500'
                      : 'bg-zinc-50 border-zinc-200 text-zinc-900 placeholder:text-zinc-400'
                  }`}
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="reg-email" className="text-xs font-medium">
                  E-mail corporativo
                </Label>
                <Input
                  id="reg-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading}
                  placeholder="nome@empresa.com"
                  className={`h-9 rounded-xl text-xs transition-all ${
                    isDark
                      ? 'bg-zinc-800/70 border-zinc-700/80 text-zinc-100 placeholder:text-zinc-500'
                      : 'bg-zinc-50 border-zinc-200 text-zinc-900 placeholder:text-zinc-400'
                  }`}
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="reg-password" className="text-xs font-medium">
                  Senha de acesso
                </Label>
                <Input
                  id="reg-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                  placeholder="Minimo de 6 caracteres"
                  className={`h-9 rounded-xl text-xs transition-all ${
                    isDark
                      ? 'bg-zinc-800/70 border-zinc-700/80 text-zinc-100 placeholder:text-zinc-500'
                      : 'bg-zinc-50 border-zinc-200 text-zinc-900 placeholder:text-zinc-400'
                  }`}
                />
              </div>

              <div className="flex items-start space-x-2 pt-0.5">
                <Checkbox
                  id="reg-terms"
                  checked={termsAccepted}
                  onCheckedChange={(checked) => setTermsAccepted(checked as boolean)}
                  className="rounded-[6px] mt-0.5 cursor-pointer"
                />
                <label
                  htmlFor="reg-terms"
                  className={`text-[10px] leading-tight cursor-pointer select-none ${
                    isDark ? 'text-zinc-400' : 'text-zinc-500'
                  }`}
                >
                  Concordo com os Termos de Servico e Politica de Privacidade.
                </label>
              </div>

              <Button
                type="submit"
                className={`w-full h-9 rounded-xl font-medium text-xs shadow-md transition-all cursor-pointer mt-1 ${
                  isDark
                    ? 'bg-zinc-100 hover:bg-white text-zinc-950 font-semibold shadow-black/40'
                    : 'bg-zinc-900 hover:bg-zinc-800 text-white shadow-zinc-500/10'
                }`}
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                    Criando conta...
                  </>
                ) : (
                  'Criar Conta'
                )}
              </Button>
            </form>
          )}

          {/* Rodape de Alternancia entre Login e Cadastro */}
          <div className="mt-4 text-center">
            <p className={`text-xs ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>
              {!isRegisterView ? (
                <>
                  Nao tem uma conta?{' '}
                  <button
                    type="button"
                    onClick={() => openAuthModal('register')}
                    className={`font-semibold underline cursor-pointer transition-colors ${
                      isDark ? 'text-zinc-200 hover:text-white' : 'text-zinc-900 hover:text-black'
                    }`}
                  >
                    Criar conta
                  </button>
                </>
              ) : (
                <>
                  Ja possui uma conta?{' '}
                  <button
                    type="button"
                    onClick={() => openAuthModal('login')}
                    className={`font-semibold underline cursor-pointer transition-colors ${
                      isDark ? 'text-zinc-200 hover:text-white' : 'text-zinc-900 hover:text-black'
                    }`}
                  >
                    Entrar
                  </button>
                </>
              )}
            </p>
          </div>
        </div>

        {/* Lado Direito - Vitrine dos Multi-Agentes de IA */}
        <div className="hidden lg:block w-7/12 relative bg-zinc-950 overflow-hidden border-l border-zinc-200/20 dark:border-zinc-800/80">
          <MultiAgentShowcase />
        </div>
      </div>
    </div>
  );
};
