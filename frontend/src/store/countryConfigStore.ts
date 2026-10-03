import { create } from "zustand";
import { REGIONS, type Region } from "../config/regions";
import {
  type Subdivision,
  getStaticSubdivisions,
  mergeSubdivisionLists,
} from "../config/subdivisions";
import { type CountryConfig, fetchCountryConfig, fetchSubdivisions } from "../lib/countryConfigApi";
import { USE_API } from "../lib/searchApi";
import { getSubdivisionPlural } from "../utils/subdivisionCopy";

export type { CountryConfig };

interface CountryConfigState {
  config: CountryConfig | null;
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

/**
 * The last-resort config when the API is unreachable: a country's labels and
 * currency with no features and no regions, so a page renders with the right
 * words instead of an error. Every other path reads real data.
 */
function minimalConfigForCountry(code: string): CountryConfig {
  const ui = REGIONS[code] || REGIONS.KE;
  const subdivisionLabel = ui.countiesLabel || "Region";

  return {
    code,
    currency: ui.currency,
    currencySymbol: ui.currencySymbol,
    locale: ui.locale,
    geography: {
      subdivisionLabel,
      subdivisionPlural: getSubdivisionPlural({ subdivisionLabel }),
      cityLabel: "City",
    },
    features: {},
    featureConfigs: {},
    featureContexts: {},
    insuranceProviders: [],
    regions: [],
  };
}

export const useCountryConfigStore = create<CountryConfigState>((set, get) => ({
  config: null,
  regions: [],
  loading: false,
  regionsLoading: false,
  error: null,
  lastCountry: null,

  isFeatureEnabled: (feature) => Boolean(get().config?.features?.[feature]),

  loadRegionsForCountry: async (code) => {
    set({ regionsLoading: true });
    let apiRegions: Subdivision[] = [];

    try {
      apiRegions = await fetchSubdivisions(code);
    } catch {
      /* fall through to the static list */
    }

    const merged = mergeSubdivisionLists(apiRegions, code);
    set({ regions: merged, regionsLoading: false });
    return merged;
  },

  loadForCountry: async (countryCode) => {
    if (!countryCode || countryCode === "GLOBAL") {
      set({
        config: null,
        regions: [],
        lastCountry: countryCode,
        error: null,
        loading: false,
        regionsLoading: false,
      });
      return;
    }

    const code = countryCode.toUpperCase();
    const staticFallback = getStaticSubdivisions(code);

    if (!USE_API) {
      set({
        config: minimalConfigForCountry(code),
        regions: staticFallback,
        loading: false,
        regionsLoading: false,
        error: null,
        lastCountry: code,
      });
      return;
    }

    set({ loading: true, regionsLoading: true, error: null, lastCountry: code });

    // The config already embeds its subdivisions, so a country switch is one
    // request. The second call is the error path: if the config arrives, a
    // failure here only costs us nothing.
    const [configResult, regionsResult] = await Promise.allSettled([
      fetchCountryConfig(code),
      fetchSubdivisions(code),
    ]);

    if (configResult.status === "rejected") {
      set({
        config: minimalConfigForCountry(code),
        regions: staticFallback,
        loading: false,
        regionsLoading: false,
        error: "Could not load the country configuration.",
        lastCountry: code,
      });
      return;
    }

    const config = configResult.value;
    const apiRegions =
      regionsResult.status === "fulfilled" && regionsResult.value.length > 0
        ? regionsResult.value
        : config.regions;

    set({
      config,
      regions: mergeSubdivisionLists(apiRegions, code),
      loading: false,
      regionsLoading: false,
      error: null,
    });
  },

  clear: () =>
    set({
      config: null,
      regions: [],
      lastCountry: null,
      error: null,
      loading: false,
      regionsLoading: false,
    }),
}));

export type { Region };
