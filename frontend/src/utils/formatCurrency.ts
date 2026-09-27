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

/**
 * Formats a catalog price in the currency the API resolved it to.
 *
 * Unlike {@link formatMoneyAs} this keeps cents when there are any, because the
 * backend returns exact `NUMERIC(12,2)` money and a derived wholesale price is
 * not necessarily a whole unit (`350 * 0.75` is `262.50`). Whole amounts still
 * render without decimals, so `350` reads as "350" rather than "350.00".
 */
export function formatPrice(amount: number, currency: string, locale?: string): string {
  const hasCents = Math.round(amount * 100) % 100 !== 0;

  return new Intl.NumberFormat(locale || undefined, {
    style: "currency",
    currency: currency || "KES",
    minimumFractionDigits: hasCents ? 2 : 0,
    maximumFractionDigits: hasCents ? 2 : 0,
  }).format(amount);
}
