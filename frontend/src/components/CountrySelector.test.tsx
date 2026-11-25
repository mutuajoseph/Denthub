import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fetchCountries } from "../lib/countryConfigApi";
import { useCountryConfigStore } from "../store/countryConfigStore";
import { useRegionStore } from "../store/regionStore";
import CountrySelector from "./CountrySelector";

vi.mock("../lib/countryConfigApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/countryConfigApi")>();

  return { ...actual, fetchCountries: vi.fn() };
});

function renderSelector() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0, gcTime: 0 } },
  });

  return render(
    <QueryClientProvider client={client}>
      <CountrySelector />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(useCountryConfigStore.getState(), "loadForCountry").mockResolvedValue();
  vi.mocked(fetchCountries).mockResolvedValue({
    items: [
      {
        code: "KE",
        name: "Kenya",
        currency: "KES",
        currency_symbol: "KSh",
        locale: "en-KE",
        timezone: "Africa/Nairobi",
        subdivision_label: "County",
        subdivision_label_plural: "Counties",
      },
      {
        code: "US",
        name: "United States",
        currency: "USD",
        currency_symbol: "$",
        locale: "en-US",
        timezone: "America/New_York",
        subdivision_label: "State",
        subdivision_label_plural: "States",
      },
    ],
    default_country_code: "KE",
  });
  useRegionStore.setState({ regionCode: "KE", hasManualSelection: true });
});

afterEach(() => {
  vi.restoreAllMocks();
  useRegionStore.setState({ regionCode: "GLOBAL", hasManualSelection: false });
});

describe("CountrySelector flags", () => {
  it("shows the selected country's flag instead of the globe", async () => {
    renderSelector();

    const button = await screen.findByRole("button", { name: "Current country: Kenya" });
    expect(button.querySelector("svg")?.getAttribute("class")).toContain("w-[27px]");
  });

  it("shows a flag per country in the dropdown and keeps the globe for Worldwide", async () => {
    const user = userEvent.setup();
    renderSelector();

    await user.click(await screen.findByRole("button", { name: "Current country: Kenya" }));

    const kenya = await screen.findByRole("menuitem", { name: "Kenya" });
    expect(kenya.querySelector("svg")?.getAttribute("class")).toContain("w-5");

    const worldwide = screen.getByRole("menuitem", { name: "Worldwide" });
    expect(worldwide.querySelector("svg")?.getAttribute("class")).toContain("lucide-globe");
  });

  it("updates the flag when the country changes", async () => {
    const user = userEvent.setup();
    renderSelector();

    await user.click(await screen.findByRole("button", { name: "Current country: Kenya" }));
    await user.click(await screen.findByRole("menuitem", { name: "United States" }));

    const button = screen.getByRole("button", { name: "Current country: United States" });
    expect(button.querySelector("svg")?.getAttribute("class")).toContain("w-[27px]");
  });
});
