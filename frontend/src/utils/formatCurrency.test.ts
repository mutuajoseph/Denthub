import { describe, expect, it } from "vitest";

import { formatPrice } from "./formatCurrency";

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
