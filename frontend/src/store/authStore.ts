import { logger } from '../utils/logger';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import axios from 'axios';
import { setInMemoryAccessToken } from '../services/api';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

// Login automatico (conveniencia de dev - autenticacao nao exigida no momento).
// Para desligar e voltar a exigir login manual: VITE_AUTO_LOGIN=false no .env do front.
export const AUTO_LOGIN_ENABLED =
  (import.meta.env.VITE_AUTO_LOGIN ?? 'true') !== 'false';
const DEFAULT_USER = {
  username: import.meta.env.VITE_DEFAULT_USER || 'demo',
  password: import.meta.env.VITE_DEFAULT_PASSWORD || 'demo12345',
  email: 'demo@catana.dev',
  role: 'admin',
};

let autoLoginPromise: Promise<void> | null = null;
let autoLoginDone = false;
export const isAutoLoginSettled = () => autoLoginDone || !AUTO_LOGIN_ENABLED;

export interface User {
  id: number;
  name: string;
  email: string;
  avatar?: string;
  username?: string;
  role?: 'admin' | 'editor' | 'viewer';
}

interface AuthStore {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  isAuthModalOpen: boolean;
  authModalView: 'login' | 'register' | 'forgot-password';
  openAuthModal: (view?: 'login' | 'register' | 'forgot-password') => void;
  closeAuthModal: () => void;
  login: (credentials: { username: string; password: string }) => Promise<void>;
  googleLogin: (credential: string) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  silentRefresh: () => Promise<boolean>;
  clearError: () => void;
  register: (user: any) => Promise<void>;
  autoLogin: () => Promise<void>;
  requestPasswordReset: (email: string) => Promise<{ message: string }>;
  confirmPasswordReset: (payload: { uid: string; token: string; new_password: string }) => Promise<{ message: string }>;
}

