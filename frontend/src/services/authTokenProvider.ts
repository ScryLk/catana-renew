import axios from "axios";
import { authProviderMode, type AuthProviderMode } from "./authConfig";
export class AuthNotReadyError extends Error {
  constructor() {
    super("Sessão indisponível. Tente acessar sua conta novamente.");
    this.name = "AuthNotReadyError";
  }
}
type ClerkTokenGetter = (options?: {
  skipCache?: boolean;
}) => Promise<string | null>;
let mode: AuthProviderMode = authProviderMode;
let token: string | null = null;
let clerkGetter: ClerkTokenGetter | null = null;
let ready = false;
let epoch = 0;
let refreshFlight: Promise<string> | null = null;
export const getAuthEpoch = () => epoch;
export function invalidateAuthRequests() {
  epoch++;
  refreshFlight = null;
}
export const getAuthProvider = () => mode;
export const isTokenReady = () => ready;
export const getInMemoryAccessToken = () => token;
export function setInMemoryAccessToken(value: string | null) {
  token = value;
}
export function configureAuthProvider(
  provider: AuthProviderMode,
  getter?: ClerkTokenGetter,
  subject?: string,
) {
  const identity = `${provider}:${subject || ""}`;
  if (identity !== currentIdentity) {
    clearAuthRuntime();
    currentIdentity = identity;
  }
  mode = provider;
  clerkGetter = getter || null;
  if (provider === "clerk") {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
  }
}
let currentIdentity = `${mode}:`;
export function setTokenReady(value: boolean) {
  ready = value;
}
export function clearAuthRuntime() {
  epoch++;
  ready = false;
  token = null;
  clerkGetter = null;
  refreshFlight = null;
}
function signal(status: string) {
  console.info('auth_status',{provider:mode,status});
  window.dispatchEvent(
    new CustomEvent("catana:auth-status", { detail: { status } }),
  );
}
export function authFailure() {
  ready = false;
  token = null;
  signal("error");
}
export async function getAuthToken(
  forceRefresh = false,
): Promise<string | null> {
  if (forceRefresh) {
    try {
      return await refreshAuthToken();
    } catch {
      return null;
    }
  }
  if (!ready) return null;
  if (mode === "clerk") {
    if (!clerkGetter) return null;
    const captured = epoch;
    try {
      const fresh = await clerkGetter();
      if (captured !== epoch) throw new AuthNotReadyError();
      if(!fresh) authFailure();
      token = fresh;
      return fresh;
    } catch {
      if(captured===epoch) authFailure();
      return null;
    }
  }
  return mode === "legacy" ? token : null;
}
export function refreshAuthToken(failedToken?: string | null): Promise<string> {
  if (refreshFlight) return refreshFlight;
  if (failedToken && token && token !== failedToken)
    return Promise.resolve(token);
  const captured = epoch;
  const getter = clerkGetter;
  const established=ready;
  if(established) signal("refreshing");
  const flight = (async () => {
    let fresh: string | null = null;
    if (mode === "clerk") {
      if (!getter) throw new AuthNotReadyError();
      fresh = await getter({ skipCache: true });
    } else if (mode === "legacy") {
      const base =
        import.meta.env.VITE_API_BASE_URL ||
        (import.meta.env.DEV ? "http://localhost:8000" : "");
      const response = await axios.post(
        `${base}/api/auth/token/refresh/`,
        { refresh: localStorage.getItem("refresh_token") || undefined },
        { withCredentials: true },
      );
      fresh = response.data.access;
      if (captured === epoch) localStorage.removeItem("refresh_token");
    }
    if (!fresh || captured !== epoch) throw new AuthNotReadyError();
    token = fresh;
    if (mode === "legacy") localStorage.setItem("access_token", fresh);
    if(established) signal("ready");
    return fresh;
  })()
    .catch((error) => {
      if (captured === epoch) authFailure();
      throw error;
    })
    .finally(() => {
      if (refreshFlight === flight) refreshFlight = null;
    });
  refreshFlight = flight;
  return flight;
}
export async function authenticatedStreamingFetch(
  url: string,
  init: RequestInit,
): Promise<Response> {
  const captured = epoch;
  const originalToken = await getAuthToken();
  if (!originalToken || !ready || captured !== epoch)
    throw new AuthNotReadyError();
  const send = (bearer: string) =>
    fetch(url, {
      ...init,
      credentials: "include",
      headers: {
        ...Object.fromEntries(new Headers(init.headers)),
        Authorization: `Bearer ${bearer}`,
      },
    });
  let response = await send(originalToken);
  if (captured !== epoch) {
    await response.body?.cancel();
    throw new AuthNotReadyError();
  }
  if (response.status === 401) {
    await response.body?.cancel();
    const fresh = await refreshAuthToken(originalToken);
    if (captured !== epoch) throw new AuthNotReadyError();
    response = await send(fresh);
  }
  if (captured !== epoch) {
    await response.body?.cancel();
    throw new AuthNotReadyError();
  }
  if (response.status === 401) authFailure();
  return response; // Never replay after the caller starts reading SSE data.
}
