// Small typed API client. Mirrors the backend's Pydantic response shape so the
// client and server agree on the contract. In a larger app these types would be
// generated from the FastAPI OpenAPI spec rather than hand-written.

export interface HealthStatus {
  status: string;
  service: string;
  message: string;
}

const API_BASE = "/api/v1";

export async function fetchHealth(): Promise<HealthStatus> {
  const res = await fetch(`${API_BASE}/health`);
  if (!res.ok) {
    throw new Error(`Health check failed: ${res.status}`);
  }
  return (await res.json()) as HealthStatus;
}
