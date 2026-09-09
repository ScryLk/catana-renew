import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { GoogleLoginButton } from '../components/auth/GoogleLoginButton';
import { MultiAgentShowcase } from '../components/auth/MultiAgentShowcase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, AlertCircle } from 'lucide-react';

export const Login = () => {
  const navigate = useNavigate();
  const { login, googleLogin, isLoading, error, clearError, isAuthenticated } = useAuthStore();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    clearError();

    try {
      await login({ username, password });
      navigate('/');
    } catch (err) {
      console.error('Login failed:', err);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/');
    }
  }, [isAuthenticated, navigate]);

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-zinc-100 dark:bg-zinc-950 p-4">
      <div className="w-full max-w-[1040px] h-[640px] bg-white dark:bg-zinc-900 rounded-[32px] shadow-2xl overflow-hidden flex border border-zinc-200/80 dark:border-zinc-800/80">

        {/* Left Side - Form Area */}
        <div className="w-full lg:w-5/12 p-8 sm:p-12 flex flex-col justify-center relative">
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
              <h1 className="text-2xl font-bold text-zinc-900 dark:text-white mb-2">Bem-vindo(a)</h1>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">Insira seus dados para continuar no Catana.</p>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-xl flex items-center gap-3 text-sm text-red-600 dark:bg-red-900/10 dark:border-red-900/20 dark:text-red-400">
                <AlertCircle className="w-4 h-4" />
                <span className="font-medium">{error}</span>
              </div>
            )}

            {/* Login com Google */}
            <div className="mb-5 space-y-4">
              <GoogleLoginButton
                onSuccess={async (credential) => {
                  try {
                    await googleLogin(credential);
                    navigate('/');
                  } catch (err) {
                    console.error('Falha no login com Google:', err);
                  }
                }}
                isLoading={isLoading}
              />

              <div className="relative flex items-center justify-center">
                <div className="border-t border-zinc-200 dark:border-zinc-800 w-full" />
                <span className="bg-white dark:bg-zinc-900 px-3 text-[11px] uppercase tracking-wider text-zinc-400 shrink-0 font-medium">
                  ou continue com
                </span>
                <div className="border-t border-zinc-200 dark:border-zinc-800 w-full" />
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">E-mail ou usuario</Label>
                <Input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={isLoading}
                  placeholder="exemplo@email.com ou usuario"
                  className="h-11 rounded-xl bg-zinc-50 border-zinc-200 focus:bg-white transition-all dark:bg-zinc-800 dark:border-zinc-700"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Senha</Label>
                  <Link
                    to="/forgot-password"
                    className="text-xs font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 transition-colors cursor-pointer"
                  >
                    Esqueci a senha
                  </Link>
                </div>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                  placeholder="••••••••"
                  className="h-11 rounded-xl bg-zinc-50 border-zinc-200 focus:bg-white transition-all dark:bg-zinc-800 dark:border-zinc-700"
                />
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="remember"
                  checked={rememberMe}
                  onCheckedChange={(checked) => setRememberMe(checked as boolean)}
                  className="rounded-[6px] border-zinc-300 data-[state=checked]:bg-zinc-900 data-[state=checked]:border-zinc-900 cursor-pointer"
                />
                <label
                  htmlFor="remember"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-zinc-500 dark:text-zinc-400 cursor-pointer"
                >
                  Lembrar de mim
                </label>
              </div>

              <Button
                type="submit"
                className="w-full h-11 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white font-medium shadow-lg shadow-zinc-500/10 transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Entrando...
                  </>
                ) : (
                  'Entrar'
                )}
              </Button>
            </form>

            <p className="text-center text-sm text-zinc-500 mt-8">
              Não tem uma conta?{' '}
              <Link
                to="/register"
                className="text-zinc-900 hover:underline font-semibold dark:text-zinc-300 cursor-pointer"
              >
                Criar conta
              </Link>
            </p>
          </div>
        </div>

        {/* Right Side - Multi-Agent Showcase */}
        <div className="hidden lg:block w-7/12 relative bg-zinc-950 overflow-hidden">
          <MultiAgentShowcase />
        </div>
      </div>
    </div>
  );
};

export default Login;
