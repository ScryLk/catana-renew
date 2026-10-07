import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import axios from 'axios';
import { toast } from 'sonner';
import { API_BASE_URL } from '../services/api';
import {
  isClerkConfigured,
  authProviderMode,
  type AuthProviderMode
} from '../services/authConfig';
import {
  configureAuthProvider,
  setInMemoryAccessToken,
  setTokenReady,
  clearAuthRuntime,
  refreshAuthToken,
  AuthNotReadyError,
  getAuthProvider
} from '../services/authTokenProvider';
import {
  clearWorkspaceContext,
  resolveWorkspaceContext
} from '../services/workspaceContext';
import { useStudioStore } from './studioStore';
export { isClerkConfigured };
export type AuthStatus =
  | 'unknown'
  | 'loading'
  | 'signed_out'
  | 'resolving_identity'
  | 'ready'
  | 'refreshing'
  | 'error';
export interface User {
  id: number;
  externalAuthId?: string;
  name: string;
  email: string;
  avatar?: string;
  username?: string;
  role?: 'admin' | 'editor' | 'viewer';
}
interface BackendProfile {
  id: number;
  name?: string;
  first_name?: string;
  username: string;
  email: string;
  avatar?: string;
  role?: User['role'];
}
interface ClerkIdentity {
  id: string;
}
interface Credentials {
  username: string;
  password: string;
}
interface AuthStore {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  authStatus: AuthStatus;
  authProvider: AuthProviderMode;
  activeOrganizationId: number | null;
  isLoading: boolean;
  error: string | null;
  isAuthModalOpen: boolean;
  authModalView: 'login' | 'register' | 'forgot-password';
  openAuthModal: (view?: AuthStore['authModalView']) => void;
  closeAuthModal: () => void;
  clearError: () => void;
  login: (credentials: Credentials) => Promise<void>;
  googleLogin: (credential: string) => Promise<void>;
  register: (credentials: Record<string, unknown>) => Promise<void>;
  logout: (promptRelogin?: boolean) => Promise<void>;
  checkAuth: () => Promise<void>;
  silentRefresh: () => Promise<boolean>;
  autoLogin: () => Promise<void>;
  syncClerkUser: (user: ClerkIdentity, token: string | null) => Promise<void>;
  setClerkAuthSettled: () => void;
  requestPasswordReset: (email: string) => Promise<{ message: string }>;
  confirmPasswordReset: (payload: {
    uid: string;
    token: string;
    new_password: string;
  }) => Promise<{ message: string }>;
}
export const isAuthReady = (state: Pick<AuthStore, 'authStatus'>) =>
  state.authStatus === 'ready' || state.authStatus === 'refreshing';
export const AUTO_LOGIN_ENABLED =
  !import.meta.env.PROD &&
  authProviderMode === 'legacy' &&
  (import.meta.env.VITE_AUTO_LOGIN ?? 'true') !== 'false';
