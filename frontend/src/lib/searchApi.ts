/**
 * Thin typed client + mappers for dentist/clinic search, adapted from the
 * original landing-page implementation. The backend search surface may not be
 * deployed yet; every call degrades gracefully so the home page never crashes.
 */

const API_BASE = (import.meta.env.VITE_API_URL || "/api").replace(/\/$/, "");
export const USE_API = import.meta.env.VITE_USE_API !== "false";

const DEFAULT_TIMEOUT_MS = 15_000;
const MAX_RETRIES = 1;

const TRANSIENT_STATUSES = new Set([429, 502, 503, 504]);

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithTimeoutAndRetry(
  url: string,
  init: RequestInit = {},
  attempt = 0,
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    const res = await fetch(url, { ...init, signal: controller.signal });

    if (!res.ok && TRANSIENT_STATUSES.has(res.status) && attempt < MAX_RETRIES) {
      clearTimeout(timeoutId);
      await sleep(1000 * 2 ** attempt);
      return fetchWithTimeoutAndRetry(url, init, attempt + 1);
    }

    clearTimeout(timeoutId);
    return res;
  } catch (err) {
    clearTimeout(timeoutId);

    if (err instanceof DOMException && err.name === "AbortError" && attempt < MAX_RETRIES) {
      await sleep(1000 * 2 ** attempt);
      return fetchWithTimeoutAndRetry(url, init, attempt + 1);
    }

    if (err instanceof DOMException && err.name === "AbortError") {
      throw new Error("API request timed out. The server may be slow or unreachable.");
    }

    throw err;
  }
}

function toQuery(params: Record<string, unknown>): string {
  const q = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    if (Array.isArray(value)) {
      for (const v of value) {
        q.append(key, String(v));
      }
    } else {
      q.set(key, String(value));
    }
  }
  return q.toString();
}

async function request(path: string, countryCode: string): Promise<Record<string, unknown>> {
  const headers = new Headers({ Accept: "application/json" });
  headers.set("Accept-Country", countryCode);

  const res = await fetchWithTimeoutAndRetry(`${API_BASE}${path}`, { headers });

  if (!res.ok) {
    const err = new Error(res.statusText || "Request failed") as Error & { status?: number };
    err.status = res.status;
    throw err;
  }

  const text = await res.text();
  return text ? JSON.parse(text) : {};
}

export interface PracticeCard {
  id: string;
  listingType: string;
  name: string;
  specialty: string[];
  operatingAreas: string[];
  county: string;
  regionId?: string;
  town: string;
  rating: number;
  reviews: number;
  nhif: boolean;
  insurance: string[];
  verified: boolean;
  approved: boolean;
}

export interface DentistCard {
  id: string;
  listingType: string;
  name: string;
  clinic: string;
  specialty: string[];
  county: string;
  regionId?: string;
  town: string;
  rating: number;
  reviews: number;
  nhif: boolean;
  insurance: string[];
  verified: boolean;
  approved: boolean;
}

type ApiRow = Record<string, unknown>;

function asObj(value: unknown): ApiRow {
  return value && typeof value === "object" ? (value as ApiRow) : {};
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

function asNumber(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isNaN(n) ? 0 : n;
}

function normalizeRegion(row: ApiRow): { name?: string; id?: string } {
  // New backend may return a nested clinic/region or a flat shape. Handle both.
  const region = asObj(row.region);
  return {
    name: asString(region.name ?? row.regionName ?? row.county) || undefined,
    id: asString(region.id ?? row.regionId) || undefined,
  };
}

function verification(tier: unknown): boolean {
  return asString(tier) !== "UNVERIFIED";
}

function mapPracticeFromApi(row: ApiRow): PracticeCard {
  const region = normalizeRegion(row);
  const specialties = asStringArray(row.specialties);
  const single = asString(row.specialty);
  const finalSpecialties = specialties.length ? specialties : single ? [single] : ["General"];
  const areas = asStringArray(row.operatingAreas).length
    ? asStringArray(row.operatingAreas)
    : region.name
      ? [region.name]
      : [];

  return {
    id: asString(row.id),
    listingType: "practice",
    name: asString(row.name) || "Dental practice",
    specialty: finalSpecialties,
    operatingAreas: areas,
    county: region.name || "",
    regionId: region.id,
    town: asString(asObj(row.city).name ?? row.cityName),
    rating: asNumber(row.avgRating ?? row.rating),
    reviews: asNumber(row.totalReviews ?? row.reviews),
    nhif: Boolean(row.acceptsNhif ?? row.nhif),
    insurance: asStringArray(row.insurancePanels),
    verified: verification(row.verificationTier),
    approved: verification(row.verificationTier),
  };
}

function mapDentistFromApi(row: ApiRow): DentistCard {
  const region = normalizeRegion(row);
  const user = asObj(row.user);
  const clinic = asObj(row.clinic);
  const firstName = asString(user.firstName) || asString(user.full_name).split(" ")[0] || "";
  const lastName = asString(user.lastName) || asString(user.full_name).split(" ")[1] || "";
  const name = `Dr. ${firstName} ${lastName}`.trim().replace(/^Dr\.\s*$/, "Dentist");

  return {
    id: asString(row.id),
    listingType: "specialist",
    name,
    clinic: asString(clinic.name) || asString(row.clinicName) || "Dental clinic",
    specialty: asStringArray(row.specialties).length ? asStringArray(row.specialties) : ["General"],
    county: region.name || "",
    regionId: region.id,
    town: asString(asObj(clinic.city).name ?? row.cityName),
    rating: asNumber(row.avgRating ?? clinic.avgRating),
    reviews: asNumber(row.totalReviews ?? clinic.totalReviews),
    nhif: Boolean(clinic.acceptsNhif ?? row.acceptsNhif ?? row.nhif),
    insurance: asStringArray(clinic.insurancePanels).length
      ? asStringArray(clinic.insurancePanels)
      : asStringArray(row.insurancePanels),
    verified: verification(row.verificationTier ?? clinic.verificationTier),
    approved: verification(clinic.verificationTier),
  };
}

export interface SearchResult {
  specialists: DentistCard[];
  practices: PracticeCard[];
  fromApi: boolean;
}

export async function searchDentists(params: Record<string, unknown>): Promise<SearchResult> {
  const qs = toQuery(params);
  const data = await request(`/search/dentists?${qs}`, String(params.countryCode ?? "KE"));
  const list = Array.isArray(data?.data) ? data.data : [];
  return { specialists: list.map(mapDentistFromApi), practices: [], fromApi: true };
}

export async function searchClinics(params: Record<string, unknown>): Promise<SearchResult> {
  const qs = toQuery(params);
  const data = await request(`/search/clinics?${qs}`, String(params.countryCode ?? "KE"));
  const list = Array.isArray(data?.data) ? data.data : [];
  return { specialists: [], practices: list.map(mapPracticeFromApi), fromApi: true };
}
