import type { TenantRole } from "@cs/shared";
import { getSession } from "./api";

export function currentRole(): TenantRole {
  const s = getSession();
  if (!s) return "agent";
  const t = s.tenants.find((x) => x.id === s.tenantId) ?? s.tenants[0];
  return (t?.role as TenantRole) ?? "agent";
}

export function isManager(role?: TenantRole) {
  const r = role ?? currentRole();
  return r === "owner" || r === "admin";
}

/** Nav hrefs agents may open. Managers see all. */
export const AGENT_NAV = new Set([
  "/dashboard",
  "/inbox",
  "/orders",
  "/bookings",
  "/team",
  "/settings",
]);

export function canAccessPath(href: string, role?: TenantRole) {
  if (isManager(role)) return true;
  return AGENT_NAV.has(href);
}
