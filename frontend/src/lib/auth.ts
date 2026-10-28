import { type Role, isPublicRole, normalizeRole } from "../auth/roles";
import { postJson } from "./apiClient";

export type AccountStatus = "active" | "pending";

export interface AuthUser {
  id: string;
  email: string;
  role: Role;
  full_name: string;
  is_staff: boolean;
  account_status: AccountStatus;
  /** Whether the User has confirmed they own `email` (#120). Gates nothing yet. */
  email_verified: boolean;
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
      email_verified: user.email_verified === true,
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
