import { type Role, isPublicRole, normalizeRole } from "../auth/roles";
import { ApiError, apiRequest, postJson } from "./apiClient";

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
  /** Whether the User has confirmed they own `email` (#120). Gates nothing yet. */
  email_verified: boolean;
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

/**
 * Which auth surface the stored session belongs to. The backend keeps a
 * separate cookie and path per surface (#121), so refresh and logout must call
 * the matching route; one browser still holds one session.
 */
export type AuthSurface = "public" | "staff";

/**
 * The access token lives in memory only (ADR-0003 follow-up, #121). An XSS bug
 * can still act as the user while its page is open, but nothing long-lived is
 * readable from storage, and a reload recovers the session through the
 * httpOnly refresh cookie instead.
 */
let accessToken: string | null = null;
let accessSurface: AuthSurface | null = null;

const AUTH_CHANGE_EVENT = "denthub:auth-change";

/**
 * Tell mounted subscribers that the stored session changed. A failed refresh
 * clears the session outside React, so `App` subscribes to drop its stale
 * `user` state instead of staying visually signed in until a reload.
 */
function notifyAuthChange(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new Event(AUTH_CHANGE_EVENT));
}

export function subscribeToAuthChanges(listener: (user: AuthUser | null) => void): () => void {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const handleChange = () => listener(getStoredUser());
  // Another tab changing or clearing the shared session fires `storage` here.
  const handleStorage = (event: StorageEvent) => {
    if (event.key === AUTH_STORAGE_KEY || event.key === null) {
      listener(getStoredUser());
    }
  };

  window.addEventListener(AUTH_CHANGE_EVENT, handleChange);
  window.addEventListener("storage", handleStorage);
  return () => {
    window.removeEventListener(AUTH_CHANGE_EVENT, handleChange);
    window.removeEventListener("storage", handleStorage);
  };
}

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
    // A membership always holds at least one permission (a database check).
    if (permissions.length === 0) return [];
    return [{ facility_id: item.facility_id, facility_name: item.facility_name, permissions }];
  });
}

function parseUser(value: unknown): AuthUser {
  if (!isRecord(value)) {
    throw new Error("Invalid authentication response");
  }

  const role = normalizeRole(value.role);

  if (
    typeof value.id !== "string" ||
    typeof value.email !== "string" ||
    typeof value.full_name !== "string" ||
    (value.account_status !== "active" && value.account_status !== "pending") ||
    !role
  ) {
    throw new Error("Invalid authentication response");
  }

  return {
    id: value.id,
    email: value.email,
    full_name: value.full_name,
    role,
    is_staff: value.is_staff === true,
    account_status: value.account_status,
    email_verified: value.email_verified === true,
    // A session stored before #117 has neither field; it reads as none held.
    profiles: parseProfiles(value.profiles),
    memberships: parseMemberships(value.memberships),
  };
}

function parseAuthResponse(value: unknown): AuthResponse {
  if (
    !isRecord(value) ||
    typeof value.access_token !== "string" ||
    typeof value.token_type !== "string"
  ) {
    throw new Error("Invalid authentication response");
  }

  return {
    access_token: value.access_token,
    token_type: value.token_type,
    user: parseUser(value.user),
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

function saveStoredAuth(auth: AuthResponse, surface: AuthSurface): void {
  accessToken = auth.access_token;
  accessSurface = surface;

  const storage = getStorage();

  if (storage) {
    try {
      // Only the profile and its surface are persisted. The token is never
      // written to storage.
      storage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ user: auth.user, surface }));
    } catch {
      // A blocked localStorage must not stop the in-memory session.
    }
  }

  notifyAuthChange();
}

async function postAuth(
  path: string,
  body: UnknownRecord,
  surface: AuthSurface,
): Promise<AuthResponse> {
  const data = await postJson<unknown>(path, body);

  const authResponse = parseAuthResponse(data);
  saveStoredAuth(authResponse, surface);
  return authResponse;
}

export async function login(credentials: LoginRequest): Promise<AuthResponse> {
  return postAuth(
    "/auth/login",
    {
      email: credentials.email,
      password: credentials.password,
    },
    "public",
  );
}

/**
 * Sign in at the staff surface (PRD §6, issue #80). The backend mints a token
 * scoped to the staff issuer; the client stores it under the same key because
 * one browser holds one session.
 */
export async function loginStaff(credentials: LoginRequest): Promise<AuthResponse> {
  return postAuth(
    "/auth/staff/login",
    {
      email: credentials.email,
      password: credentials.password,
    },
    "staff",
  );
}

export async function register(data: RegisterRequest): Promise<AuthResponse> {
  const accountType = normalizeRole(data.account_type);

  if (!accountType || !isPublicRole(accountType)) {
    throw new Error("Invalid registration account type");
  }

  return postAuth(
    "/auth/register",
    {
      full_name: data.full_name,
      email: data.email,
      password: data.password,
      account_type: accountType,
      ...(data.phone === undefined ? {} : { phone: data.phone }),
    },
    "public",
  );
}

