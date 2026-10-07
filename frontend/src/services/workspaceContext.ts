import { invalidateAuthRequests } from "./authTokenProvider";
import type { Organization, Sede } from "../types/api";
let userId: number | null = null;
let organizations: Organization[] = [];
let organizationId: number | null = null;
export const activeOrganizationKey = (id: number) =>
  `catana:auth:v2:user:${id}:activeOrganization`;
export const getContextUserId = () => userId;
export const getContextOrganizationId = () => organizationId;
export const workspaceKey = (
  user: string | number | null | undefined,
  org: number | null | undefined,
  key: string,
) => `catana:studio:v2:${user ?? "anonymous"}:${org ?? "none"}:${key}`;
export function clearWorkspaceContext() {
  userId = null;
  organizations = [];
  organizationId = null;
  localStorage.removeItem("active_organization");
  localStorage.removeItem("active_sede");
}
export function selectOrganization(org: Organization | null) {
  if (org && (!userId || !organizations.some((item) => item.id === org.id)))
    throw new Error("Organização não autorizada.");
  if (organizationId !== (org?.id ?? null)) invalidateAuthRequests();
  organizationId = org?.id ?? null;
  if (org && userId) {
    localStorage.setItem(activeOrganizationKey(userId), String(org.id));
    localStorage.setItem("active_organization", JSON.stringify(org));
    const sede = org.sedes?.find((s) => s.id === org.default_sede);
    selectSede(sede || null);
  } else {
    localStorage.removeItem("active_organization");
    localStorage.removeItem("active_sede");
  }
  window.dispatchEvent(
    new CustomEvent("catana:organization-changed", {
      detail: { userId, organizationId },
    }),
  );
}
export function selectSede(sede: Sede | null) {
  if (sede) localStorage.setItem("active_sede", JSON.stringify(sede));
  else localStorage.removeItem("active_sede");
}
export function resolveWorkspaceContext(
  id: number,
  authorized: Organization[],
) {
  const previous = userId === id ? organizationId : null;
  userId = id;
  organizations = authorized;
  const hint =
    previous ?? Number(localStorage.getItem(activeOrganizationKey(id)));
  const org = authorized.find((o) => o.id === hint) || authorized[0] || null;
  selectOrganization(org);
  return org?.id ?? null;
}

export function authorizeCreatedOrganization(org: Organization) {
  if(userId && !organizations.some(item=>item.id===org.id)) organizations=[...organizations,org];
}
