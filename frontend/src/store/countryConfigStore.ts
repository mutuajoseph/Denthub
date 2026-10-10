import { create } from "zustand";
import { type CountryConfig, type Subdivision, fetchCountryConfig } from "../lib/countryConfigApi";

export type { CountryConfig };

interface CountryConfigState {
  config: CountryConfig | null;
  regions: Subdivision[];
  loading: boolean;
  regionsLoading: boolean;
  error: string | null;
  lastCountry: string | null;

  isFeatureEnabled: (feature: string) => boolean;
  loadForCountry: (countryCode: string) => Promise<void>;
  clear: () => void;
}

export const useCountryConfigStore = create<CountryConfigState>((set, get) => ({
  config: null,
  regions: [],
  loading: false,
  regionsLoading: false,
  error: null,
  lastCountry: null,

  isFeatureEnabled: (feature) => Boolean(get().config?.features?.[feature]),

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

    set({ loading: true, error: null, lastCountry: code });

    try {
      const config = await fetchCountryConfig(code);
      set({ config, regions: config.regions, loading: false, regionsLoading: false, error: null });
    } catch {
      // Fail loudly: no static fallback to paper over a missing market.
      set({
        loading: false,
        regionsLoading: false,
        error: "Could not load the country configuration.",
      });
    }
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
