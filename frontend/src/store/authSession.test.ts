import { beforeEach, expect, it, vi } from "vitest";
import axios from "axios";
import { useAuthStore } from "./authStore";
import { getAuthToken } from "../services/api";
import {
  configureAuthProvider,
  clearAuthRuntime,
  setTokenReady,
} from "../services/authTokenProvider";
vi.mock("axios", async () => {
  const actual = await vi.importActual<typeof import("axios")>("axios");
  return {
    ...actual,
    default: { ...actual.default, get: vi.fn(), post: vi.fn() },
  };
});
beforeEach(() => {
  localStorage.clear();
  clearAuthRuntime();
  vi.clearAllMocks();
  useAuthStore.setState({ user: null, isAuthenticated: false });
});
it("resolves Clerk string identity to the real backend ID and does not persist its JWT", async () => {
  vi.mocked(axios.get).mockImplementation(async (url) => ({
    data: String(url).endsWith("/profile/")
      ? { id: 27, username: "a", email: "a@test" }
      : [{ id: 2, name: "A" }],
  }));
  await useAuthStore.getState().syncClerkUser({ id: "user_A" }, "clerk-jwt");
  expect(useAuthStore.getState().user?.id).toBe(27);
  expect(localStorage.getItem("access_token")).toBeNull();
});
it("does not restore authorization from persisted UI state", async () => {
  localStorage.setItem(
    "catana-auth-storage",
    JSON.stringify({
      state: { user: { id: 1 }, isAuthenticated: true },
      version: 0,
    }),
  );
  await useAuthStore.persist.rehydrate();
  expect(useAuthStore.getState().isAuthenticated).toBe(false);
});
it("does not fall back to a legacy token while Clerk acquisition fails", async () => {
  localStorage.setItem("access_token", "old-legacy");
  configureAuthProvider(
    "clerk",
    vi.fn().mockRejectedValue(new Error("not ready")),
    "user_A",
  );
  setTokenReady(true);
  expect(await getAuthToken()).toBeNull();
  Object.assign(window, { Clerk: undefined });
});
it('failed recovery preserves the established identity and workspace instead of auto-login or user replacement',async()=>{
 const {useStudioStore}=await import('./studioStore');
 configureAuthProvider('legacy');setTokenReady(true);
 useAuthStore.setState({user:{id:27,name:'A',email:'a@test'},authStatus:'ready',isAuthenticated:true});
 useStudioStore.setState({activeUserId:27,activeOrganizationId:2,activeCatalogId:'33',catalogTitle:'Unsaved A'});
 vi.mocked(axios.post).mockRejectedValue(new Error('offline'));
 await useAuthStore.getState().checkAuth();
 expect(useAuthStore.getState().user?.id).toBe(27);expect(useAuthStore.getState().authStatus).toBe('error');
 expect(useStudioStore.getState().catalogTitle).toBe('Unsaved A');expect(axios.post).toHaveBeenCalledTimes(1);
});