// Helper para selecionar organizacao e sede padrao apos login
async function setupUserOrganizationContext(accessToken: string) {
  try {
    const orgsResponse = await axios.get(`${API_BASE_URL}/api/organizations/`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      withCredentials: true,
    });

    const organizations = orgsResponse.data?.results ?? orgsResponse.data;

    if (organizations && organizations.length > 0) {
      const firstOrg = organizations[0];
      localStorage.setItem('active_organization', JSON.stringify(firstOrg));

      if (firstOrg.default_sede && firstOrg.sedes) {
        const defaultSede = firstOrg.sedes.find((s: any) => s.id === firstOrg.default_sede);
        if (defaultSede) {
          localStorage.setItem('active_sede', JSON.stringify(defaultSede));
        }
      }
    }
  } catch (orgError) {
    logger.debug('Falha ao carregar organizacao inicial:', orgError);
  }
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      isAuthModalOpen: false,
      authModalView: 'login',

      openAuthModal: (view = 'login') =>
        set({ isAuthModalOpen: true, authModalView: view, error: null }),

      closeAuthModal: () => set({ isAuthModalOpen: false, error: null }),

      login: async (credentials) => {
        set({ isLoading: true, error: null });
        try {
          // Dispara login seguro com cookie HttpOnly de refresh token
          const response = await axios.post(
            `${API_BASE_URL}/api/auth/token/`,
            {
              username: credentials.username,
              password: credentials.password,
            },
            { withCredentials: true }
          );

          const { access, user: rawUser } = response.data;

          setInMemoryAccessToken(access);
          localStorage.setItem('access_token', access);
          // O refresh_token e gerenciado via Cookie HttpOnly seguro pelo backend

          let user: User;
          if (rawUser) {
            user = {
              id: rawUser.id,
              name: rawUser.name || rawUser.username,
              email: rawUser.email,
              avatar: rawUser.avatar,
              username: rawUser.username,
              role: rawUser.role || 'editor',
            };
          } else {
            const profileResponse = await axios.get(`${API_BASE_URL}/api/profile/`, {
              headers: { Authorization: `Bearer ${access}` },
              withCredentials: true,
            });
            const userData = profileResponse.data;
            user = {
              id: userData.id,
              name: userData.name || userData.username,
              email: userData.email,
              avatar: userData.avatar,
              username: userData.username,
              role: userData.role || 'viewer',
            };
          }

          await setupUserOrganizationContext(access);

          set({
            user,
            token: access,
            isAuthenticated: true,
            isLoading: false,
            isAuthModalOpen: false,
          });
        } catch (err: any) {
          setInMemoryAccessToken(null);
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');

          const errorMsg =
            err.response?.data?.error ||
            err.response?.data?.detail ||
            (err instanceof Error ? err.message : 'Credenciais invalidas');

          set({
            error: errorMsg,
            isLoading: false,
            user: null,
            token: null,
            isAuthenticated: false,
          });
          throw err;
        }
      },

      googleLogin: async (credential: string) => {
        set({ isLoading: true, error: null });
        try {
          const response = await axios.post(
            `${API_BASE_URL}/api/auth/google/`,
            { credential },
            { withCredentials: true }
          );

          const { access, user: rawUser } = response.data;

          setInMemoryAccessToken(access);
          localStorage.setItem('access_token', access);

          const user: User = {
            id: rawUser.id,
            name: rawUser.name || rawUser.username,
            email: rawUser.email,
            avatar: rawUser.avatar,
            username: rawUser.username,
            role: rawUser.role || 'editor',
          };

          await setupUserOrganizationContext(access);

          set({
            user,
            token: access,
            isAuthenticated: true,
            isLoading: false,
            isAuthModalOpen: false,
          });
        } catch (err: any) {
          setInMemoryAccessToken(null);
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');

          const errorMsg =
            err.response?.data?.error ||
            err.response?.data?.detail ||
            'Falha na autenticacao com o Google';

          set({
            error: errorMsg,
            isLoading: false,
            user: null,
            token: null,
            isAuthenticated: false,
          });
          throw err;
        }
      },

      silentRefresh: async () => {
        try {
          const response = await axios.post(
            `${API_BASE_URL}/api/auth/token/refresh/`,
            {},
            { withCredentials: true }
          );

          const { access, user: rawUser } = response.data;
          setInMemoryAccessToken(access);
          localStorage.setItem('access_token', access);

          let user = get().user;
          if (rawUser) {
            user = {
              id: rawUser.id,
              name: rawUser.name || rawUser.username,
              email: rawUser.email,
              avatar: rawUser.avatar,
              username: rawUser.username,
              role: rawUser.role || 'editor',
            };
          } else if (!user) {
            const profileResponse = await axios.get(`${API_BASE_URL}/api/profile/`, {
              headers: { Authorization: `Bearer ${access}` },
              withCredentials: true,
            });
            const userData = profileResponse.data;
            user = {
              id: userData.id,
              name: userData.name || userData.username,
              email: userData.email,
              avatar: userData.avatar,
              username: userData.username,
              role: userData.role || 'viewer',
            };
          }

          set({
            user,
            token: access,
            isAuthenticated: true,
          });
          return true;
        } catch {
          setInMemoryAccessToken(null);
          localStorage.removeItem('access_token');
          set({
            user: null,
            token: null,
            isAuthenticated: false,
          });
          return false;
        }
      },

      logout: async () => {
        try {
          await axios.post(
            `${API_BASE_URL}/api/auth/logout/`,
            {},
            { withCredentials: true }
          );
        } catch (e) {
          logger.debug('Logout endpoint falhou silenciosamente:', e);
        } finally {
          setInMemoryAccessToken(null);
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
          localStorage.removeItem('active_organization');
          localStorage.removeItem('active_sede');
          set({ user: null, token: null, isAuthenticated: false, isAuthModalOpen: true, authModalView: 'login' });
        }
      },

      checkAuth: async () => {
        const storedToken = localStorage.getItem('access_token');
        if (storedToken) {
          setInMemoryAccessToken(storedToken);
        }
        await get().silentRefresh();
      },

      clearError: () => set({ error: null }),

      autoLogin: async () => {
        if (!AUTO_LOGIN_ENABLED) return;
        if (autoLoginPromise) return autoLoginPromise;

        autoLoginPromise = (async () => {
          try {
            // Tenta primeiro refresh silencioso via cookie existente
            const refreshed = await get().silentRefresh();
            if (refreshed) return;

            // Caso contrario, utiliza o usuario padrao de desenvolvimento
            await get().login({
              username: DEFAULT_USER.username,
              password: DEFAULT_USER.password,
            });
          } catch {
            try {
              await get().register({
                username: DEFAULT_USER.username,
                email: DEFAULT_USER.email,
                password: DEFAULT_USER.password,
                role: DEFAULT_USER.role,
              });
            } catch (err) {
              if (import.meta.env.DEV) {
                console.error('[autoLogin] falha ao registrar usuario demo', err);
              }
            }
          } finally {
            autoLoginDone = true;
          }
        })();

        return autoLoginPromise;
      },

      register: async (credentials) => {
        set({ isLoading: true, error: null });
        try {
          const response = await axios.post(
            `${API_BASE_URL}/api/register/`,
            credentials,
            { withCredentials: true }
          );

          const { user: userData, access, organization, default_sede } = response.data;

          setInMemoryAccessToken(access);
          localStorage.setItem('access_token', access);

          if (organization) {
            localStorage.setItem('active_organization', JSON.stringify(organization));
          }
          if (default_sede) {
            localStorage.setItem('active_sede', JSON.stringify(default_sede));
          }

          const user: User = {
            id: userData.id,
            name: userData.first_name || userData.username,
            email: userData.email,
            avatar: userData.avatar,
            username: userData.username,
            role: userData.role || 'viewer',
          };

          set({
            user,
            token: access,
            isAuthenticated: true,
            isLoading: false,
            isAuthModalOpen: false,
          });
        } catch (err: any) {
          const errorMessage =
            err.response?.data?.error ||
            err.response?.data?.detail ||
            err.message ||
            'Erro ao registrar conta';
          set({
            error: errorMessage,
            isLoading: false,
          });
          throw err;
        }
      },

      requestPasswordReset: async (email: string) => {
        set({ isLoading: true, error: null });
        try {
          const response = await axios.post(
            `${API_BASE_URL}/api/auth/password-reset/`,
            { email }
          );
          set({ isLoading: false });
          return response.data;
        } catch (err: any) {
          const errorMessage =
            err.response?.data?.error ||
            err.response?.data?.detail ||
            err.message ||
            'Erro ao solicitar redefinicao de senha';
          set({ error: errorMessage, isLoading: false });
          throw err;
        }
      },

      confirmPasswordReset: async (payload: { uid: string; token: string; new_password: string }) => {
        set({ isLoading: true, error: null });
        try {
          const response = await axios.post(
            `${API_BASE_URL}/api/auth/password-reset/confirm/`,
            payload
          );
          set({ isLoading: false });
          return response.data;
        } catch (err: any) {
          const errorMessage =
            err.response?.data?.error ||
            err.response?.data?.detail ||
            err.message ||
            'Erro ao redefinir senha';
          set({ error: errorMessage, isLoading: false });
          throw err;
        }
      },
    }),
    {
      name: 'catana-auth-storage',
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);

// Listener global para tratar expiracao de sessao (HTTP 401) sem destruir a tela atual
if (typeof window !== 'undefined') {
  window.addEventListener('catana:unauthorized', () => {
    useAuthStore.getState().logout();
  });
}
