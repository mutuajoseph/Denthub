import { describe, expect, it } from "vitest";

import { formatListingPrice, formatPrice } from "./formatCurrency";

/**
 * `Intl.NumberFormat` separates the currency from the digits with U+00A0
 * (non-breaking space), which renders identically to a plain space. `\s` in JS
 * matches U+00A0, so collapsing all whitespace makes assertions read as
 * written. (Component tests get this for free: testing-library's text matcher
 * normalises whitespace, so only direct equality needed the help.)
 */
function price(amount: number, currency: string, locale?: string): string {
  return formatPrice(amount, currency, locale).replace(/\s/g, " ");
}

// Pinned to `en-US` because that locale renders the 3-letter ISO code. Other
// locales may use a narrow symbol instead (`en-KE` renders "Ksh", not "KES"),
// which is correct output but makes assertions locale-dependent.
const LOCALE = "en-US";

describe("formatPrice", () => {
  it("formats whole amounts without trailing decimals", () => {
    // "KES 350" reads better than "KES 350.00" on a product card.
    expect(price(350, "KES", LOCALE)).toBe("KES 350");
  });

  it("keeps cents when the amount has them", () => {
    // A derived wholesale price is not a whole unit; rounding it would lie.
    expect(price(262.5, "KES", LOCALE)).toBe("KES 262.50");
    expect(price(337.5, "KES", LOCALE)).toBe("KES 337.50");
  });

  it("uses the currency the API resolved, not a hard-coded one", () => {
    expect(price(350, "UGX", LOCALE)).toBe("UGX 350");
  });

  it("falls back to KES when no currency is supplied", () => {
    expect(price(350, "", LOCALE)).toBe("KES 350");
  });

  it("defaults to the runtime locale when none is given", () => {
    expect(price(350, "KES")).toBe("KES 350");
  });
});

function listingPrice(amount: string | null, currency: string, locale?: string): string | null {
  const formatted = formatListingPrice(amount, currency, locale);
  return formatted === null ? null : formatted.replace(/\s/g, " ");
}

describe("formatListingPrice", () => {
  it("decides cents on the string, not float arithmetic", () => {
    // "1500.00" has no real cents; "1500.50" does. Parsing to a number first
    // would make both of these indistinguishable from other float noise.
    expect(listingPrice("1500.00", "KES", LOCALE)).toBe("KES 1,500");
    expect(listingPrice("1500.50", "KES", LOCALE)).toBe("KES 1,500.50");
    expect(listingPrice("0.10", "KES", LOCALE)).toBe("KES 0.10");
  });

  it("passes null through so an unpriced tile can hide the block", () => {
    expect(listingPrice(null, "KES", LOCALE)).toBeNull();
    expect(listingPrice("   ", "KES", LOCALE)).toBeNull();
  });

  it("returns null for an unparseable amount instead of rendering NaN", () => {
    expect(listingPrice("not-a-number", "KES", LOCALE)).toBeNull();
  });

  it("uses the currency the API resolved and falls back to KES", () => {
    expect(listingPrice("500.00", "NGN", LOCALE)).toBe("NGN 500");
    expect(listingPrice("500.00", "", LOCALE)).toBe("KES 500");
  });
});
