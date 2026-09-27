import { type Region, getRegionByCode } from "../config/regions";
import { useRegionStore } from "../store/regionStore";

function activeRegion(): Region {
  const state = useRegionStore.getState();
  const code = state.regionCode || state.getRegion().code;

  // GLOBAL is a display-only region; money always resolves to a real country.
  return getRegionByCode(code === "GLOBAL" ? "KE" : code);
}

/** Formats an amount in the active region's currency, without trailing decimals. */
export function formatMoney(amount: number): string {
  const region = activeRegion();

  return new Intl.NumberFormat(region.locale, {
    style: "currency",
    currency: region.currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Formats an amount in an explicit locale/currency pair. Use this for prices
 * the API resolved to a specific currency, which may differ from the region the
 * browser is currently set to.
 */
export function formatMoneyAs(amount: number, locale: string, currency: string): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}
