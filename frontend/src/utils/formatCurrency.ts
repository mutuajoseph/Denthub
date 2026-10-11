/**
 * Formats an amount in the active market's currency.
 *
 * The market's currency and locale come from country configuration, never from
 * a hardcoded country→currency map. Before a config lands (or when it fails) an
 * amount renders as a plain decimal number rather than pretending to know the
 * currency.
 */
function isValidLocale(locale: string): boolean {
  if (!locale || locale.trim() === "") return false;
  // BCP-47 language tags: optional script/region after language code
  // e.g., "en", "en-KE", "tr-TR", "en-US"
  const tag = locale.trim().toLowerCase();
  return /^[a-z]{2,3}(-[a-z0-9]+)*$/.test(tag);
}

export function formatMoney(amount: number): string {
  const config = useCountryConfigStore.getState().config;
  const locale = isValidLocale(config?.locale) ? config.locale : undefined;
  return formatPrice(amount, config?.currency ?? "", locale);
}

/**
 * Formats an amount in an explicit locale/currency pair. Use this for prices
 * the API resolved to a specific currency, which may differ from the region the
 * browser is currently set to.
 */
export function formatMoneyAs(amount: number, locale: string, currency: string): string {
  const resolvedLocale = isValidLocale(locale) ? locale : undefined;
  return new Intl.NumberFormat(resolvedLocale, {
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

  const options: Intl.NumberFormatOptions = currency
    ? {
        style: "currency",
        currency,
        minimumFractionDigits: hasCents ? 2 : 0,
        maximumFractionDigits: hasCents ? 2 : 0,
      }
    : {
        style: "decimal",
        minimumFractionDigits: hasCents ? 2 : 0,
        maximumFractionDigits: hasCents ? 2 : 0,
      };

  const resolvedLocale = isValidLocale(locale) ? locale : undefined;
  return new Intl.NumberFormat(resolvedLocale, options).format(amount);
}

/**
 * Formats an exact decimal-string price the listings API returned (`list_price`).
 *
 * The cents decision is made on the string, never on float arithmetic, so an
 * exact `NUMERIC(12,2)` value keeps its cents (`1500.50` → "KES 1,500.50")
 * while a whole amount reads clean (`1500.00` → "KES 1,500"). `null` passes
 * through so a caller can hide an unpriced tile.
 */
export function formatListingPrice(
  amount: string | null,
  currency: string,
  locale?: string,
): string | null {
  if (amount === null || amount.trim() === "") return null;

  const [, fraction = ""] = amount.split(".");
  const hasCents = fraction.replace(/0+$/, "") !== "";
  // NUMERIC(12,2) holds at most 10 integer digits, so this is exact for every
  // value the column can store; only Intl's rendering goes through a number.
  const value = Number(amount);
  if (!Number.isFinite(value)) return null;

  const options: Intl.NumberFormatOptions = currency
    ? {
        style: "currency",
        currency,
        minimumFractionDigits: hasCents ? 2 : 0,
        maximumFractionDigits: hasCents ? 2 : 0,
      }
    : {
        style: "decimal",
        minimumFractionDigits: hasCents ? 2 : 0,
        maximumFractionDigits: hasCents ? 2 : 0,
      };

  const resolvedLocale = isValidLocale(locale) ? locale : undefined;
  return new Intl.NumberFormat(resolvedLocale, options).format(value);
}