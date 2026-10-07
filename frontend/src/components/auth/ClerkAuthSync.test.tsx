import { beforeEach, expect, it, vi } from "vitest";
import axios from "axios";
import { initializeClerkSession } from "./ClerkAuthSync";
import { useAuthStore, isAuthReady } from "../../store/authStore";
import { clearAuthRuntime } from "../../services/authTokenProvider";
import { activeOrganizationKey } from "../../services/workspaceContext";
vi.mock("axios", async () => {
  const actual = await vi.importActual<typeof import("axios")>("axios");
  return {
    ...actual,
    default: { ...actual.default, get: vi.fn(), post: vi.fn() },
  };
});
beforeEach(() => {
  clearAuthRuntime();
  localStorage.clear();
  vi.clearAllMocks();
  useAuthStore.getState().setClerkAuthSettled();
});
it("StrictMode initialization is single flight; profile and membership precede readiness", async () => {
  let release!: (value: string) => void;
  const token = new Promise<string>((resolve) => {
    release = resolve;
  });
  const getter = vi.fn(() => token);
  vi.mocked(axios.get).mockImplementation(async (url) => ({
    data: String(url).endsWith("/profile/")
      ? { id: 27, username: "A", email: "a@test" }
      : [
          { id: 2, name: "A" },
          { id: 5, name: "B" },
        ],
  }));
  localStorage.setItem(activeOrganizationKey(27), "5");
  const first = initializeClerkSession({ id: "user_A" }, getter);
  const second = initializeClerkSession({ id: "user_A" }, getter);
  expect(first).toBe(second);
  expect(isAuthReady(useAuthStore.getState())).toBe(false);
  expect(axios.get).not.toHaveBeenCalled();
  release("jwt");
  await first;
  expect(getter).toHaveBeenCalledTimes(1);
  expect(axios.get).toHaveBeenCalledTimes(2);
  expect(useAuthStore.getState().user?.id).toBe(27);
  expect(useAuthStore.getState().activeOrganizationId).toBe(5);
  expect(localStorage.getItem("access_token")).toBeNull();
});
it("an account switch discards the old identity resolution", async () => {
  let release!: (value: unknown) => void;
  const oldProfile = new Promise((resolve) => {
    release = resolve;
  });
  vi.mocked(axios.get).mockImplementation(async (url) =>
    String(url).endsWith("/profile/")
      ? (oldProfile as never)
      : { data: [{ id: 9, name: "B" }] },
  );
  const first = initializeClerkSession({ id: "user_A" }, async () => "A");
  await Promise.resolve();
  await Promise.resolve();
  vi.mocked(axios.get).mockImplementation(async (url) => ({
    data: String(url).endsWith("/profile/")
      ? { id: 91, username: "B", email: "b@test" }
      : [{ id: 9, name: "B" }],
  }));
  await initializeClerkSession({ id: "user_B" }, async () => "B");
  release({ data: { id: 27, username: "A", email: "a@test" } });
  await first;
  expect(useAuthStore.getState().user?.id).toBe(91);
  expect(useAuthStore.getState().activeOrganizationId).toBe(9);
});
it("invalidates the previous profile while the next account's SDK token is still pending", async () => {
  let releaseProfile!: (value: unknown) => void;
  let releaseToken!: (value: string) => void;
  const oldProfile = new Promise((resolve) => { releaseProfile = resolve; });
  const nextToken = new Promise<string>((resolve) => { releaseToken = resolve; });
  vi.mocked(axios.get).mockImplementation(async (url) =>
    String(url).endsWith('/profile/') ? (oldProfile as never) : {data: [{id: 2, name: 'A'}]});
  const old = initializeClerkSession({id: 'user_A'}, async () => 'A');
  await Promise.resolve();
  await Promise.resolve();
  const next = initializeClerkSession({id: 'user_B'}, () => nextToken);
  releaseProfile({data: {id: 27, username: 'A', email: 'a@test'}});
  await old;
  expect(useAuthStore.getState().user).toBeNull();
  expect(isAuthReady(useAuthStore.getState())).toBe(false);
  vi.mocked(axios.get).mockImplementation(async (url) => ({data:
    String(url).endsWith('/profile/') ? {id: 91, username: 'B', email: 'b@test'} : [{id: 9, name: 'B'}]}));
  releaseToken('B');
  await next;
  expect(useAuthStore.getState().user?.id).toBe(91);
  expect(useAuthStore.getState().activeOrganizationId).toBe(9);
});
it('does not reuse a cancelled initialization when the same account signs in again', async () => {
  let release!: (value: string) => void;
  const pending = new Promise<string>(resolve => { release = resolve; });
  const old = initializeClerkSession({id: 'user_A'}, () => pending);
  useAuthStore.getState().setClerkAuthSettled();
  vi.mocked(axios.get).mockImplementation(async url => ({data:
    String(url).endsWith('/profile/') ? {id: 27, username: 'A', email: 'a@test'} : [{id: 2, name: 'A'}]}));
  const next = initializeClerkSession({id: 'user_A'}, async () => 'new');
  release('old');
  await Promise.all([old, next]);
  expect(next).not.toBe(old);
  expect(isAuthReady(useAuthStore.getState())).toBe(true);
  expect(useAuthStore.getState().user?.id).toBe(27);
});
