import { type FC, type ReactNode, useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore, isAutoLoginSettled } from '../../store/authStore';
import { LoadingScreen } from '../common/LoadingScreen';

interface PrivateRouteProps {
  children: ReactNode;
}

export const PrivateRoute: FC<PrivateRouteProps> = ({ children }) => {
  const { isAuthenticated, checkAuth, autoLogin } = useAuthStore();
  const location = useLocation();

  // Segura a renderização até o login fresco do boot concluir (garante token
  // válido antes de qualquer requisição protegida). Em navegação SPA o boot já
  // está resolvido → isAutoLoginSettled() = true → sem loading.
  const [checking, setChecking] = useState(!isAutoLoginSettled());

  useEffect(() => {
    checkAuth();
    if (isAutoLoginSettled()) {
      setChecking(false);
    } else {
      autoLogin().finally(() => setChecking(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingScreen message="Entrando..." />
      </div>
    );
  }

  if (!isAuthenticated) {
    // Redirecionar para login, salvando a rota atual
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};

export default PrivateRoute;
