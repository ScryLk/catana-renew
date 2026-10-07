import axios, { AxiosError } from 'axios';
import { toast } from 'sonner';

// Base URL da API (de acordo com o swagger)
export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL !== undefined &&
  import.meta.env.VITE_API_BASE_URL !== ''
    ? import.meta.env.VITE_API_BASE_URL
    : import.meta.env.DEV
      ? 'http://localhost:8000'
      : '';

import {
  getAuthToken,
  refreshAuthToken,
  authFailure,
  getAuthEpoch,
  getAuthProvider,
  AuthNotReadyError
} from './authTokenProvider';
export {
  getAuthToken,
  getInMemoryAccessToken,
  setInMemoryAccessToken,
  authenticatedStreamingFetch
} from './authTokenProvider';

// Criar instancia do axios com credenciais habilitadas para cookies HttpOnly
const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json'
  },
  timeout: 30000
});

// Interceptor de requisicao - adiciona o token JWT automaticamente (Clerk ou Local)
api.interceptors.request.use(
  async config => {
    const tagged = config as typeof config & {
      _authEpoch?: number;
      _retryToken?: string;
    };
    if (tagged._authEpoch !== undefined && tagged._authEpoch !== getAuthEpoch())
      throw new AuthNotReadyError();
    tagged._authEpoch = getAuthEpoch();
    const token = tagged._retryToken || (await getAuthToken());
    if (tagged._authEpoch !== getAuthEpoch()) throw new AuthNotReadyError();
    if (
      !token &&
      !config.url?.match(
        /\/api\/(?:auth\/|register\/|public|explore|health|v2\/studio\/(?:public|templates|fonts))/
      )
    )
      throw new AuthNotReadyError();

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
      results: { value: arr, enumerable: false, configurable: true }
    });
    return arr;
  }
  return data;
}

// Interceptor de resposta - trata erros e refresh de token seguro
api.interceptors.response.use(
  response => {
    const tagged = response.config as typeof response.config & {
      _authEpoch?: number;
    };
    if (tagged._authEpoch !== getAuthEpoch()) throw new AuthNotReadyError();
    response.data = unwrapPaginated(response.data);
    return response;
  },
  async (error: AxiosError) => {
    const originalRequest = error.config as any & { _retry?: boolean };

    if(originalRequest?._authEpoch!==undefined && originalRequest._authEpoch!==getAuthEpoch()) return Promise.reject(new AuthNotReadyError());
    if (error.response?.status === 401 && originalRequest) {
      console.info('auth_401',{path:String(originalRequest.url || '').split('?')[0],provider:getAuthProvider(),retry:Boolean(originalRequest._retry)});
      if (originalRequest._retry) {
        authFailure();
        return Promise.reject(error);
      }
      originalRequest._retry = true;
      try {
        const failedToken = String(
          originalRequest.headers?.Authorization || ''
        ).replace(/^Bearer /, '');
        const fresh = await refreshAuthToken(failedToken);
        if (originalRequest._authEpoch !== getAuthEpoch())
          throw new AuthNotReadyError();
        originalRequest._retryToken = fresh;
        return api(originalRequest);
      } catch (refreshError) {
        return Promise.reject(refreshError);
      }
    }

    // Tratamento de limites de uso e cotas de faturamento
    if (error.response) {
      const respStatus = error.response.status;
      const data = error.response.data as any;
      const code = data?.code || data?.default_code;

      if (respStatus === 429 && code === 'quota_exceeded') {
        toast.error('Limite mensal de tokens atingido.', {
          description:
            'Faca upgrade do seu plano para continuar gerando sem interrupcoes.'
        });
        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('catana:open-billing-modal', {
              detail: { reason: 'quota_exceeded' }
            })
          );
        }
      } else if (
        respStatus === 403 &&
        code === 'catalog_limit_exceeded' &&
        !error.config?.url?.includes('/import-document/')
      ) {
        toast.error('Limite de catalogos atingido.', {
          description:
            'Voce atingiu o maximo de catalogos ativos do seu plano. Faca upgrade para criar mais.'
        });
        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('catana:open-billing-modal', {
              detail: { reason: 'catalog_limit' }
            })
          );
        }
      } else if (respStatus === 403 && code === 'feature_locked_pro') {
        toast.error('Recurso exclusivo Pro/Enterprise.', {
          description:
            'O Conselho Editorial Multi-Agente requer o Plano Pro ou Enterprise.'
        });
        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('catana:open-billing-modal', {
              detail: { reason: 'council_locked' }
            })
          );
        }
      } else if (respStatus === 403 && code === 'export_dpi_restricted') {
        toast.error('Exportacao grafica restrita.', {
          description:
            'A exportacao em 300 DPI CMYK requer o Plano Pro ou Enterprise.'
        });
        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('catana:open-billing-modal', {
              detail: { reason: 'export_restricted' }
            })
          );
        }
      }
    }

    return Promise.reject(error);
  }
);

export default api;