let settled = false;
export const isAutoLoginSettled = () => settled || !AUTO_LOGIN_ENABLED;
let initialization: Promise<void> | null = null;
let clerkFlight: { subject: string; promise: Promise<void> } | null = null;
let identityEpoch = 0;
let externalSubject: string | null = null;
export function invalidateIdentityResolution() {
  identityEpoch++;
  externalSubject = null;
  clerkFlight = null;
}
function resetIdentity() {
  invalidateIdentityResolution();
  clearAuthRuntime();
  clearWorkspaceContext();
  useStudioStore.getState().resetStudioState();
}
export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => {
      const resolveIdentity = async (
        access: string,
        epoch: number,
        externalAuthId?: string
      ) => {
        if (!access) throw new AuthNotReadyError();
        setInMemoryAccessToken(access);
        const headers = { Authorization: `Bearer ${access}` };
        const { data: profile } = await axios.get<BackendProfile>(
          `${API_BASE_URL}/api/profile/`,
          { headers, withCredentials: true }
        );
        if (epoch !== identityEpoch) return;
        if (!Number.isInteger(profile.id) || profile.id <= 0)
          throw new Error('Identidade Catana inválida.');
        const { data } = await axios.get(`${API_BASE_URL}/api/organizations/`, {
          headers,
          withCredentials: true
        });
        if (epoch !== identityEpoch) return;
        const organizations = Array.isArray(data) ? data : data.results;
        if (!Array.isArray(organizations))
          throw new Error('Não foi possível resolver suas organizações.');
        const user: User = {
          ...profile,
          name: profile.name || profile.first_name || profile.username,
          externalAuthId
        };
        const activeOrganizationId = resolveWorkspaceContext(
          user.id,
          organizations
        );
        useStudioStore.getState().setActiveUserId(user.id);
        setTokenReady(true);
        set({
          user,
          token: access,
          isAuthenticated: true,
          authStatus: 'ready',
          activeOrganizationId,
          isLoading: false,
          isAuthModalOpen: false,
          error: null
        });
        settled = true;
      };
      const legacyLogin = async (path: string, payload: unknown) => {
        if (authProviderMode === 'clerk') throw new AuthNotReadyError();
        resetIdentity();
        configureAuthProvider('legacy');
        const epoch = identityEpoch;
        set({
          user: null,
          token: null,
          isAuthenticated: false,
          activeOrganizationId: null,
          authStatus: 'loading',
          isLoading: true,
          error: null
        });
        try {
          const { data } = await axios.post(`${API_BASE_URL}${path}`, payload, {
            withCredentials: true
          });
          if (epoch !== identityEpoch) return;
          localStorage.setItem('access_token', data.access);
          await resolveIdentity(data.access, epoch);
        } catch (error) {
          if (epoch === identityEpoch)
            set({
              authStatus: 'error',
              isLoading: false,
              error: 'Não foi possível acessar sua conta.'
            });
          throw error;
        }
      };
      return {
        user: null,
        token: null,
        isAuthenticated: false,
        authStatus: 'unknown',
        authProvider: authProviderMode,
        activeOrganizationId: null,
        isLoading: false,
        error: null,
        isAuthModalOpen: false,
        authModalView: 'login',
        openAuthModal: (view = 'login') =>
          set({ isAuthModalOpen: true, authModalView: view, error: null }),
        closeAuthModal: () => set({ isAuthModalOpen: false, error: null }),
        clearError: () => set({ error: null }),
        login: credentials => legacyLogin('/api/auth/token/', credentials),
        googleLogin: credential =>
          legacyLogin('/api/auth/google/', { credential }),
        register: credentials => legacyLogin('/api/register/', credentials),
        silentRefresh: async () => {
          if (authProviderMode === 'clerk') return false;
          const epoch = identityEpoch;
          try {
            const access = await refreshAuthToken();
            await resolveIdentity(access, epoch);
            return epoch === identityEpoch;
          } catch {
        if(epoch===identityEpoch) {
          if(get().user) {
            set({authStatus:'error',isLoading:false,error:'Sua sessão está indisponível. Verifique a conexão e tente novamente.'});
          } else {
            resetIdentity();
            set({user:null,token:null,isAuthenticated:false,activeOrganizationId:null,authStatus:'signed_out',isLoading:false});
          }
        }
        return false;
          }
        },
        checkAuth: () => {
          if (authProviderMode === 'clerk') return Promise.resolve();
          if (initialization) return initialization;
          set({ authStatus: 'loading', isLoading: true });
          configureAuthProvider('legacy');
          initialization = (async () => {
            const success = await get().silentRefresh();
            if (!success && AUTO_LOGIN_ENABLED && !get().user) await get().autoLogin();
          })().finally(() => {
            settled = true;
            initialization = null;
          });
          return initialization;
        },
        autoLogin: async () => {
          if (!AUTO_LOGIN_ENABLED) return;
          const credentials = {
            username: import.meta.env.VITE_DEFAULT_USER || 'demo',
            password: import.meta.env.VITE_DEFAULT_PASSWORD || 'demo12345'
          };
          try {
            await get().login(credentials);
          } catch {
            try {
              await get().register({
                ...credentials,
                email: 'demo@catana.dev',
                role: 'admin'
              });
            } catch {
              /* Auth remains recoverable. */
            }
          }
          settled = true;
        },
        syncClerkUser: (clerkUser, access) => {
          if (getAuthProvider() !== 'clerk') configureAuthProvider('clerk');
          if (clerkFlight?.subject === clerkUser.id) return clerkFlight.promise;
          if (externalSubject === clerkUser.id && isAuthReady(get()))
            return Promise.resolve();
          if (externalSubject !== clerkUser.id) {
            identityEpoch++;
            clearWorkspaceContext();
            useStudioStore.getState().resetStudioState();
          }
          externalSubject = clerkUser.id;
          const epoch = identityEpoch;
          set({
            user: null,
            token: null,
            isAuthenticated: false,
            activeOrganizationId: null,
            authProvider: 'clerk',
            authStatus: 'resolving_identity',
            isLoading: true,
            error: null
          });
          const promise = resolveIdentity(access || '', epoch, clerkUser.id)
            .catch(() => {
              if (epoch === identityEpoch) {
                setTokenReady(false);
                set({
                  authStatus: 'error',
                  isLoading: false,
                  error:
                    'Não foi possível verificar sua sessão. Tente novamente.'
                });
              }
            })
            .finally(() => {
              if (clerkFlight?.promise === promise) clerkFlight = null;
              settled = true;
            });
          clerkFlight = { subject: clerkUser.id, promise };
          return promise;
        },
        setClerkAuthSettled: () => {
          resetIdentity();
          settled = true;
          set({
            user: null,
            token: null,
            isAuthenticated: false,
            activeOrganizationId: null,
            authStatus: 'signed_out',
            isLoading: false
          });
        },
        logout: async (promptRelogin = false) => {
          const mode = get().authProvider;
          resetIdentity();
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
          set({
            user: null,
            token: null,
            isAuthenticated: false,
            activeOrganizationId: null,
            authStatus: 'signed_out',
            isLoading: false,
            isAuthModalOpen: promptRelogin
          });
          if (mode === 'clerk') {
            const clerk = (
              window as unknown as { Clerk?: { signOut: () => Promise<void> } }
            ).Clerk;
            if (!promptRelogin) await clerk?.signOut();
          } else
            await axios
              .post(
                `${API_BASE_URL}/api/auth/logout/`,
                {},
                { withCredentials: true }
              )
              .catch(() => {});
          if (promptRelogin)
            toast.error('Sessão expirada. Acesse sua conta novamente.');
        },
        requestPasswordReset: async email =>
          (
            await axios.post(`${API_BASE_URL}/api/auth/password-reset/`, {
              email
            })
          ).data,
        confirmPasswordReset: async payload =>
          (
            await axios.post(
              `${API_BASE_URL}/api/auth/password-reset/confirm/`,
              payload
            )
          ).data
      };
    },
    {
      name: 'catana-auth-storage',
      version: 2,
      partialize: () => ({}),
      migrate: () => ({}),
      merge: (_persisted, current) => current
    }
  )
);
if (typeof window !== 'undefined') {
  window.addEventListener('catana:auth-status', event => {
    const status = (event as CustomEvent).detail.status as AuthStatus;
    if (status === 'ready' && !useAuthStore.getState().user) return;
    useAuthStore.setState({
      authStatus: status,
      ...(status === 'error'
        ? { error: 'Sua sessão precisa ser verificada novamente.' }
        : {})
    });
  });
  window.addEventListener('catana:organization-changed', event => {
    const { organizationId } = (event as CustomEvent).detail;
    const user = useAuthStore.getState().user;
    useAuthStore.setState({ activeOrganizationId: organizationId });
    if (user) useStudioStore.getState().setActiveUserId(user.id);
  });
  window.addEventListener('catana:unauthorized', () => {
    setTokenReady(false);
    useAuthStore.setState({
      authStatus: 'error',
      error: 'Sua sessão expirou. Tente novamente.'
    });
  });
  window.addEventListener('online', () => {
    if (useAuthStore.getState().user) {
      if (useAuthStore.getState().authProvider === 'clerk')
        void refreshAuthToken().catch(() => {});
      else void useAuthStore.getState().silentRefresh();
    }
  });
}
