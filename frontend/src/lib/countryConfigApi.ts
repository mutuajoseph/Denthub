import { USE_API } from "./searchApi";

/**
 * Country-config fetchers. The new backend does not expose these endpoints yet,
 * so calls are wrapped to resolve to `null`/empty rather than throwing, letting
 * the store fall back to static region data (same behaviour as the original
 * offline path).
 */

async function safeFetch(
  path: string,
  countryCode: string,
): Promise<Record<string, unknown> | null> {
  if (!USE_API) return null;
  try {
    const res = await fetch(path, {
      headers: { Accept: "application/json", "Accept-Country": countryCode },
    });
    if (!res.ok) return null;
    const body = await res.json();
    return body?.data ?? body ?? null;
  } catch {
    return null;
  }
}

export async function fetchCountryConfig(countryCode: string) {
  return safeFetch(`/api/config/country?country=${encodeURIComponent(countryCode)}`, countryCode);
}

export async function fetchCountryAdaptation(countryCode: string) {
  return safeFetch(
    `/api/config/country/adaptation?country=${encodeURIComponent(countryCode)}`,
    countryCode,
  );
}

export async function fetchCountryRegions(countryCode: string) {
  const data = await safeFetch(
    `/api/config/country/regions?country=${encodeURIComponent(countryCode)}`,
    countryCode,
  );
  return data;
}
