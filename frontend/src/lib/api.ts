import { getJson } from "./apiClient";

export const API_BASE = "/api/v1";

export interface HealthStatus {
  status: string;
  service: string;
  message: string;
}

export async function fetchHealth(): Promise<HealthStatus> {
  return getJson<HealthStatus>("/health");
}
