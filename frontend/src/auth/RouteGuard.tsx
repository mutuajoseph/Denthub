import type { ReactNode } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";

import { type AuthUser, getStoredAuth } from "../lib/auth";
import {
  ADMIN_ROLES,
  FACILITY_ROLES,
  OPERATIONS_ROLES,
  PUBLIC_ROLES,
  type Role,
  SUPPLIER_ROLES,
  TRAINING_PROVIDER_ROLES,
  getDashboardPath,
  isStaffRole,
  normalizeRole,
  roleMatches,
} from "./roles";

export const GUARD_SCOPE_ROLES = {
  public: PUBLIC_ROLES,
  facility: FACILITY_ROLES,
  supplier: SUPPLIER_ROLES,
  training: TRAINING_PROVIDER_ROLES,
  admin: ADMIN_ROLES,
  operations: OPERATIONS_ROLES,
} as const;

export type GuardScope = keyof typeof GUARD_SCOPE_ROLES;
export type RouteGuardScope = GuardScope;

export type RouteGuardProps = {
  children?: ReactNode;
  user?: AuthUser | null;
  scope?: GuardScope;
  allowedRoles?: readonly Role[];
  requiredRoles?: readonly Role[];
  signInPath?: string;
  staffAccessPath?: string;
  /**
   * Where to send a signed-in user who is missing the required role. Defaults to
   * the user's canonical dashboard, falling back to "/" when that would loop.
   * Set it to a known-working page (e.g. "/") when the canonical dashboards for
   * the excluded roles are not routed yet, so the redirect never hits NotFound.
   */
  unauthorizedPath?: string;
};

function canonicalRoles(roles: readonly Role[], scope: GuardScope): readonly Role[] {
  const configuredRoles = roles.length > 0 ? roles : GUARD_SCOPE_ROLES[scope];

  return configuredRoles
    .map((role) => normalizeRole(role))
    .filter((role): role is Role => role !== null);
}

function usesStaffAccess(roles: readonly Role[]): boolean {
  return roles.length > 0 && roles.every((role) => isStaffRole(role));
}

function safeInternalPath(path: string, fallback: string): string {
  if (path.startsWith("/") && !path.startsWith("//") && !path.includes("\\")) {
    return path;
  }

  return fallback;
}

function samePath(left: string, right: string): boolean {
  const normalize = (path: string) => {
    const pathname = path.split(/[?#]/, 1)[0] || "/";
    return pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  };

  return normalize(left) === normalize(right);
}

function attemptedUrl(pathname: string, search: string, hash: string): string {
  return `${pathname}${search}${hash}`;
}

export default function RouteGuard({
  children,
  user,
  scope = "public",
  allowedRoles,
  requiredRoles,
  signInPath = "/sign-in",
  staffAccessPath = "/staff/access",
  unauthorizedPath,
}: RouteGuardProps) {
  const location = useLocation();
  const currentUser = user === undefined ? (getStoredAuth()?.user ?? null) : user;
  const requestedRoles = allowedRoles ?? requiredRoles ?? [];
  const roles = canonicalRoles(requestedRoles, scope);
  const attempted = attemptedUrl(location.pathname, location.search, location.hash);

  if (!currentUser) {
    const target = usesStaffAccess(roles)
      ? safeInternalPath(staffAccessPath, "/staff/access")
      : safeInternalPath(signInPath, "/sign-in");

    return (
      <Navigate
        to={target}
        replace
        state={{
          from: location,
          returnTo: attempted,
          reason: "unauthenticated",
        }}
      />
    );
  }

  if (!roleMatches(currentUser, roles)) {
    const dashboardPath = getDashboardPath(currentUser);
    const target = unauthorizedPath
      ? safeInternalPath(unauthorizedPath, "/")
      : dashboardPath && !samePath(dashboardPath, location.pathname)
        ? dashboardPath
        : "/";

    return (
      <Navigate
        to={target}
        replace
        state={{
          from: location,
          returnTo: attempted,
          reason: "unauthorized",
        }}
      />
    );
  }

  return children === undefined ? <Outlet /> : children;
}
