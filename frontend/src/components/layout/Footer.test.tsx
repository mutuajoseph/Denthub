import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { CountryConfig } from "../../lib/countryConfigApi";
import { useCountryConfigStore } from "../../store/countryConfigStore";
import { useRegionStore } from "../../store/regionStore";
import { Footer } from "./Footer";

function makeConfig(code: string, features: Record<string, boolean> = {}): CountryConfig {
  return {
    code,
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

function renderFooter() {
  return render(
    <MemoryRouter>
      <Footer />
    </MemoryRouter>,
  );
}

describe("Footer", () => {
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

  it("links to CPD training when the market's flag is on", () => {
    renderFooter();

    expect(screen.getByRole("link", { name: "CPD Training" })).toHaveAttribute("href", "/training");
  });

  it("hides the CPD training link when the market has switched it off", () => {
    useCountryConfigStore.setState({ config: makeConfig("KE", { CPD_TRAINING: false }) });

    renderFooter();

    expect(screen.queryByRole("link", { name: "CPD Training" })).not.toBeInTheDocument();
  });
});
