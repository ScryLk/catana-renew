import { useEffect } from 'react';
import { useUser, useAuth } from '@clerk/clerk-react';
import { useAuthStore, isAuthReady, invalidateIdentityResolution } from '../../store/authStore';
import {
  configureAuthProvider,
  getAuthEpoch
} from '../../services/authTokenProvider';
import { clearWorkspaceContext } from '../../services/workspaceContext';
import { useStudioStore } from '../../store/studioStore';
let flight: { subject: string; epoch: number; promise: Promise<void> } | null = null;
export function initializeClerkSession(
  user: { id: string },
  getToken: (options?: { skipCache?: boolean }) => Promise<string | null>
) {
  if (flight?.subject === user.id && flight.epoch === getAuthEpoch()) return flight.promise;
  const auth = useAuthStore.getState();
  if (auth.user?.externalAuthId === user.id && isAuthReady(auth))
    return Promise.resolve();
  invalidateIdentityResolution();
  configureAuthProvider('clerk', getToken, user.id);
  clearWorkspaceContext();
  useStudioStore.getState().resetStudioState();
  useAuthStore.setState({
    user: null,
    token: null,
    isAuthenticated: false,
    activeOrganizationId: null,
    authStatus: 'loading',
    isLoading: true
  });
  const epoch = getAuthEpoch();
  const promise = (async () => {
    let token: string | null = null;
    try {
      token = await getToken();
    } catch {
      /* sync reports a controlled error. */
    }
    if (epoch === getAuthEpoch())
      await useAuthStore.getState().syncClerkUser(user, token);
  })().finally(() => {
    if (flight?.promise === promise) flight = null;
  });
  flight = { subject: user.id, epoch, promise };
  return promise;
}
export const ClerkAuthSync = () => {
  const { isLoaded, isSignedIn, user } = useUser();
  const { getToken } = useAuth();
  const authStatus = useAuthStore(state => state.authStatus);
  useEffect(() => {
    if (!isLoaded) return;
    if (isSignedIn && user) void initializeClerkSession(user, getToken);
    else useAuthStore.getState().setClerkAuthSettled();
  }, [isLoaded, isSignedIn, user?.id, getToken]);
  return authStatus === 'error' ? (
    <div
      role="alert"
      className="fixed bottom-4 left-4 z-50 rounded bg-zinc-900 p-3 text-white"
    >
      Não foi possível verificar sua sessão.{' '}
      <button
        onClick={() => {
          if (user) void initializeClerkSession(user, getToken);
        }}
      >
        Tentar novamente
      </button>
    </div>
  ) : null;
};
