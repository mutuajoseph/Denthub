import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./apiClient", () => ({
  getJson: vi.fn(),
}));

import { getJson } from "./apiClient";
import {
  fetchCountries,
  fetchCountryConfig,
  fetchSpecialties,
  fetchSubdivisions,
} from "./countryConfigApi";

const getJsonMock = vi.mocked(getJson);

const wireConfig = {
  code: "KE",
  name: "Kenya",
  currency: "KES",
  currency_symbol: "KSh",
  locale: "en-KE",
  default_locale: "en",
  timezone: "Africa/Nairobi",
  phone_prefix: "+254",
  geography: {
    subdivision_label: "County",
    subdivision_label_plural: "Counties",
    city_label: "City",
  },
  features: [
    { feature: "ORAL_CARE_SHOP", is_enabled: true, primary_scheme: null },
    { feature: "DENTAL_INSURANCE", is_enabled: false, primary_scheme: null },
  ],
  insurance_providers: [{ id: "i1", name: "NHIF", is_national: true }],
  subdivisions: [{ id: "KE-NBI", code: "NAIROBI", name: "Nairobi", country_code: "KE" }],
};

describe("countryConfigApi paths", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("asks for the country config at the relative path apiClient prefixes once", async () => {
    getJsonMock.mockResolvedValue(wireConfig);

    await fetchCountryConfig("KE");

    // Regression guard: these calls used to carry `${API_BASE}/...` into
    // getJson, which prepends `/api/v1` again, so every request 404'd and the
    // store silently fell back to static data.
    expect(getJsonMock).toHaveBeenCalledWith("/config/country", { countryCode: "KE" });
    expect(getJsonMock.mock.calls[0][0]).not.toMatch(/^\/api\/v1/);
  });

  it("omits the override header option when no country is passed", async () => {
    getJsonMock.mockResolvedValue(wireConfig);

    await fetchCountryConfig();

    expect(getJsonMock).toHaveBeenCalledWith("/config/country", {});
  });

  it("fetches subdivisions relative to the config resource", async () => {
    getJsonMock.mockResolvedValue({
      country_code: "KE",
      items: [{ id: "KE-NBI", code: "NAIROBI", name: "Nairobi", country_code: "KE" }],
    });

    const regions = await fetchSubdivisions("KE");

    expect(getJsonMock).toHaveBeenCalledWith("/config/country/regions", {
      query: { country: "KE" },
    });
    expect(regions).toEqual([
      // The wire id is discarded; the UI id is rebuilt from country + code.
      { id: "KE-NAIROBI", name: "Nairobi", code: "NAIROBI", countryCode: "KE" },
    ]);
  });

  it("fetches the country list and the specialty list relative", async () => {
    getJsonMock.mockResolvedValue({ items: [], default_country_code: "KE" });
    await fetchCountries();
    expect(getJsonMock).toHaveBeenCalledWith("/config/countries");

    getJsonMock.mockResolvedValue({
      items: [
        {
          id: "sp1",
          code: "orthodontics",
          name: "Orthodontics",
          description: null,
          display_order: 2,
        },
      ],
    });
    const specialties = await fetchSpecialties();
    expect(getJsonMock).toHaveBeenCalledWith("/config/specialties");
    expect(specialties).toHaveLength(1);
  });
});
