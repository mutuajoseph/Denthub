/**
 * Regional configs for DentHub global brand.
 * brandName = "DentHub" + optional regional suffix (e.g. "DentHub Kenya").
 */

export interface Region {
  code: string;
  id: string;
  brandSuffix: string | null;
  countryName: string;
  flag: string | null;
  currency: string;
  currencySymbol: string;
  locale: string;
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

export const DEFAULT_REGION_CODE = "KE";

export const REGIONS: Record<string, Region> = {
  GLOBAL: {
    code: "GLOBAL",
    id: "global",
    brandSuffix: null,
    countryName: "Worldwide",
    flag: null,
    currency: "USD",
    currencySymbol: "$",
    locale: "en",
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
  KE: {
    code: "KE",
    id: "kenya",
    brandSuffix: "Kenya",
    countryName: "Kenya",
    flag: null,
    currency: "KES",
    currencySymbol: "KSh",
    locale: "en-KE",
    domain: "denthub.co.ke",
    phonePrefix: "+254",
    tagline: "The operating system for dentistry in Kenya.",
    footerAbout:
      "Kenya's complete dental platform — find dentists, shop oral care, jobs, training & more.",
    announcement: "DentHub Kenya is now live in Nairobi — find a dentist near you today!",
    heroHeadline: "Kenya's Complete Dental Platform",
    logoTagline: "A dental health ecosystem for Africa",
    trustBadges: ["2,400+ Verified Dentists", "47 Counties", "NHIF Accepted", "M-Pesa Ready"],
    countiesLabel: "County",
  },
  GB: {
    code: "GB",
    id: "uk",
    brandSuffix: "UK",
    countryName: "United Kingdom",
    flag: null,
    currency: "GBP",
    currencySymbol: "£",
    locale: "en-GB",
    domain: "denthub.co.uk",
    phonePrefix: "+44",
    tagline: "Find NHS and private dental care across the UK.",
    announcement: "DentHub UK — book dentists and shop oral care nationwide.",
    heroHeadline: "The UK's Complete Dental Platform",
    trustBadges: ["GDC Registered", "NHS & Private", "UK-Wide Coverage", "Secure Checkout"],
    countiesLabel: "County",
  },
  US: {
    code: "US",
    id: "usa",
    brandSuffix: "USA",
    countryName: "United States",
    flag: null,
    currency: "USD",
    currencySymbol: "$",
    locale: "en-US",
    domain: "denthub.com",
    phonePrefix: "+1",
    tagline: "Dental care, products, and careers — coast to coast.",
    announcement: "DentHub USA — find dentists and oral care products near you.",
    heroHeadline: "America's Complete Dental Platform",
    trustBadges: ["Licensed Dentists", "Insurance Accepted", "50 States", "HIPAA Aware"],
    countiesLabel: "State",
  },
  AE: {
    code: "AE",
    id: "uae",
    brandSuffix: "UAE",
    countryName: "United Arab Emirates",
    flag: null,
    currency: "AED",
    currencySymbol: "AED",
    locale: "en-AE",
    domain: "denthub.ae",
    phonePrefix: "+971",
    tagline: "Premium dental care across the Emirates.",
    announcement: "DentHub UAE — world-class dental services in Dubai & Abu Dhabi.",
    heroHeadline: "The UAE's Complete Dental Platform",
    trustBadges: ["DHA Licensed", "Multilingual", "Premium Care", "Easy Booking"],
    countiesLabel: "Emirate",
  },
  NG: {
    code: "NG",
    id: "nigeria",
    brandSuffix: "Nigeria",
    countryName: "Nigeria",
    flag: null,
    currency: "NGN",
    currencySymbol: "₦",
    locale: "en-NG",
    domain: "denthub.ng",
    phonePrefix: "+234",
    tagline: "Dental platform for Lagos, Abuja, and beyond.",
    announcement: "DentHub Nigeria — find dentists and shop oral care.",
    heroHeadline: "Nigeria's Complete Dental Platform",
    trustBadges: ["Verified Clinics", "36 States", "NHIS Partners", "Mobile Money"],
    countiesLabel: "State",
  },
  ZA: {
    code: "ZA",
    id: "south-africa",
    brandSuffix: "South Africa",
    countryName: "South Africa",
    flag: null,
    currency: "ZAR",
    currencySymbol: "R",
    locale: "en-ZA",
    domain: "denthub.co.za",
    phonePrefix: "+27",
    tagline: "Dental care across all nine provinces.",
    announcement: "DentHub South Africa — book dentists in Cape Town, Joburg & more.",
    heroHeadline: "South Africa's Complete Dental Platform",
    trustBadges: ["HPCSA Registered", "9 Provinces", "Medical Aid", "Secure Pay"],
    countiesLabel: "Province",
  },
  IN: {
    code: "IN",
    id: "india",
    brandSuffix: "India",
    countryName: "India",
    flag: null,
    currency: "INR",
    currencySymbol: "₹",
    locale: "en-IN",
    domain: "denthub.in",
    phonePrefix: "+91",
    tagline: "Find dentists, oral care, and CPD training across India.",
    announcement: "DentHub India — book dentists in Mumbai, Delhi, Bangalore & more.",
    heroHeadline: "India's Complete Dental Platform",
    trustBadges: ["DCI Registered", "36 States & UTs", "PM-JAY Partners", "UPI & Cards"],
    countiesLabel: "State / UT",
  },
  TR: {
    code: "TR",
    id: "turkey",
    brandSuffix: "Turkey",
    countryName: "Turkey",
    flag: null,
    currency: "TRY",
    currencySymbol: "₺",
    locale: "tr-TR",
    domain: "denthub.com.tr",
    phonePrefix: "+90",
    tagline: "Dental care across all 81 provinces — Istanbul to Ankara and beyond.",
    announcement: "DentHub Turkey — find dentists and shop oral care nationwide.",
    heroHeadline: "Turkey's Complete Dental Platform",
    trustBadges: ["Ministry Licensed", "81 Provinces", "SGK Accepted", "Secure Pay"],
    countiesLabel: "Province",
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
  return REGIONS[code] || REGIONS[DEFAULT_REGION_CODE];
}

export function detectRegionCode(): string {
  if (typeof navigator === "undefined") return "KE";

  const langs = navigator.languages?.length ? navigator.languages : [navigator.language];
  for (const lang of langs) {
    const key = lang.toLowerCase().replace("_", "-");
    if (LOCALE_TO_REGION[key]) return LOCALE_TO_REGION[key];
    const country = key.split("-")[1]?.toUpperCase();
    if (country && REGIONS[country]) return country;
  }

  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (TIMEZONE_TO_REGION[tz]) return TIMEZONE_TO_REGION[tz];
  } catch {
    /* ignore */
  }

  return DEFAULT_REGION_CODE;
}

/**
 * Detect a region from the client's IP address via a public geo service.
 * Used as an enhancement when the locale/timezone signal is ambiguous and no
 * manual selection has been made. Returns null on any failure so callers can
 * fall back to locale/timezone or the default region.
 */
export async function detectRegionByIP(): Promise<string | null> {
  if (typeof window === "undefined") return null;

  const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 4000));
  const fetchRegion = async (): Promise<string | null> => {
    try {
      const res = await fetch("https://ipwho.is/");
      if (!res.ok) return null;
      const data: { success?: boolean; country_code?: string } = await res.json();
      if (data.success === false || !data.country_code) return null;
      const code = data.country_code.toUpperCase();
      return REGIONS[code] ? code : null;
    } catch {
      return null;
    }
  };

  return Promise.race([fetchRegion(), timeout]);
}
