import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  DEFAULT_REGION_CODE,
  REGIONS,
  type Region,
  detectRegionByIP,
  detectRegionCode,
  getBrandName,
  getRegionByCode,
} from "../config/regions";
import { useCountryConfigStore } from "./countryConfigStore";

interface RegionState {
  regionCode: string | null;
  hasManualSelection: boolean;

  getRegion: () => Region;
  getBrandName: () => string;
  setRegion: (code: string) => void;
  initRegion: () => void;
}

export const useRegionStore = create<RegionState>()(
  persist(
    (set, get) => ({
      regionCode: null,
      hasManualSelection: false,

      getRegion: () => {
        const code = get().regionCode || detectRegionCode();
        return getRegionByCode(code);
      },

      getBrandName: () => getBrandName(get().getRegion()),

      setRegion: (code) => {
        set({ regionCode: code, hasManualSelection: true });
        const resolved = code === "GLOBAL" ? null : code;
        if (resolved) {
          void useCountryConfigStore.getState().loadForCountry(resolved);
        } else {
          useCountryConfigStore.getState().clear();
        }
      },

      initRegion: () => {
        const { regionCode, hasManualSelection } = get();

        if (hasManualSelection) {
          if (regionCode && !REGIONS[regionCode]) {
            set({ regionCode: DEFAULT_REGION_CODE });
          }
          return;
        }

        if (regionCode && REGIONS[regionCode]) {
          return;
        }

        if (!regionCode) {
          set({ regionCode: detectRegionCode() });
        }

        void detectRegionByIP().then((ipCode) => {
          const { regionCode: current, hasManualSelection: manual } = get();
          if (manual) return;
          if (ipCode && REGIONS[ipCode] && current !== ipCode) {
            set({ regionCode: ipCode });
          }
        });
      },
    }),
    {
      name: "denthub-region",
      partialize: (s) => ({
        regionCode: s.regionCode,
        hasManualSelection: s.hasManualSelection,
      }),
    },
  ),
);
