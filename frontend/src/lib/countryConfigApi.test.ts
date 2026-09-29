/**
 * The wire->UI mapper is the client's copy of the backend contract, so these
 * tests pin the translation: what the API sends becomes what components read.
 */

import { describe, expect, it } from "vitest";
import type { CountryConfigWire } from "./countryConfigApi";
import { mapCountryConfig } from "./countryConfigApi";

const KENYA: CountryConfigWire = {
  code: "KE",
  name: "Kenya",
  currency: "KES",
  currency_symbol: "KSh",
  locale: "en-KE",
  default_locale: "en-KE",
  timezone: "Africa/Nairobi",
  phone_prefix: "+254",
  geography: {
    subdivision_label: "County",
    subdivision_label_plural: "Counties",
    city_label: "Town",
  },
  features: [
    { feature: "DENTAL_INSURANCE", is_enabled: true, primary_scheme: "NHIF" },
    { feature: "ORAL_CARE_SHOP", is_enabled: true, primary_scheme: null },
  ],
  insurance_providers: [
    { name: "NHIF", is_national: true },
    { name: "Britam", is_national: false },
  ],
  subdivisions: [
    { code: "MOMBASA", name: "Mombasa", country_code: "KE" },
    { code: "NAIROBI", name: "Nairobi", country_code: "KE" },
  ],
};

describe("mapCountryConfig", () => {
  it("turns the geography labels into the camelCase keys components read", () => {
    const config = mapCountryConfig(KENYA);

    expect(config.geography).toEqual({
      subdivisionLabel: "County",
      subdivisionPlural: "Counties",
      cityLabel: "Town",
    });
  });

  it("flattens the features list into a lookup by key", () => {
    const config = mapCountryConfig(KENYA);

    expect(config.features.DENTAL_INSURANCE).toBe(true);
    expect(config.features.ORAL_CARE_SHOP).toBe(true);
  });

  it("keeps the primary scheme, and null when a feature has none", () => {
    const config = mapCountryConfig(KENYA);

    expect(config.featureConfigs.DENTAL_INSURANCE?.primaryScheme).toBe("NHIF");
    expect(config.featureConfigs.ORAL_CARE_SHOP?.primaryScheme).toBeNull();
  });

  it("lists every insurance provider under the insurance feature context", () => {
    const config = mapCountryConfig(KENYA);

    expect(config.featureContexts.DENTAL_INSURANCE?.insuranceProviders).toEqual(["NHIF", "Britam"]);
  });

  it("surfaces only the national scheme as the headline provider", () => {
    const config = mapCountryConfig(KENYA);

    expect(config.insuranceProviders).toEqual(["NHIF"]);
  });

  it("gives a subdivision a stable id built from its country and code", () => {
    const config = mapCountryConfig(KENYA);

    expect(config.regions).toEqual([
      { id: "KE-MOMBASA", name: "Mombasa", code: "MOMBASA", countryCode: "KE" },
      { id: "KE-NAIROBI", name: "Nairobi", code: "NAIROBI", countryCode: "KE" },
    ]);
  });

  it("leaves a feature the market does not offer absent rather than false", () => {
    const config = mapCountryConfig(KENYA);

    // A caller reads a missing key as "not offered here".
    expect(config.features.CPD_TRAINING).toBeUndefined();
  });
});
