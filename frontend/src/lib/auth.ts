import { type Role, isPublicRole, normalizeRole } from "../auth/roles";
import { postJson } from "./apiClient";

export type AccountStatus = "active" | "pending";

/** One Profile a User holds (`CONTEXT.md` "Profile"; ADR-0006). */
export type ProfileKind = "patient" | "specialist" | "supplier" | "training_provider";
export type FacilityPermission = "owner" | "front_office" | "clinical";

export interface ProfileSummary {
  kind: ProfileKind;
}

/** A User's link to one Facility, with what they may do there. */
export interface MembershipSummary {
  facility_id: string;
  facility_name: string;
  permissions: FacilityPermission[];
}

const PROFILE_KINDS: readonly ProfileKind[] = [
  "patient",
  "specialist",
  "supplier",
  "training_provider",
];
const FACILITY_PERMISSIONS: readonly FacilityPermission[] = ["owner", "front_office", "clinical"];

export interface AuthUser {
  id: string;
  email: string;
  role: Role;
  full_name: string;
  is_staff: boolean;
  account_status: AccountStatus;
  /** What the User acts as. The app still routes on `role` until it migrates (ADR-0006). */
  profiles: ProfileSummary[];
  memberships: MembershipSummary[];
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: AuthUser;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  full_name: string;
  email: string;
  phone?: string;
  password: string;
  account_type: Role;
}

export const AUTH_STORAGE_KEY = "denthub_auth";

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseProfiles(value: unknown): ProfileSummary[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) =>
    isRecord(item) && PROFILE_KINDS.includes(item.kind as ProfileKind)
      ? [{ kind: item.kind as ProfileKind }]
      : [],
  );
}

function parseMemberships(value: unknown): MembershipSummary[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (
      !isRecord(item) ||
      typeof item.facility_id !== "string" ||
      typeof item.facility_name !== "string" ||
      !Array.isArray(item.permissions)
    ) {
      return [];
    }
    const permissions = item.permissions.filter((p): p is FacilityPermission =>
      FACILITY_PERMISSIONS.includes(p as FacilityPermission),
    );
    return [{ facility_id: item.facility_id, facility_name: item.facility_name, permissions }];
  });
}

function parseAuthResponse(value: unknown): AuthResponse {
  if (
    !isRecord(value) ||
    typeof value.access_token !== "string" ||
    typeof value.token_type !== "string" ||
    !isRecord(value.user)
  ) {
    throw new Error("Invalid authentication response");
  }

  const user = value.user;
  const role = normalizeRole(user.role);

  if (
    typeof user.id !== "string" ||
    typeof user.email !== "string" ||
    typeof user.full_name !== "string" ||
    (user.account_status !== "active" && user.account_status !== "pending") ||
    !role
  ) {
    throw new Error("Invalid authentication response");
  }

  return {
    access_token: value.access_token,
    token_type: value.token_type,
    user: {
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      role,
      is_staff: user.is_staff === true,
      account_status: user.account_status,
      // A session stored before #117 has neither field; it reads as none held.
      profiles: parseProfiles(user.profiles),
      memberships: parseMemberships(user.memberships),
    },
  };
}

function getStorage(): Storage | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function saveStoredAuth(auth: AuthResponse): void {
  const storage = getStorage();

  if (!storage) {
    return;
  }

  try {
    storage.setItem(AUTH_STORAGE_KEY, JSON.stringify(auth));
  } catch {
    return;
  }
}

async function postAuth(path: string, body: UnknownRecord): Promise<AuthResponse> {
  const data = await postJson<unknown>(path, body);

  const authResponse = parseAuthResponse(data);
  saveStoredAuth(authResponse);
  return authResponse;
}

export async function login(credentials: LoginRequest): Promise<AuthResponse> {
  return postAuth("/auth/login", {
    email: credentials.email,
    password: credentials.password,
  });
}

/**
 * Sign in at the staff surface (PRD §6, issue #80). The backend mints a token
 * scoped to the staff issuer; the client stores it under the same key because
 * one browser holds one session.
 */
export async function loginStaff(credentials: LoginRequest): Promise<AuthResponse> {
  return postAuth("/auth/staff/login", {
    email: credentials.email,
    password: credentials.password,
  });
}

export async function register(data: RegisterRequest): Promise<AuthResponse> {
  const accountType = normalizeRole(data.account_type);

  if (!accountType || !isPublicRole(accountType)) {
    throw new Error("Invalid registration account type");
  }

  return postAuth("/auth/register", {
    full_name: data.full_name,
    email: data.email,
    password: data.password,
    account_type: accountType,
    ...(data.phone === undefined ? {} : { phone: data.phone }),
  });
}

export function getStoredAuth(): AuthResponse | null {
  const storage = getStorage();

  if (!storage) {
    return null;
  }

  try {
    const stored = storage.getItem(AUTH_STORAGE_KEY);

    if (!stored) {
      return null;
    }

    return parseAuthResponse(JSON.parse(stored) as unknown);
  } catch {
    clearStoredAuth();
    return null;
  }
}

export function getStoredUser(): AuthUser | null {
  return getStoredAuth()?.user ?? null;
}

export function getStoredToken(): string | null {
  return getStoredAuth()?.access_token ?? null;
}

export function clearStoredAuth(): void {
  const storage = getStorage();

  if (!storage) {
    return;
  }

  try {
    storage.removeItem(AUTH_STORAGE_KEY);
  } catch {
    return;
  }
}
