// Small typed API client. Mirrors the backend's Pydantic response shape so the
// client and server agree on the contract. In a larger app these types would be
// generated from the FastAPI OpenAPI spec rather than hand-written.

export interface HealthStatus {
  status: string;
  service: string;
  message: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: {
    id: string;
    email: string;
    role: string;
  };
}

const API_BASE = "/api/v1";

export async function fetchHealth(): Promise<HealthStatus> {
  const res = await fetch(`${API_BASE}/health`);
  if (!res.ok) {
    throw new Error(`Health check failed: ${res.status}`);
  }
  return (await res.json()) as HealthStatus;
}

export async function login(email: string, password: string): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new Error(body?.message ?? `Login failed: ${res.status}`);
  }
  return (await res.json()) as AuthResponse;
}
