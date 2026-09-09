import { useState, useEffect, type FormEvent } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useStudioStore } from '../store/studioStore';
import { MultiAgentShowcase } from '../components/auth/MultiAgentShowcase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, AlertCircle, CheckCircle2, Lock, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

export const ResetPassword = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const uid = searchParams.get('uid') || '';
  const token = searchParams.get('token') || '';

  const { confirmPasswordReset, isLoading, error, clearError, openAuthModal } = useAuthStore();
  const { theme } = useStudioStore();
  const isDark = theme === 'dark';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    clearError();
  }, [clearError]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLocalError(null);

    if (!password) {
      setLocalError('Informe a nova senha.');
      return;
    }

    if (password.length < 6) {
      setLocalError('A senha deve ter no minimo 6 caracteres.');
      return;
    }

    if (password !== confirmPassword) {
      setLocalError('As senhas nao coincidem.');
      return;
    }

    try {
      await confirmPasswordReset({
        uid,
        token,
        new_password: password,
      });

      toast.success('Senha redefinida com sucesso!');
      setIsSuccess(true);

      setTimeout(() => {
        openAuthModal('login');
        navigate('/');
      }, 2500);
    } catch {
      // Erro registrado na store
    }
  };

  const isLinkInvalid = !uid || !token;
  const displayedError = localError || error;

  return (
    <div className={`min-h-screen w-full flex items-center justify-center p-4 ${isDark ? 'bg-[#09090b]' : 'bg-zinc-100'}`}>
      <div className={`w-full max-w-[1040px] h-auto lg:h-[640px] rounded-[32px] shadow-2xl overflow-hidden flex flex-col lg:flex-row border transition-all ${
        isDark
          ? 'bg-[#131316] border-zinc-800 text-zinc-100 shadow-black/80'
          : 'bg-white border-zinc-200 text-zinc-900 shadow-zinc-900/15'
      }`}>

        {/* Lado Esquerdo - Area de Formulario */}
        <div className="w-full lg:w-5/12 p-8 sm:p-12 flex flex-col justify-center relative overflow-y-auto">
          <div className="mb-6">
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

          <div className="flex-1 flex flex-col justify-center">
            <div className="mb-6">
              <h1 className="text-2xl font-bold tracking-tight mb-2">Redefinir Senha</h1>
              <p className={`text-sm ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>
                Crie uma nova senha segura para acessar sua conta Catana.
              </p>
            </div>

            {isLinkInvalid ? (
              <div className="space-y-4">
                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-start gap-3 text-sm text-red-500 dark:text-red-400">
                  <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-semibold">Link invalido ou incompleto</p>
                    <p className="text-xs leading-relaxed opacity-90">
                      O link de redefinicao acessado nao contem os parametros necessarios ou expirou.
                    </p>
                  </div>
                </div>

                <Button
                  type="button"
                  onClick={() => {
                    openAuthModal('forgot-password');
                    navigate('/');
                  }}
                  className={`w-full h-11 rounded-xl font-medium text-xs shadow-md transition-all cursor-pointer ${
                    isDark
                      ? 'bg-zinc-100 hover:bg-white text-zinc-950 font-semibold shadow-black/40'
                      : 'bg-zinc-900 hover:bg-zinc-800 text-white shadow-zinc-500/10'
                  }`}
                >
                  Solicitar novo link de recuperacao
                </Button>

                <div className="text-center pt-2">
                  <Link
                    to="/"
                    className={`inline-flex items-center gap-1.5 text-xs font-medium hover:underline ${
                      isDark ? 'text-zinc-400 hover:text-white' : 'text-zinc-500 hover:text-zinc-900'
                    }`}
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    Voltar ao inicio
                  </Link>
                </div>
              </div>
            ) : isSuccess ? (
              <div className="space-y-4">
                <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-start gap-3 text-sm text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-semibold text-base">Senha redefinida com sucesso!</p>
                    <p className="text-xs leading-relaxed opacity-90">
                      Sua nova senha foi configurada. Voce sera redirecionado para a tela de autenticacao em instantes.
                    </p>
                  </div>
                </div>

                <Button
                  type="button"
                  onClick={() => {
                    openAuthModal('login');
                    navigate('/');
                  }}
                  className={`w-full h-11 rounded-xl font-medium text-xs shadow-md transition-all cursor-pointer ${
                    isDark
                      ? 'bg-zinc-100 hover:bg-white text-zinc-950 font-semibold shadow-black/40'
                      : 'bg-zinc-900 hover:bg-zinc-800 text-white shadow-zinc-500/10'
                  }`}
                >
                  Entrar com a nova senha
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {displayedError && (
                  <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-2.5 text-xs text-red-500 dark:text-red-400">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span className="font-medium leading-tight">{displayedError}</span>
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label htmlFor="new-password" className="text-xs font-medium">
                    Nova senha
                  </Label>
                  <div className="relative">
                    <Input
                      id="new-password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={isLoading}
                      placeholder="Minimo 6 caracteres"
                      autoFocus
                      className={`h-10 pl-9 rounded-xl text-xs transition-all ${
                        isDark
                          ? 'bg-zinc-800/70 border-zinc-700/80 text-zinc-100 placeholder:text-zinc-500 focus:text-white focus:border-zinc-500'
                          : 'bg-zinc-50 border-zinc-200 text-zinc-900 placeholder:text-zinc-400 focus:text-zinc-900 focus:border-zinc-400'
                      }`}
                    />
                    <Lock className={`w-4 h-4 absolute left-3 top-3 ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`} />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="confirm-password" className="text-xs font-medium">
                    Confirmar nova senha
                  </Label>
                  <div className="relative">
                    <Input
                      id="confirm-password"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      disabled={isLoading}
                      placeholder="Repita a nova senha"
                      className={`h-10 pl-9 rounded-xl text-xs transition-all ${
                        isDark
                          ? 'bg-zinc-800/70 border-zinc-700/80 text-zinc-100 placeholder:text-zinc-500 focus:text-white focus:border-zinc-500'
                          : 'bg-zinc-50 border-zinc-200 text-zinc-900 placeholder:text-zinc-400 focus:text-zinc-900 focus:border-zinc-400'
                      }`}
                    />
                    <Lock className={`w-4 h-4 absolute left-3 top-3 ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`} />
                  </div>
                </div>

                <Button
                  type="submit"
                  className={`w-full h-10 rounded-xl font-medium text-xs shadow-md transition-all cursor-pointer mt-2 ${
                    isDark
                      ? 'bg-zinc-100 hover:bg-white text-zinc-950 font-semibold shadow-black/40'
                      : 'bg-zinc-900 hover:bg-zinc-800 text-white shadow-zinc-500/10'
                  }`}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                      Salvando nova senha...
                    </>
                  ) : (
                    'Salvar nova senha'
                  )}
                </Button>

                <div className="text-center pt-2">
                  <Link
                    to="/"
                    className={`inline-flex items-center gap-1.5 text-xs font-medium hover:underline ${
                      isDark ? 'text-zinc-400 hover:text-white' : 'text-zinc-500 hover:text-zinc-900'
                    }`}
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    Voltar ao inicio
                  </Link>
                </div>
              </form>
            )}
          </div>
        </div>

        {/* Lado Direito - Multi-Agentes de IA */}
        <div className="hidden lg:block w-7/12 relative bg-zinc-950 overflow-hidden border-l border-zinc-200/20 dark:border-zinc-800/80">
          <MultiAgentShowcase />
        </div>
      </div>
    </div>
  );
};
