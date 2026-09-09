import axios, { AxiosError } from 'axios';

// Base URL da API (de acordo com o swagger)
const API_BASE_URL = (import.meta.env && import.meta.env.VITE_API_BASE_URL) || 'http://localhost:8000';

// Token mantido em memoria (Zustand / Runtime)
let inMemoryAccessToken: string | null = null;

export function setInMemoryAccessToken(token: string | null) {
  inMemoryAccessToken = token;
}

export function getInMemoryAccessToken(): string | null {
  return inMemoryAccessToken;
}

// Limpa a sessao e sinaliza abertura do AuthModal sem perder estado
function forceLogout() {
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

// Interceptor de requisicao - adiciona o token JWT automaticamente
api.interceptors.request.use(
  (config) => {
    const token = inMemoryAccessToken || localStorage.getItem('access_token');

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
        // O cookie catana_refresh_token e enviado automaticamente pelo browser
        const response = await axios.post(
          `${API_BASE_URL}/api/auth/token/refresh/`,
          {},
          { withCredentials: true }
        );

        const { access } = response.data;
        setInMemoryAccessToken(access);
        localStorage.setItem('access_token', access);

        processQueue(null, access);

        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${access}`;
        }

        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        forceLogout();
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default api;
