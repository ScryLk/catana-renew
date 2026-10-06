import axios, { AxiosError } from 'axios';
import { toast } from 'sonner';

// Base URL da API (de acordo com o swagger)
export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL !== undefined && import.meta.env.VITE_API_BASE_URL !== '')
  ? import.meta.env.VITE_API_BASE_URL
  : (import.meta.env.DEV ? 'http://localhost:8000' : '');

// Token mantido em memoria (Zustand / Runtime)
let inMemoryAccessToken: string | null = null;

export function setInMemoryAccessToken(token: string | null) {
  inMemoryAccessToken = token;
}

export function getInMemoryAccessToken(): string | null {
  return inMemoryAccessToken;
}

export async function getAuthToken(forceRefresh = false): Promise<string | null> {
  if (typeof window !== 'undefined' && (window as any).Clerk?.session) {
    try {
      const clerkToken = await (window as any).Clerk.session.getToken({
        skipCache: forceRefresh,
      });
      if (clerkToken) {
        setInMemoryAccessToken(clerkToken);
        localStorage.setItem('access_token', clerkToken);
        return clerkToken;
      }
    } catch {
      // Falha ao obter token do Clerk, fallback para armazenamento local
    }
  }

  return inMemoryAccessToken || localStorage.getItem('access_token');
}

// Limpa a sessao e sinaliza abertura do AuthModal sem perder estado
function forceLogout() {
  if (typeof window !== 'undefined' && (window as any).Clerk?.session) {
    // Se o usuario possui sessao ativa no Clerk, nao forca deslogamento local
    return;
  }
  inMemoryAccessToken = null;
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
  localStorage.removeItem('user');
  localStorage.removeItem('active_organization');
  localStorage.removeItem('active_sede');
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('catana:unauthorized'));
  }
}

// Criar instancia do axios com credenciais habilitadas para cookies HttpOnly
const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
});

// Interceptor de requisicao - adiciona o token JWT automaticamente (Clerk ou Local)
api.interceptors.request.use(
  async (config) => {
    const token = await getAuthToken();

    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error: AxiosError) => {
    return Promise.reject(error);
  }
);

// Backend usa paginacao global do DRF: listagens vem como
// { count, next, previous, results: [...] }. Os services do front esperam
// um array. Aqui desembrulhamos para o array, preservando os metadados de
// paginacao como props NAO-enumeraveis (results/count/next/previous).
function unwrapPaginated(data: any): any {
  if (
    data &&
    typeof data === 'object' &&
    !Array.isArray(data) &&
    Array.isArray(data.results) &&
    'count' in data &&
    'next' in data &&
    'previous' in data
  ) {
    const arr = data.results;
    Object.defineProperties(arr, {
      count: { value: data.count, enumerable: false, configurable: true },
      next: { value: data.next, enumerable: false, configurable: true },
      previous: { value: data.previous, enumerable: false, configurable: true },
      results: { value: arr, enumerable: false, configurable: true },
    });
    return arr;
  }
  return data;
}

// Controle de concorrencia: fila de espera para renovacao silenciosa de token
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value?: unknown) => void;
  reject: (reason?: unknown) => void;
}> = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// Interceptor de resposta - trata erros e refresh de token seguro
api.interceptors.response.use(
  (response) => {
    response.data = unwrapPaginated(response.data);
    return response;
  },
  async (error: AxiosError) => {
    const originalRequest = error.config as any & { _retry?: boolean };

    // Se o erro for 401 e nao for uma tentativa de retry
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        // Enfileira requisicoes concorrentes ate que o refresh termine
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((newToken) => {
            if (originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${newToken}`;
            }
            return api(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        let newToken: string | null = null;

        // Se o Clerk estiver ativo, forca obtencao de token fresco sem cache
        if (typeof window !== 'undefined' && (window as any).Clerk?.session) {
          newToken = await getAuthToken(true);
        }

        // Se nao for Clerk, tenta refresh do SimpleJWT legado caso exista refresh_token
        if (!newToken) {
          const storedRefresh = localStorage.getItem('refresh_token');
          if (storedRefresh) {
            const response = await axios.post(
              `${API_BASE_URL}/api/auth/token/refresh/`,
              { refresh: storedRefresh },
              { withCredentials: true }
            );

            const { access, refresh: newRefresh } = response.data;
            newToken = access;
            setInMemoryAccessToken(access);
            localStorage.setItem('access_token', access);
            if (newRefresh) {
              localStorage.setItem('refresh_token', newRefresh);
            }
          }
        }

        if (newToken) {
          processQueue(null, newToken);

          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${newToken}`;
          }

          return api(originalRequest);
        } else {
          // Se o usuario tem sessao ativa no Clerk, nao dispara forceLogout
          const hasClerkSession = typeof window !== 'undefined' && Boolean((window as any).Clerk?.session);
          if (hasClerkSession) {
            processQueue(error, null);
            return Promise.reject(error);
          }
          throw new Error('Falha ao renovar autenticacao');
        }
      } catch (refreshError) {
        processQueue(refreshError, null);
        const hasClerkSession = typeof window !== 'undefined' && Boolean((window as any).Clerk?.session);
        if (!hasClerkSession) {
          forceLogout();
        }
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    // Tratamento de limites de uso e cotas de faturamento
    if (error.response) {
      const respStatus = error.response.status;
      const data = error.response.data as any;
      const code = data?.code || data?.default_code;

      if (respStatus === 429 && code === 'quota_exceeded') {
        toast.error('Limite mensal de tokens atingido.', {
          description: 'Faca upgrade do seu plano para continuar gerando sem interrupcoes.',
        });
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('catana:open-billing-modal', { detail: { reason: 'quota_exceeded' } }));
        }
      } else if (respStatus === 403 && code === 'catalog_limit_exceeded' && !error.config?.url?.includes('/import-document/')) {
        toast.error('Limite de catalogos atingido.', {
          description: 'Voce atingiu o maximo de catalogos ativos do seu plano. Faca upgrade para criar mais.',
        });
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('catana:open-billing-modal', { detail: { reason: 'catalog_limit' } }));
        }
      } else if (respStatus === 403 && code === 'feature_locked_pro') {
        toast.error('Recurso exclusivo Pro/Enterprise.', {
          description: 'O Conselho Editorial Multi-Agente requer o Plano Pro ou Enterprise.',
        });
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('catana:open-billing-modal', { detail: { reason: 'council_locked' } }));
        }
      } else if (respStatus === 403 && code === 'export_dpi_restricted') {
        toast.error('Exportacao grafica restrita.', {
          description: 'A exportacao em 300 DPI CMYK requer o Plano Pro ou Enterprise.',
        });
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('catana:open-billing-modal', { detail: { reason: 'export_restricted' } }));
        }
      }
    }

    return Promise.reject(error);
  }
);

export default api;
