import { logger } from '../utils/logger';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import axios from 'axios';
import { toast } from 'sonner';
import { setInMemoryAccessToken } from '../services/api';
import { useStudioStore } from './studioStore';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

const CLERK_PUBLISHABLE_KEY =
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY ||
  import.meta.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
export const isClerkConfigured =
  Boolean(CLERK_PUBLISHABLE_KEY) &&
  (CLERK_PUBLISHABLE_KEY.startsWith('pk_test_') || CLERK_PUBLISHABLE_KEY.startsWith('pk_live_')) &&
  !CLERK_PUBLISHABLE_KEY.includes('placeholder');

// Login automatico (conveniencia de dev - autenticacao nao exigida no momento).
// Desabilitado automaticamente quando o Clerk estiver configurado.
export const AUTO_LOGIN_ENABLED =
  !isClerkConfigured && (import.meta.env.VITE_AUTO_LOGIN ?? 'true') !== 'false';
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
  logout: (promptRelogin?: boolean) => Promise<void>;
  checkAuth: () => Promise<void>;
  silentRefresh: () => Promise<boolean>;
  clearError: () => void;
  register: (user: any) => Promise<void>;
  autoLogin: () => Promise<void>;
  syncClerkUser: (clerkUser: any, token: string | null) => Promise<void>;
  setClerkAuthSettled: () => void;
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

          const previousUserId = get().user?.id;
          if (previousUserId && previousUserId !== user.id) {
            useStudioStore.getState().resetStudioState();
          }
          useStudioStore.getState().setActiveUserId(user.id);

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

          const prevUid = get().user?.id;
          if (prevUid && prevUid !== user.id) {
            useStudioStore.getState().resetStudioState();
          }
          useStudioStore.getState().setActiveUserId(user.id);

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
          const storedRefresh = localStorage.getItem('refresh_token');
          const response = await axios.post(
            `${API_BASE_URL}/api/auth/token/refresh/`,
            { refresh: storedRefresh || undefined },
            { withCredentials: true }
          );

          const { access, refresh: newRefresh, user: rawUser } = response.data;
          setInMemoryAccessToken(access);
          localStorage.setItem('access_token', access);
          if (newRefresh) {
            localStorage.setItem('refresh_token', newRefresh);
          }

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
          if (user?.id) {
            useStudioStore.getState().setActiveUserId(user.id);
          }
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

      logout: async (promptRelogin = false) => {
        try {
          // Apenas dispara signOut no Clerk em logout explicito acionado pelo usuario,
          // evitando redirecionamentos e loops em caso de expiracao silenciosa
          if (!promptRelogin && typeof window !== 'undefined' && (window as any).Clerk?.signOut) {
            try {
              await (window as any).Clerk.signOut();
            } catch {
              // Silencioso
            }
          }
          const storedRefresh = localStorage.getItem('refresh_token');
          if (storedRefresh) {
            await axios.post(
              `${API_BASE_URL}/api/auth/logout/`,
              { refresh: storedRefresh },
              { withCredentials: true }
            ).catch(() => {});
          }
        } catch (e) {
          logger.debug('Logout endpoint falhou silenciosamente:', e);
        } finally {
          setInMemoryAccessToken(null);
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
          localStorage.removeItem('active_organization');
          localStorage.removeItem('active_sede');
          // Reseta completamente o estado do Studio na memória e remove chaves não-isoladas
          useStudioStore.getState().resetStudioState();
          set({
            user: null,
            token: null,
            isAuthenticated: false,
            isAuthModalOpen: promptRelogin,
            authModalView: 'login',
          });
          if (promptRelogin) {
            toast.error('Sessão expirada. Acesse sua conta novamente para continuar com segurança.', {
              id: 'catana-session-expired',
              duration: 8000,
            });
          }
        }
      },

      syncClerkUser: async (clerkUser: any, token: string | null) => {
        if (token) {
          setInMemoryAccessToken(token);
          localStorage.setItem('access_token', token);
        }
        const user: User = {
          id: typeof clerkUser.id === 'number' ? clerkUser.id : 1,
          name: clerkUser.fullName || clerkUser.firstName || 'Usuario',
          email: clerkUser.primaryEmailAddress?.emailAddress || '',
          avatar: clerkUser.imageUrl,
          username: clerkUser.username || (clerkUser.primaryEmailAddress?.emailAddress || '').split('@')[0],
          role: 'editor',
        };
        if (token) {
          setupUserOrganizationContext(token).catch(() => {});
        }
        const prevUid = get().user?.id;
        if (prevUid && prevUid !== user.id) {
          useStudioStore.getState().resetStudioState();
        }
        useStudioStore.getState().setActiveUserId(user.id);
        set({
          user,
          token: token || null,
          isAuthenticated: true,
          isLoading: false,
          isAuthModalOpen: false,
        });
        autoLoginDone = true;
      },

      setClerkAuthSettled: () => {
        autoLoginDone = true;
      },

      checkAuth: async () => {
        if (typeof window !== 'undefined' && (window as any).Clerk?.user) {
          try {
            const clerkUser = (window as any).Clerk.user;
            const clerkToken = await (window as any).Clerk.session?.getToken();
            if (clerkToken) {
              setInMemoryAccessToken(clerkToken);
              localStorage.setItem('access_token', clerkToken);
            }
            const user: User = {
              id: typeof clerkUser.id === 'number' ? clerkUser.id : 1,
              name: clerkUser.fullName || clerkUser.firstName || 'Usuario',
              email: clerkUser.primaryEmailAddress?.emailAddress || '',
              avatar: clerkUser.imageUrl,
              username: clerkUser.username || (clerkUser.primaryEmailAddress?.emailAddress || '').split('@')[0],
              role: 'editor',
            };
            if (clerkToken) {
              await setupUserOrganizationContext(clerkToken);
            }
            const prevUid = get().user?.id;
            if (prevUid && prevUid !== user.id) {
              useStudioStore.getState().resetStudioState();
            }
            useStudioStore.getState().setActiveUserId(user.id);
            set({
              user,
              token: clerkToken || null,
              isAuthenticated: true,
              isLoading: false,
            });
            autoLoginDone = true;
            return;
          } catch {
            // Continua para o fallback padrao
          }
        }

        // Se o Clerk estiver ativo e ainda carregando no browser, evita limpar tokens prematuramente
        if (isClerkConfigured) {
          return;
        }

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

          const prevUid = get().user?.id;
          if (prevUid && prevUid !== user.id) {
            useStudioStore.getState().resetStudioState();
          }
          useStudioStore.getState().setActiveUserId(user.id);

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

// Listener global para tratar expiracao de sessao (HTTP 401) e perda de conexao
if (typeof window !== 'undefined') {
  window.addEventListener('catana:unauthorized', () => {
    // Se o usuario estiver com sessao ativa no Clerk, ignora para evitar falsos positivos
    if ((window as any).Clerk?.session) {
      return;
    }
    useAuthStore.getState().logout(true);
  });

  window.addEventListener('offline', () => {
    toast.error('Conexão perdida. Verifique sua rede de internet.', {
      id: 'catana-offline-toast',
      duration: 6000,
    });
  });

  window.addEventListener('online', () => {
    toast.success('Conexão restabelecida!', {
      id: 'catana-online-toast',
      duration: 4000,
    });
    useAuthStore.getState().silentRefresh();
  });
}
