import axios, { AxiosError } from 'axios';

// TODO(arquitetura) SEG-06: avaliar mover o refresh token para cookie
// HttpOnly/SameSite em vez de localStorage (mitiga roubo via XSS).

// Base URL da API (de acordo com o swagger)
const API_BASE_URL = (import.meta.env && import.meta.env.VITE_API_BASE_URL) || 'http://localhost:8000';

// SEG-02: limpa a sessão e manda para o login (usado em 401 sem refresh).
function forceLogout() {
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
  localStorage.removeItem('user');
  if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
    window.location.href = '/login';
  }
}

// Criar instância do axios
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
});

// Interceptor de requisição - adiciona o token JWT automaticamente
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');

    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error: AxiosError) => {
    return Promise.reject(error);
  }
);

// Backend usa paginação global do DRF: listagens vêm como
// { count, next, previous, results: [...] }. Os services do front esperam
// um array. Aqui desembrulhamos para o array, preservando os metadados de
// paginação como props NÃO-enumeráveis (results/count/next/previous), de
// modo que tanto `data.map(...)` quanto `data.count` continuem funcionando.
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

// Interceptor de resposta - trata erros e refresh de token
api.interceptors.response.use(
  (response) => {
    response.data = unwrapPaginated(response.data);
    return response;
  },
  async (error: AxiosError) => {
    const originalRequest = error.config as any & { _retry?: boolean };

    // Se o erro for 401 e não for uma tentativa de retry
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      const refreshToken = localStorage.getItem('refresh_token');

      // Sem refresh token: sessão inválida, força logout.
      if (!refreshToken) {
        forceLogout();
        return Promise.reject(error);
      }

      try {
        // Tentar refresh do token
        const response = await axios.post(`${API_BASE_URL}/api/auth/token/refresh/`, {
          refresh: refreshToken,
        });

        const { access } = response.data;

        // Salvar novo access token
        localStorage.setItem('access_token', access);

        // Refazer a requisição original com o novo token
        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${access}`;
        }

        return api(originalRequest);
      } catch (refreshError) {
        // Se o refresh falhar, limpar tokens e redirecionar para login
        forceLogout();
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default api;
