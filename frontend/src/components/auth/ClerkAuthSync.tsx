import React, { useEffect, useRef } from 'react';
import { useUser, useAuth } from '@clerk/clerk-react';
import { useAuthStore } from '../../store/authStore';
import { setInMemoryAccessToken } from '../../services/api';

export const ClerkAuthSync: React.FC = () => {
  const { isLoaded, isSignedIn, user } = useUser();
  const { getToken } = useAuth();
  const { syncClerkUser, setClerkAuthSettled } = useAuthStore();
  const syncedUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isLoaded) return;

    if (isSignedIn && user) {
      if (syncedUserIdRef.current !== user.id) {
        syncedUserIdRef.current = user.id;
        getToken().then((token) => {
          syncClerkUser(user, token || null);
        }).catch((err) => {
          console.error('[ClerkAuthSync] Falha ao obter token do Clerk:', err);
          syncClerkUser(user, null);
        });
      }
    } else {
      syncedUserIdRef.current = null;
      setClerkAuthSettled();
    }
  }, [isLoaded, isSignedIn, user, getToken, syncClerkUser, setClerkAuthSettled]);

  // Renovacao proativa e silenciosa do JWT a cada 45 segundos para evitar expiracao do token de 60s
  useEffect(() => {
    if (!isLoaded || !isSignedIn || !user) return;

    const refreshTimer = setInterval(async () => {
      try {
        const freshToken = await getToken();
        if (freshToken) {
          setInMemoryAccessToken(freshToken);
          localStorage.setItem('access_token', freshToken);
        }
      } catch {
        // Silencioso em caso de oscilacao de rede
      }
    }, 45000);

    return () => clearInterval(refreshTimer);
  }, [isLoaded, isSignedIn, user, getToken]);

  return null;
};
