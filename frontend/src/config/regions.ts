/**
 * DentHub global brand and region detection.
 *
 * This file carries no per-market data: a market's currency, name, labels, and
 * modules come from country configuration (`lib/countryConfigApi.ts`). What
 * stays here is display-only branding the API has no equivalent for (the
 * global tagline, domains, copy), plus the first-visit detection signals.
 */

export interface Region {
  code: string;
  id: string;
  brandSuffix: string | null;
  countryName: string;
  flag: string | null;
  domain: string;
  phonePrefix: string;
  tagline: string;
  footerAbout?: string;
  announcement: string;
  heroHeadline: string;
  logoTagline?: string;
  trustBadges: string[];
  countiesLabel: string;
}

/** Real countries the client resolves to. `GLOBAL` is display-only. */
export const KNOWN_COUNTRY_CODES = new Set(["KE", "GB", "US", "AE", "NG", "ZA", "IN", "TR"]);

export const DEFAULT_REGION_CODE = "KE";

export const REGIONS: Record<string, Region> = {
  GLOBAL: {
    code: "GLOBAL",
    id: "global",
    brandSuffix: null,
    countryName: "Worldwide",
    flag: null,
    domain: "denthub.com",
    phonePrefix: "+1",
    tagline: "The operating system for dentistry, everywhere.",
    footerAbout:
      "The global dental platform — find dentists, shop oral care, jobs, training & more.",
    announcement: "DentHub is expanding globally — find dental care near you.",
    heroHeadline: "The World's Complete Dental Platform",
    trustBadges: ["Verified Dentists", "Global Shipping", "Secure Payments", "24/7 Support"],
    countiesLabel: "Region",
  },
};

export const REGION_LIST: Region[] = Object.values(REGIONS);

const LOCALE_TO_REGION: Record<string, string> = {
  "en-ke": "KE",
  "sw-ke": "KE",
  "en-gb": "GB",
  "en-uk": "GB",
  "en-us": "US",
  "en-ae": "AE",
  "en-ng": "NG",
  "en-za": "ZA",
  "en-in": "IN",
  "tr-tr": "TR",
};

const TIMEZONE_TO_REGION: Record<string, string> = {
  "Africa/Nairobi": "KE",
  "Africa/Lagos": "NG",
  "Africa/Johannesburg": "ZA",
  "Europe/London": "GB",
  "Asia/Dubai": "AE",
  "Asia/Kolkata": "IN",
  "Europe/Istanbul": "TR",
};

export function getBrandName(region?: Region | null): string {
  if (!region?.brandSuffix) return "DentHub";
  return `DentHub ${region.brandSuffix}`;
}

export function getRegionByCode(code: string): Region {
  return REGIONS[code] || REGIONS.GLOBAL;
}

export function detectRegionCode(): string {
  if (typeof navigator === "undefined") return DEFAULT_REGION_CODE;

  const langs = navigator.languages?.length ? navigator.languages : [navigator.language];
  for (const lang of langs) {
    const key = lang.toLowerCase().replace("_", "-");
    if (LOCALE_TO_REGION[key]) return LOCALE_TO_REGION[key];
    const country = key.split("-")[1]?.toUpperCase();
    if (country && KNOWN_COUNTRY_CODES.has(country)) return country;
  }

  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (TIMEZONE_TO_REGION[tz]) return TIMEZONE_TO_REGION[tz];
  } catch {
    /* ignore */
  }

  return DEFAULT_REGION_CODE;
}

export const IP_DETECTION_ENV_FLAG = "VITE_ENABLE_IP_DETECTION";

/**
 * Detect a region from the client's IP address via a public geo service.
 * Used as an enhancement when the locale/timezone signal is ambiguous and no
 * manual selection has been made. Returns null on any failure so callers can
 * fall back to locale/timezone or the default region.
 *
 * Gated behind the `VITE_ENABLE_IP_DETECTION` env flag (off by default) so the
 * third-party ipwho.is call is optional and offline-safe. The PRD §5 model —
 * server-driven `Accept-Country`/`Accept-Currency`/`Accept-Language` headers —
 * remains the source of truth once the backend supports it; this is a
 * first-visit progressive enhancement only.
 */
export async function detectRegionByIP(): Promise<string | null> {
  if (typeof window === "undefined") return null;
  if (import.meta.env.VITE_ENABLE_IP_DETECTION !== "true") return null;

  const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 4000));
  const fetchRegion = async (): Promise<string | null> => {
    try {
      const res = await fetch("https://ipwho.is/");
      if (!res.ok) return null;
      const data: { success?: boolean; country_code?: string } = await res.json();
      if (data.success === false || !data.country_code) return null;
      const code = data.country_code.toUpperCase();
      return KNOWN_COUNTRY_CODES.has(code) ? code : null;
    } catch {
      return null;
    }
  };

  return Promise.race([fetchRegion(), timeout]);
}
