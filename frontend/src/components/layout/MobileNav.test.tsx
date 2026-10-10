import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { CountryConfig } from "../../lib/countryConfigApi";
import { useCountryConfigStore } from "../../store/countryConfigStore";
import { useRegionStore } from "../../store/regionStore";
import { MobileNav } from "./MobileNav";

function makeConfig(code: string, features: Record<string, boolean> = {}): CountryConfig {
  return {
    code,
    name: "Kenya",
    currency: "KES",
    currencySymbol: "KSh",
    locale: "en-KE",
    geography: { subdivisionLabel: "County", subdivisionPlural: "Counties", cityLabel: "City" },
    features,
    featureConfigs: {},
    featureContexts: {},
    insuranceProviders: [],
    regions: [],
  };
}

function renderNav() {
  return render(
    <MemoryRouter>
      <MobileNav />
    </MemoryRouter>,
  );
}

describe("MobileNav", () => {
  beforeEach(() => {
    useRegionStore.setState({ regionCode: "KE", hasManualSelection: true });
    useCountryConfigStore.setState({
      config: makeConfig("KE", { CPD_TRAINING: true }),
      regions: [],
      lastCountry: "KE",
      error: null,
      loading: false,
      regionsLoading: false,
    });
  });

  afterEach(() => {
    useRegionStore.setState({ regionCode: "GLOBAL", hasManualSelection: false });
    useCountryConfigStore.setState({
      config: null,
      regions: [],
      lastCountry: null,
      error: null,
      loading: false,
      regionsLoading: false,
    });
  });

  it("lists Training when the market's flag is on", () => {
    renderNav();

    expect(screen.getByRole("link", { name: /^training/i })).toHaveAttribute("href", "/training");
  });

  it("removes Training when the market has switched it off", () => {
    useCountryConfigStore.setState({ config: makeConfig("KE", { CPD_TRAINING: false }) });

    renderNav();

    expect(screen.queryByRole("link", { name: /^training/i })).not.toBeInTheDocument();
  });
});
