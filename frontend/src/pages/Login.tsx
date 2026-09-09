import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, AlertCircle } from 'lucide-react';

export const Login = () => {
  const navigate = useNavigate();
  const { login, isLoading, error, clearError, isAuthenticated } = useAuthStore();

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
  }, [isAuthenticated, navigate])

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-zinc-100 dark:bg-zinc-950 p-4">
      <div className="w-full max-w-[1000px] h-[600px] bg-white dark:bg-zinc-900 rounded-[32px] shadow-2xl overflow-hidden flex">

        {/* Left Side - Form Area */}
        <div className="w-full lg:w-5/12 p-8 sm:p-12 flex flex-col justify-center relative">
          <div className="mb-10">
            <img
              src="/logo/logo.png"
              alt="Catana"
              className="w-10 h-10 object-contain dark:brightness-0 dark:invert"
            />
          </div>

          <div className="flex-1 flex flex-col justify-center">
            <div className="mb-8">
              <h1 className="text-2xl font-bold text-zinc-900 dark:text-white mb-2">Bem-vindo(a)</h1>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">Insira seus dados para continuar.</p>
            </div>

            {error && (
              <div className="mb-6 p-3 bg-red-50 border border-red-100 rounded-xl flex items-center gap-3 text-sm text-red-600 dark:bg-red-900/10 dark:border-red-900/20 dark:text-red-400">
                <AlertCircle className="w-4 h-4" />
                <span className="font-medium">{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="username">E-mail</Label>
                <Input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={isLoading}
                  placeholder="exemplo@email.com"
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

        {/* Right Side - Illustration Area */}
        <div className="hidden lg:block w-7/12 relative bg-zinc-50 dark:bg-zinc-900 overflow-hidden">
          {/* Background elements */}
          <div className="absolute inset-0 bg-gradient-to-br from-zinc-100 to-white dark:from-zinc-900 dark:to-black" />

          {/* Abstract Illustration Composition */}
          <div className="absolute inset-0 flex items-center justify-center p-12">
            <div className="relative w-full h-full">
              {/* Floating Cards simulating catalog elements */}
              <div className="absolute top-[15%] right-[10%] w-64 h-80 bg-white dark:bg-zinc-800 rounded-2xl shadow-2xl rotate-[-6deg] z-10 p-4 border border-zinc-100 dark:border-zinc-700 animate-in fade-in zoom-in duration-1000">
                <div className="w-full h-32 bg-zinc-100 dark:bg-zinc-700/50 rounded-lg mb-4" />
                <div className="h-4 w-3/4 bg-zinc-100 dark:bg-zinc-700 rounded mb-2" />
                <div className="h-4 w-1/2 bg-zinc-100 dark:bg-zinc-700 rounded" />
              </div>

              <div className="absolute top-[30%] left-[15%] w-56 h-72 bg-zinc-900 rounded-2xl shadow-2xl shadow-zinc-500/20 rotate-[12deg] z-20 p-6 flex flex-col justify-between animate-in fade-in slide-in-from-bottom-10 duration-1000 delay-200">
                <div className="w-12 h-12 bg-white/10 rounded-full" />
                <div className="space-y-2">
                  <div className="h-3 w-full bg-white/10 rounded" />
                  <div className="h-3 w-2/3 bg-white/10 rounded" />
                </div>
              </div>

              <div className="absolute bottom-[20%] right-[20%] w-48 h-48 bg-white dark:bg-zinc-800 rounded-2xl shadow-xl rotate-[3deg] z-0 p-4 border border-zinc-100 dark:border-zinc-700 opacity-80">
                <div className="w-full h-full rounded-lg bg-gradient-to-br from-green-50 to-blue-50 dark:from-zinc-800 dark:to-zinc-900" />
              </div>

              {/* Decorative flowing shapes */}
              <div className="absolute -bottom-20 -left-20 w-96 h-96 bg-zinc-200/50 rounded-full blur-3xl mix-blend-multiply dark:mix-blend-screen" />
              <div className="absolute -top-20 -right-20 w-96 h-96 bg-zinc-200/50 rounded-full blur-3xl mix-blend-multiply dark:mix-blend-screen" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