export function getStoredAuth(): AuthResponse | null {
  const user = getStoredUser();

  if (!user) {
    return null;
  }

  return { access_token: accessToken ?? "", token_type: "bearer", user };
}

export function getStoredUser(): AuthUser | null {
  const storage = getStorage();

  if (!storage) {
    return null;
  }

  try {
    const stored = storage.getItem(AUTH_STORAGE_KEY);

    if (!stored) {
      return null;
    }

    const parsed = JSON.parse(stored) as unknown;
    // Before #121 the whole { access_token, user } response was stored; now it
    // is { user, surface }. Read either, so a deploy does not sign everyone out.
    const candidate = isRecord(parsed) && "user" in parsed ? parsed.user : parsed;

    return parseUser(candidate);
  } catch {
    clearStoredAuth();
    return null;
  }
}

/** Which surface the stored session is on; a legacy record was public. */
export function getStoredSurface(): AuthSurface {
  const storage = getStorage();

  if (!storage) {
    return accessSurface ?? "public";
  }

  try {
    const parsed = JSON.parse(storage.getItem(AUTH_STORAGE_KEY) ?? "null") as unknown;
    return isRecord(parsed) && parsed.surface === "staff" ? "staff" : "public";
  } catch {
    return accessSurface ?? "public";
  }
}

export function getStoredToken(): string | null {
  return accessToken;
}

/** Adopt a session the API just returned: token in memory, profile persisted. */
export function setSession(auth: AuthResponse, surface: AuthSurface = "public"): void {
  saveStoredAuth(auth, surface);
}

export function clearStoredAuth(): void {
  accessToken = null;
  accessSurface = null;

  const storage = getStorage();

  if (storage) {
    try {
      storage.removeItem(AUTH_STORAGE_KEY);
    } catch {
      // The in-memory token is already gone; a blocked storage still signs out.
    }
  }

  notifyAuthChange();
}

/**
 * One rotation at a time. Refresh tokens are single-use, so two concurrent
 * rotations with the same cookie would make the second look like a replay and
 * revoke the whole family. Concurrent callers share the in-flight request.
 */
let refreshInFlight: Promise<AuthResponse | null> | null = null;

const REFRESH_LOCK = "denthub:refresh";

/**
 * Serialise rotation across tabs. The cookie jar is shared, so two tabs
 * refreshing at once would present the same single-use cookie and look like
 * theft. The Web Locks API makes one tab rotate at a time; the next then sends
 * the newly rotated cookie. Browsers without it keep the in-tab dedupe only.
 */
async function withRefreshLock<T>(task: () => Promise<T>): Promise<T> {
  if (typeof navigator === "undefined" || !navigator.locks) {
    return task();
  }

  return navigator.locks.request(REFRESH_LOCK, task) as Promise<T>;
}

async function rotateRefreshToken(): Promise<AuthResponse | null> {
  const surface = getStoredSurface();
  const path = surface === "staff" ? "/auth/staff/refresh" : "/auth/refresh";

  try {
    const data = await postJson<unknown>(path, undefined, {
      retryOnUnauthorized: false,
    });
    const auth = parseAuthResponse(data);
    saveStoredAuth(auth, surface);
    return auth;
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      clearStoredAuth();
    }
    return null;
  }
}

/**
 * Rotate the refresh cookie and adopt the new access token.
 *
 * A 401 means the session is over and the stored profile goes with it. Any
 * other failure (offline, server down) keeps the profile: a bad network must
 * not sign anyone out.
 */
export function refreshSession(): Promise<AuthResponse | null> {
  refreshInFlight ??= withRefreshLock(rotateRefreshToken).finally(() => {
    refreshInFlight = null;
  });

  return refreshInFlight;
}

/** Recover the in-memory token after a reload, if a profile was stored. */
export async function restoreSession(): Promise<AuthResponse | null> {
  if (!getStoredUser()) {
    return null;
  }

  return refreshSession();
}

/** End the session on the server and locally; succeeds even when offline. */
export async function logoutSession(): Promise<void> {
  const surface = getStoredSurface();
  const path = surface === "staff" ? "/auth/staff/logout" : "/auth/logout";

  try {
    await apiRequest<void>(path, {
      method: "POST",
      retryOnUnauthorized: false,
    });
  } catch {
    // The local session ends either way; a cookie left behind expires on its own.
  } finally {
    clearStoredAuth();
  }
}

/* Email verification and the password lifecycle (#120). Emailed links carry a
 * single-use token; the token is the credential, so these calls need no
 * session. */

export interface ForgotPasswordResponse {
  message: string;
}

export async function verifyEmail(token: string): Promise<void> {
  await postJson<null>("/auth/verify-email", { token });
}

export async function requestPasswordReset(email: string): Promise<ForgotPasswordResponse> {
  return postJson<ForgotPasswordResponse>("/auth/password/forgot", { email });
}

export async function resetPassword(token: string, newPassword: string): Promise<void> {
  await postJson<null>("/auth/password/reset", { token, new_password: newPassword });
}
