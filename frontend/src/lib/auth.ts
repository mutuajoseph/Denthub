import { API_BASE } from "./api";

export interface AuthUser {
  id: string;
  email: string;
  role: string;
  full_name: string;
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
  account_type: string;
}

const AUTH_STORAGE_KEY = "denthub_auth";

/**
 * Login
 */
export async function login(credentials: LoginRequest): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(credentials),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data?.message || data?.detail || `Login failed: ${res.status}`);
  }

  const authResponse = data as AuthResponse;

  // Save authentication session
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authResponse));

  return authResponse;
}

/**
 * Register
 */
export async function register(data: RegisterRequest): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE}/auth/register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  const responseData = await res.json();

  if (!res.ok) {
    throw new Error(
      responseData?.message || responseData?.detail || `Registration failed: ${res.status}`,
    );
  }

  const authResponse = responseData as AuthResponse;

  // Save authentication session
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authResponse));

  return authResponse;
}

/**
 * Get saved authentication session
 */
export function getStoredAuth(): AuthResponse | null {
  try {
    const stored = localStorage.getItem(AUTH_STORAGE_KEY);

    if (!stored) {
      return null;
    }

    return JSON.parse(stored) as AuthResponse;
  } catch {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    return null;
  }
}

/**
 * Get saved user
 */
export function getStoredUser(): AuthUser | null {
  return getStoredAuth()?.user ?? null;
}

/**
 * Get saved access token
 */
export function getStoredToken(): string | null {
  return getStoredAuth()?.access_token ?? null;
}

/**
 * Clear authentication session
 */
export function clearStoredAuth(): void {
  localStorage.removeItem(AUTH_STORAGE_KEY);
}
