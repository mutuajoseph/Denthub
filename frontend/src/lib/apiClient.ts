/**
 * Shared transport for every `/api/v1` call. Resource clients in `lib/` build on
 * this rather than calling `fetch` directly, so country/currency negotiation and
 * the `{ code, message, detail? }` error envelope are handled in one place.
 */

import { useRegionStore } from "../store/regionStore";
import { API_BASE } from "./api";
import { getStoredToken } from "./auth";

const DEFAULT_TIMEOUT_MS = 15_000;

/** Shape every failing backend response is guaranteed to have. */
export interface ApiErrorBody {
  code: string;
  message: string;
  detail?: unknown;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly detail: unknown;

  constructor(message: string, options: { status: number; code?: string; detail?: unknown }) {
    super(message);
    this.name = "ApiError";
    this.status = options.status;
    this.code = options.code ?? "unknown_error";
    this.detail = options.detail;
  }
}

export type QueryPrimitive = string | number | boolean;
export type QueryValue = QueryPrimitive | QueryPrimitive[] | null | undefined;

export interface ApiRequestOptions extends Omit<RequestInit, "body"> {
  query?: Record<string, QueryValue>;
  /** Serialised as a JSON body and sets `Content-Type` automatically. */
  json?: unknown;
  countryCode?: string;
  currency?: string;
  /** Attaches the stored bearer token when one is signed in. */
  auth?: boolean;
  timeoutMs?: number;
}

interface ActiveRegion {
  code: string;
  currency: string;
  language: string;
}

function resolveActiveRegion(): ActiveRegion {
  const state = useRegionStore.getState();
  const code = state.regionCode || state.getRegion().code;
  const region = state.getRegion();

  return {
    // GLOBAL is a display-only region; the API always resolves to a real country.
    code: code === "GLOBAL" ? "KE" : code,
    currency: region.currency,
    language: region.locale.split("-")[0] || "en",
  };
}

function buildQueryString(query: Record<string, QueryValue> | undefined): string {
  if (!query) return "";

  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") continue;

    if (Array.isArray(value)) {
      for (const entry of value) {
        params.append(key, String(entry));
      }
    } else {
      params.set(key, String(value));
    }
  }

  const serialised = params.toString();
  return serialised ? `?${serialised}` : "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toApiError(status: number, body: unknown, fallback: string): ApiError {
  if (!isRecord(body)) {
    return new ApiError(fallback, { status });
  }

  const message = typeof body.message === "string" && body.message ? body.message : fallback;
  const code = typeof body.code === "string" ? body.code : undefined;

  return new ApiError(message, { status, code, detail: body.detail });
}

async function readBody(res: Response): Promise<unknown> {
  const text = await res.text();

  if (!text) return null;

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const {
    query,
    json,
    countryCode,
    currency,
    auth = false,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    headers: extraHeaders,
    signal,
    ...init
  } = options;

  const region = resolveActiveRegion();
  const headers = new Headers(extraHeaders);

  headers.set("Accept", "application/json");
  headers.set("Accept-Country", countryCode || region.code);
  headers.set("Accept-Currency", currency || region.currency);
  headers.set("Accept-Language", region.language);

  if (auth) {
    const token = getStoredToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
  }

  let body: BodyInit | undefined;

  if (json !== undefined) {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(json);
  }

  const url = `${API_BASE}${path.startsWith("/") ? path : `/${path}`}${buildQueryString(query)}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  if (signal) {
    if (signal.aborted) {
      controller.abort();
    } else {
      signal.addEventListener("abort", () => controller.abort(), { once: true });
    }
  }

  let res: Response;

  try {
    res = await fetch(url, { ...init, headers, body, signal: controller.signal });
  } catch (error) {
    if (controller.signal.aborted) {
      throw new ApiError("The request timed out. The server may be slow or unreachable.", {
        status: 0,
        code: "timeout",
      });
    }

    throw new ApiError("Cannot reach the API. Is the backend running on port 8000?", {
      status: 0,
      code: "network_error",
      detail: error,
    });
  } finally {
    clearTimeout(timer);
  }

  const payload = await readBody(res);

  if (!res.ok) {
    throw toApiError(res.status, payload, res.statusText || "Request failed");
  }

  return payload as T;
}

export function getJson<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  return apiRequest<T>(path, { ...options, method: "GET" });
}

export function postJson<T>(
  path: string,
  json: unknown,
  options: ApiRequestOptions = {},
): Promise<T> {
  return apiRequest<T>(path, { ...options, method: "POST", json });
}
