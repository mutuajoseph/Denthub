import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ROLE, type Role } from "../auth/roles";
import type { AuthUser } from "../lib/auth";
import { type CountryConfig, fetchCountries } from "../lib/countryConfigApi";
import { useCountryConfigStore } from "../store/countryConfigStore";
import { useRegionStore } from "../store/regionStore";
import Navbar from "./Navbar";

vi.mock("../lib/countryConfigApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/countryConfigApi")>();

  return { ...actual, fetchCountries: vi.fn() };
});

function makeConfig(code: string): CountryConfig {
  return {
    code,
    name: "Kenya",
    currency: "KES",
    currencySymbol: "KSh",
    locale: "en-KE",
    geography: { subdivisionLabel: "County", subdivisionPlural: "Counties", cityLabel: "City" },
    features: {},
    featureConfigs: {},
    featureContexts: {},
    insuranceProviders: [],
    regions: [],
  };
}

function makeUser(role: Role): AuthUser {
  return {
    id: "user-1",
    email: "user@example.com",
    full_name: "Test User",
    role,
    is_staff: false,
    account_status: "active",
  };
}

function renderNavbar(user: AuthUser) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0, gcTime: 0 } },
  });

  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <Navbar onSignIn={vi.fn()} user={user} onLogout={vi.fn()} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

async function openAccountMenu(user: AuthUser) {
  const userEventApi = userEvent.setup();
  renderNavbar(user);
  await userEventApi.click(
    screen.getByRole("button", { name: `Account menu for ${user.full_name}` }),
  );
  return userEventApi;
}

describe("Navbar account menu", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(fetchCountries).mockResolvedValue({ items: [], default_country_code: "KE" });
    useRegionStore.setState({ regionCode: "KE", hasManualSelection: true });
    useCountryConfigStore.setState({
      config: makeConfig("KE"),
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

  it("offers a supplier account its store from the account menu", async () => {
    await openAccountMenu(makeUser(ROLE.SUPPLIER));

    expect(screen.getByRole("menuitem", { name: /dashboard/i })).toHaveAttribute(
      "href",
      "/dashboard",
    );
    expect(screen.getByRole("menuitem", { name: /my store/i })).toHaveAttribute(
      "href",
      "/dashboard/supplier",
    );
  });

  it("keeps the store link off other public accounts", async () => {
    await openAccountMenu(makeUser(ROLE.PATIENT));

    expect(screen.getByRole("menuitem", { name: /dashboard/i })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: /my store/i })).not.toBeInTheDocument();
  });

  it("gives a training provider a Training link to their dashboard", async () => {
    await openAccountMenu(makeUser(ROLE.TRAINING_PROVIDER));

    const link = screen.getByRole("menuitem", { name: "Training" });
    expect(link).toHaveAttribute("href", "/dashboard/training");
  });

  it("keeps the Training link off a patient's menu", async () => {
    await openAccountMenu(makeUser(ROLE.PATIENT));

    expect(screen.getByRole("menuitem", { name: "Dashboard" })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Training" })).toBeNull();
  });
});
