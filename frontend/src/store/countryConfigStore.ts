import { create } from "zustand";
import { REGIONS, type Region } from "../config/regions";
import {
  type Subdivision,
  getStaticSubdivisions,
  mergeSubdivisionLists,
} from "../config/subdivisions";
import {
  fetchCountryAdaptation,
  fetchCountryConfig,
  fetchCountryRegions,
} from "../lib/countryConfigApi";
import { USE_API } from "../lib/searchApi";
import { getSubdivisionPlural } from "../utils/subdivisionCopy";

export interface CountryConfig {
  code?: string;
  currency?: string;
  currencySymbol?: string;
  locale?: string;
  geography?: {
    subdivisionLabel?: string;
    subdivisionPlural?: string;
    cityLabel?: string;
  };
  features?: Record<string, boolean>;
  featureConfigs?: Record<string, { primaryScheme?: string }>;
  featureContexts?: Record<string, { insuranceProviders?: string[] }>;
  regions?: { id: string; name: string; code?: string }[];
  insuranceProviders?: string[];
}

interface CountryConfigState {
  config: CountryConfig | null;
  adaptation: {
    subdivisionLabel?: string;
    subdivisionPlural?: string;
    regions?: unknown[];
    insuranceProviders?: string[];
    featureContexts?: Record<string, unknown>;
  } | null;
  regions: Subdivision[];
  loading: boolean;
  regionsLoading: boolean;
  error: string | null;
  lastCountry: string | null;

  isFeatureEnabled: (feature: string) => boolean;
  loadRegionsForCountry: (code: string) => Promise<Subdivision[]>;
  loadForCountry: (countryCode: string) => Promise<void>;
  clear: () => void;
}

function minimalConfigForCountry(code: string): CountryConfig {
  const ui = REGIONS[code] || REGIONS.KE;
  return {
    code,
    currency: ui.currency,
    currencySymbol: ui.currencySymbol,
    locale: ui.locale,
    geography: {
      subdivisionLabel: ui.countiesLabel || "Region",
      subdivisionPlural: getSubdivisionPlural({
        subdivisionLabel: ui.countiesLabel || "Region",
      }),
      cityLabel: "City",
    },
    features: {},
  };
}

export const useCountryConfigStore = create<CountryConfigState>((set, get) => ({
  config: null,
  adaptation: null,
  regions: [],
  loading: false,
  regionsLoading: false,
  error: null,
  lastCountry: null,

  isFeatureEnabled: (feature) => Boolean(get().config?.features?.[feature]),

  loadRegionsForCountry: async (code) => {
    set({ regionsLoading: true });
    let apiRegions: unknown[] = [];
    try {
      const data = await fetchCountryRegions(code);
      apiRegions = Array.isArray(data) ? data : [];
    } catch {
      /* use static */
    }
    const merged = mergeSubdivisionLists(
      apiRegions as { id: string; name: string; code?: string; countryCode?: string }[] | undefined,
      code,
    );
    set({ regions: merged, regionsLoading: false });
    return merged;
  },

  loadForCountry: async (countryCode) => {
    if (!countryCode || countryCode === "GLOBAL") {
      set({
        config: null,
        adaptation: null,
        regions: [],
        lastCountry: countryCode,
        error: null,
        loading: false,
      });
      return;
    }

    const code = countryCode.toUpperCase();
    const staticFallback = getStaticSubdivisions(code);

    if (!USE_API) {
      set({
        config: minimalConfigForCountry(code),
        adaptation: null,
        regions: staticFallback,
        loading: false,
        regionsLoading: false,
        error: null,
        lastCountry: code,
      });
      return;
    }

    set({ loading: true, regionsLoading: true, error: null, lastCountry: code });

    let config: CountryConfig | null = null;
    let adaptation = null;
    let apiRegions: unknown[] = [];

    const [configResult, regionsResult, adaptationResult] = await Promise.allSettled([
      fetchCountryConfig(code),
      fetchCountryRegions(code),
      fetchCountryAdaptation(code),
    ]);

    if (configResult.status === "fulfilled" && configResult.value) {
      config = configResult.value as CountryConfig;
      if ((configResult.value as { regions?: unknown[] }).regions?.length) {
        apiRegions = (configResult.value as { regions?: unknown[] }).regions as unknown[];
      }
    }

    if (regionsResult.status === "fulfilled" && Array.isArray(regionsResult.value)) {
      apiRegions = regionsResult.value;
    }

    if (adaptationResult.status === "fulfilled" && adaptationResult.value) {
      adaptation = adaptationResult.value;
      if ((adaptationResult.value as { regions?: unknown[] }).regions?.length) {
        apiRegions = (adaptationResult.value as { regions?: unknown[] }).regions as unknown[];
      }
    }

    if (!config) {
      config = minimalConfigForCountry(code);
    }

    const regions = mergeSubdivisionLists(
      apiRegions as { id: string; name: string; code?: string; countryCode?: string }[] | undefined,
      code,
    );

    set({
      config,
      adaptation,
      regions,
      loading: false,
      regionsLoading: false,
      error: null,
    });
  },

  clear: () =>
    set({
      config: null,
      adaptation: null,
      regions: [],
      lastCountry: null,
      error: null,
      loading: false,
      regionsLoading: false,
    }),
}));

export type { Region };
