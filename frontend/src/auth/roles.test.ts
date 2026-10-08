import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getStoredAuth, register } from "../lib/auth";
import {
  CANONICAL_ROLES,
  DASHBOARD_PATHS,
  ROLE,
  getDashboardPath,
  isFacilityRole,
  isStaffUser,
  isSupplierRole,
  isTrainingProviderRole,
  normalizeRole,
  roleMatches,
} from "./roles";

describe("canonical roles", () => {
  it("covers the role model from the product requirements", () => {
    expect(CANONICAL_ROLES).toEqual([
      ROLE.PATIENT,
      ROLE.INTERNATIONAL_PATIENT,
      ROLE.DENTIST,
      ROLE.SPECIALIST,
      ROLE.INTERN,
      ROLE.FACILITY_OWNER,
      ROLE.FRONT_OFFICE,
      ROLE.FACILITY_DENTIST,
      ROLE.SUPPLIER,
      ROLE.TRAINING_PROVIDER,
      ROLE.STAFF,
      ROLE.ADMIN,
      ROLE.SUPER_ADMIN,
      ROLE.PLATFORM_OPERATOR,
    ]);
  });

  it("normalizes current and legacy role strings without promoting unknown values", () => {
    expect(normalizeRole(" Patient ")).toBe(ROLE.PATIENT);
    expect(normalizeRole("international patient")).toBe(ROLE.INTERNATIONAL_PATIENT);
    expect(normalizeRole("dental specialist")).toBe(ROLE.SPECIALIST);
    expect(normalizeRole("facility admin")).toBe(ROLE.FACILITY_OWNER);
    expect(normalizeRole("clinic owner")).toBe(ROLE.FACILITY_OWNER);
    expect(normalizeRole("front-office")).toBe(ROLE.FRONT_OFFICE);
    expect(normalizeRole("receptionist")).toBe(ROLE.FRONT_OFFICE);
    expect(normalizeRole("facility specialist")).toBe(ROLE.FACILITY_DENTIST);
    expect(normalizeRole("trainer")).toBe(ROLE.TRAINING_PROVIDER);
    expect(normalizeRole("super-admin")).toBe(ROLE.SUPER_ADMIN);
    expect(normalizeRole("platform operator")).toBe(ROLE.PLATFORM_OPERATOR);
    expect(normalizeRole("unknown-role")).toBeNull();
    expect(normalizeRole(null)).toBeNull();
  });

  it("matches roles and classifies staff and portal access", () => {
    const facilityUser = { role: "facility_admin" };

    expect(roleMatches(facilityUser, [ROLE.FACILITY_OWNER, ROLE.FRONT_OFFICE])).toBe(true);
    expect(isFacilityRole(facilityUser)).toBe(true);
    expect(isSupplierRole("supplier")).toBe(true);
    expect(isTrainingProviderRole("training provider")).toBe(true);
    expect(isStaffUser("staff")).toBe(true);
    expect(isStaffUser("super admin")).toBe(true);
    expect(isStaffUser("platform operator")).toBe(true);
    expect(isStaffUser("supplier")).toBe(false);
    expect(isStaffUser(null)).toBe(false);
  });

  it("returns canonical dashboard paths and rejects unknown roles", () => {
    expect(getDashboardPath(ROLE.PATIENT)).toBe(DASHBOARD_PATHS.patient);
    expect(getDashboardPath(ROLE.INTERNATIONAL_PATIENT)).toBe("/dashboard");
    expect(getDashboardPath(ROLE.FACILITY_DENTIST)).toBe("/dashboard/facility");
    expect(getDashboardPath(ROLE.SUPPLIER)).toBe("/dashboard/supplier");
    expect(getDashboardPath(ROLE.TRAINING_PROVIDER)).toBe("/dashboard/training");
    expect(getDashboardPath(ROLE.ADMIN)).toBe("/admin");
    expect(getDashboardPath(ROLE.PLATFORM_OPERATOR)).toBe("/operations");
    expect(getDashboardPath("not-a-role")).toBeNull();
  });
});

describe("auth contract", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it("sends the account type and stores one canonical session", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        access_token: "token",
        token_type: "bearer",
        user: {
          id: "user-1",
          email: "clinic@example.com",
          full_name: "Clinic Owner",
          role: "facility_admin",
          is_staff: false,
          account_status: "active",
        },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const response = await register({
      full_name: "Clinic Owner",
      email: "clinic@example.com",
      password: "password123",
      account_type: ROLE.FACILITY_OWNER,
    });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/v1/auth/register");
    expect(JSON.parse(String(init.body))).toEqual({
      full_name: "Clinic Owner",
      email: "clinic@example.com",
      password: "password123",
      account_type: ROLE.FACILITY_OWNER,
    });
    expect(response.user.role).toBe(ROLE.FACILITY_OWNER);
    expect(response.user.is_staff).toBe(false);
    expect(getStoredAuth()).toEqual(response);
  });

  it("does not accept an unknown role from the authentication response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          access_token: "token",
          token_type: "bearer",
          user: {
            id: "user-1",
            email: "user@example.com",
            full_name: "Unknown User",
            role: "unrecognized",
            is_staff: false,
            account_status: "active",
          },
        }),
      }),
    );

    await expect(
      register({
        full_name: "Unknown User",
        email: "user@example.com",
        password: "password123",
        account_type: ROLE.PATIENT,
      }),
    ).rejects.toThrow("Invalid authentication response");
    expect(getStoredAuth()).toBeNull();
  });

  it("refuses a staff account type at registration", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      register({
        full_name: "Wannabe Admin",
        email: "admin@example.com",
        password: "password123",
        account_type: ROLE.ADMIN,
      }),
    ).rejects.toThrow("Invalid registration account type");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
