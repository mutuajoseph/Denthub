export const API_BASE = "/api/v1";

export interface HealthStatus {
  status: string;
  service: string;
  message: string;
}

export async function fetchHealth(): Promise<HealthStatus> {
  const res = await fetch(`${API_BASE}/health`);

  if (!res.ok) {
    throw new Error(`Health check failed: ${res.status}`);
  }

  return (await res.json()) as HealthStatus;
}
