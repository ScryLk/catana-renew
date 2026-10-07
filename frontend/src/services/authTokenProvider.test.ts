import { beforeEach, expect, it, vi } from "vitest";
import { AxiosError, AxiosHeaders } from "axios";
import api from "./api";
import {
  configureAuthProvider,
  clearAuthRuntime,
  setTokenReady,
  setInMemoryAccessToken,
  getAuthToken,
  refreshAuthToken,
  authenticatedStreamingFetch,
  isTokenReady,
} from "./authTokenProvider";
beforeEach(() => {
  clearAuthRuntime();
  localStorage.clear();
  vi.restoreAllMocks();
});
it("cold Clerk boot emits no protected request even with a persisted legacy bearer", async () => {
  localStorage.setItem("access_token", "old");
  const adapter = vi.fn();
  api.defaults.adapter = adapter;
  configureAuthProvider("clerk", vi.fn(), "A");
  await expect(api.get("/api/brands/")).rejects.toThrow("Sessão indisponível");
  expect(adapter).not.toHaveBeenCalled();
});
it("shares a single forced refresh across brands, quotas and catalogs, retries each once", async () => {
  let release!: (token: string) => void;
  const fresh = new Promise<string>((resolve) => {
    release = resolve;
  });
  const getter = vi.fn(async (options?: { skipCache?: boolean }) =>
    options?.skipCache ? fresh : "expired",
  );
  configureAuthProvider("clerk", getter, "A");
  setTokenReady(true);
  setInMemoryAccessToken("expired");
  const calls: string[] = [];
  api.defaults.adapter = async (config) => {
    const auth = String(config.headers.Authorization);
    calls.push(`${config.url}:${auth}`);
    if (auth === "Bearer expired")
      throw new AxiosError("unauthorized", "401", config, undefined, {
        data: {},
        status: 401,
        statusText: "Unauthorized",
        headers: {},
        config,
      });
    return {
      data: [],
      status: 200,
      statusText: "OK",
      headers: new AxiosHeaders(),
      config,
    };
  };
  const results = Promise.all(
    ["/api/brands/", "/api/v2/studio/quotas/", "/api/v2/studio/catalogs/"].map(
      (url) => api.get(url),
    ),
  );
  await vi.waitFor(() =>
    expect(getter.mock.calls.filter((call) => call[0]?.skipCache)).toHaveLength(
      1,
    ),
  );
  release("fresh");
  await results;
  expect(calls).toHaveLength(6);
  expect(isTokenReady()).toBe(true);
});
it("a second 401 is recoverable and never falls back to SimpleJWT or loops", async () => {
  const getter = vi.fn().mockResolvedValue("bad");
  configureAuthProvider("clerk", getter, "A");
  setTokenReady(true);
  localStorage.setItem("refresh_token", "unrelated");
  const adapter = vi.fn(async (config) => {
    throw new AxiosError("unauthorized", "401", config, undefined, {
      data: {},
      status: 401,
      statusText: "Unauthorized",
      headers: {},
      config,
    });
  });
  api.defaults.adapter = adapter;
  await expect(api.get("/api/brands/")).rejects.toThrow("unauthorized");
  expect(adapter).toHaveBeenCalledTimes(2);
  expect(getter.mock.calls.filter((call) => call[0]?.skipCache)).toHaveLength(
    1,
  );
  expect(isTokenReady()).toBe(false);
});
it("stream auth retry preserves the request ID and never replays after SSE starts", async () => {
  const getter = vi.fn(async (options?: { skipCache?: boolean }) =>
    options?.skipCache ? "fresh" : "expired",
  );
  configureAuthProvider("clerk", getter, "A");
  setTokenReady(true);
  const fetcher = vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValueOnce(new Response("", { status: 401 }))
    .mockResolvedValueOnce(
      new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(
              new TextEncoder().encode('data: {"event":"start"}\n\n'),
            );
            controller.error(new Error("interrupted"));
          },
        }),
        { status: 200 },
      ),
    );
  const body = JSON.stringify({ client_request_id: "same-id" });
  const response = await authenticatedStreamingFetch("/chat", {
    method: "POST",
    body,
  });
  await expect(response.body!.getReader().read()).rejects.toThrow(
    "interrupted",
  );
  expect(fetcher).toHaveBeenCalledTimes(2);
  expect(fetcher.mock.calls.map((call) => call[1]?.body)).toEqual([body, body]);
});
it("drops refresh results from a previous identity", async () => {
  let release!: (token: string) => void;
  const pending = new Promise<string>((resolve) => {
    release = resolve;
  });
  configureAuthProvider("clerk", () => pending, "A");
  setTokenReady(true);
  const refreshing = refreshAuthToken();
  configureAuthProvider("clerk", async () => "B-token", "B");
  release("A-token");
  await expect(refreshing).rejects.toThrow("Sessão indisponível");
  expect(await getAuthToken()).toBeNull();
});
