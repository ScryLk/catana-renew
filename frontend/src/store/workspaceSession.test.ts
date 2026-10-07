import { beforeEach, expect, it, vi } from "vitest";
import api from "../services/api";
import {
  useStudioStore,
  saveStoredProjectSession,
  getStoredProjectSession,
} from "./studioStore";
beforeEach(() => {
  localStorage.clear();
  useStudioStore.getState().resetStudioState();
  vi.restoreAllMocks();
});
it("separates the same user project between organizations", () => {
  localStorage.setItem("active_organization", JSON.stringify({ id: 2 }));
  saveStoredProjectSession(
    "33",
    {
      organization: 2,
      threads: [
        { id: "a", title: "A", mode: "director", createdAt: "", messages: [] },
      ],
      activeThreadId: "a",
    },
    27,
  );
  localStorage.setItem("active_organization", JSON.stringify({ id: 5 }));
  expect(getStoredProjectSession("33", 27)).toBeNull();
});
it("does not write a requested catalog hint or fall back to browser data on 401", async () => {
  localStorage.setItem("active_organization", JSON.stringify({ id: 2 }));
  useStudioStore.getState().setActiveUserId(27);
  vi.spyOn(api, "get").mockRejectedValue({ response: { status: 401 } });
  await useStudioStore.getState().loadExistingCatalog("55");
  expect(
    localStorage.getItem("katana_studio_last_active_catalog:27"),
  ).toBeNull();
  expect(useStudioStore.getState().hasStartedSession).toBe(false);
});

it("does not boot brands or catalog restore before token readiness", async () => {
  const requests = vi.spyOn(api, "get");
  await useStudioStore.getState().initializeWorkspace(27);
  expect(requests).not.toHaveBeenCalled();
});
it("ignores an untrusted legacy user-1 cache and validates the scoped hint against the active list", async () => {
  const { setTokenReady } = await import("../services/authTokenProvider");
  setTokenReady(true);
  localStorage.setItem("active_organization", JSON.stringify({ id: 9 }));
  localStorage.setItem("katana_studio_last_active_catalog:1", "33");
  localStorage.setItem("catana:studio:v2:91:9:last_active_catalog", "33");
  const requests = vi.spyOn(api, "get").mockResolvedValue({ data: [] });
  await useStudioStore.getState().initializeWorkspace(91);
  expect(
    requests.mock.calls.some((call) =>
      String(call[0]).includes("/catalogs/33/"),
    ),
  ).toBe(false);
  expect(
    localStorage.getItem("catana:studio:v2:91:9:last_active_catalog"),
  ).toBeNull();
  setTokenReady(false);
});
it("writes the active catalog only after success and clears only a scoped denied hint", async () => {
  localStorage.setItem("active_organization", JSON.stringify({ id: 2 }));
  useStudioStore.getState().setActiveUserId(27);
  const key = "catana:studio:v2:27:2:last_active_catalog";
  localStorage.setItem(key, "33");
  localStorage.setItem("catana:studio:v2:91:9:last_active_catalog", "88");
  const requests = vi
    .spyOn(api, "get")
    .mockRejectedValue({ response: { status: 401 } });
  await useStudioStore.getState().loadExistingCatalog("55");
  expect(localStorage.getItem(key)).toBe("33");
  requests.mockResolvedValue({
    data: {
      id: 55,
      organization: 2,
      title: "Authorized",
      total_pages: 1,
      spreads: [],
    },
  });
  await useStudioStore.getState().loadExistingCatalog("55");
  expect(localStorage.getItem(key)).toBe("55");
  requests.mockRejectedValue({ response: { status: 404 } });
  await useStudioStore.getState().loadExistingCatalog("55");
  expect(localStorage.getItem(key)).toBeNull();
  expect(
    localStorage.getItem("catana:studio:v2:91:9:last_active_catalog"),
  ).toBe("88");
});
it("late organization-A detail never overwrites organization B", async () => {
  localStorage.setItem("active_organization", JSON.stringify({ id: 2 }));
  useStudioStore.getState().setActiveUserId(27);
  let release!: (value: unknown) => void;
  const pending = new Promise((resolve) => {
    release = resolve;
  });
  vi.spyOn(api, "get").mockReturnValue(pending as never);
  const loading = useStudioStore.getState().loadExistingCatalog("33");
  localStorage.setItem("active_organization", JSON.stringify({ id: 5 }));
  useStudioStore.getState().setActiveUserId(27);
  release({ data: { id: 33, organization: 2, title: "Old", spreads: [] } });
  await loading;
  expect(useStudioStore.getState().activeOrganizationId).toBe(5);
  expect(useStudioStore.getState().activeCatalogId).toBeNull();
});
