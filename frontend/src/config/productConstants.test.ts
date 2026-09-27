import { describe, expect, it } from "vitest";

import { ALL_CATEGORIES, buildCategoryOptions, getCategoryMeta } from "./productConstants";

describe("buildCategoryOptions", () => {
  it("always leads with the All sentinel", () => {
    expect(buildCategoryOptions(["floss", "brushing"])[0]).toBe(ALL_CATEGORIES);
  });

  it("keeps the canonical order for recognised categories", () => {
    // "floss" is canonical before "brushing", regardless of API order.
    expect(buildCategoryOptions(["brushing", "floss", "toothpaste"])).toEqual([
      ALL_CATEGORIES,
      "brushing",
      "toothpaste",
      "floss",
    ]);
  });

  it("appends unrecognised categories alphabetically instead of dropping them", () => {
    expect(buildCategoryOptions(["zzz-custom", "brushing", "aaa-other"])).toEqual([
      ALL_CATEGORIES,
      "brushing",
      "aaa-other",
      "zzz-custom",
    ]);
  });

  it("omits canonical categories the API did not report as stocked", () => {
    expect(buildCategoryOptions(["brushing"])).not.toContain("children");
  });

  it("still offers All when the API returned nothing", () => {
    expect(buildCategoryOptions([])).toEqual([ALL_CATEGORIES]);
  });
});

describe("getCategoryMeta", () => {
  it("returns the known label and icon for a recognised id", () => {
    expect(getCategoryMeta("brushing").label).toBe("Brushing");
  });

  it("falls back to a title-cased label for an unknown id", () => {
    const meta = getCategoryMeta("orthodontics");

    expect(meta.label).toBe("Orthodontics");
    expect(meta.icon).toBeTruthy();
  });
});
