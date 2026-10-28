import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import App from "./App";
import { ROLE, type Role } from "./auth/roles";
import { NAV_LINKS } from "./components/Navbar";
import { getPageMeta } from "./hooks/usePageMeta";
import { ApiError } from "./lib/apiClient";
import { AUTH_STORAGE_KEY, type AuthResponse } from "./lib/auth";
import {
  type CountryConfig,
  fetchCountries,
  fetchCountryConfig,
  fetchSpecialties,
} from "./lib/countryConfigApi";
import { type FacilityDashboardWire, fetchFacilityDashboard } from "./lib/facilityApi";
import {
  type FacilityDetail,
  type SpecialistDetail,
  fetchFacilityDetail,
  fetchListingSearch,
  fetchSpecialistDetail,
} from "./lib/listingApi";
import { fetchMyStore } from "./lib/supplierApi";
import { fetchMyProviderDashboard } from "./lib/trainingProviderApi";

vi.mock("./lib/listingApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./lib/listingApi")>();

  return {
    ...actual,
    fetchListingSearch: vi.fn(),
    fetchFacilityDetail: vi.fn(),
    fetchSpecialistDetail: vi.fn(),
  };
});

vi.mock("./lib/countryConfigApi", () => ({
  fetchCountries: vi.fn(),
  fetchCountryConfig: vi.fn(),
  fetchSpecialties: vi.fn(),
}));

vi.mock("./lib/facilityApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./lib/facilityApi")>();
  return { ...actual, fetchFacilityDashboard: vi.fn() };
});

vi.mock("./lib/supplierApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./lib/supplierApi")>();

  return {
    ...actual,
    fetchMyStore: vi.fn(),
    createMyStore: vi.fn(),
    fetchMyProducts: vi.fn(),
    createProduct: vi.fn(),
    updateProduct: vi.fn(),
  };
});

vi.mock("./lib/trainingProviderApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./lib/trainingProviderApi")>();

  return {
    ...actual,
    fetchMyProviderDashboard: vi.fn(),
  };
});

const fetchListingSearchMock = vi.mocked(fetchListingSearch);
const fetchFacilityDetailMock = vi.mocked(fetchFacilityDetail);
const fetchSpecialistDetailMock = vi.mocked(fetchSpecialistDetail);
const fetchCountriesMock = vi.mocked(fetchCountries);
const fetchCountryConfigMock = vi.mocked(fetchCountryConfig);
const fetchSpecialtiesMock = vi.mocked(fetchSpecialties);
const fetchFacilityDashboardMock = vi.mocked(fetchFacilityDashboard);
const fetchMyStoreMock = vi.mocked(fetchMyStore);
const fetchMyProviderDashboardMock = vi.mocked(fetchMyProviderDashboard);

const facilityDetail: FacilityDetail = {
  listing: {
    id: "f-1",
    listing_type: "facility",
    name: "SmileCare Dental Centre",
    country_code: "KE",
    subdivision_code: "NAIROBI",
    specialty_codes: ["general-dentistry"],
    rating: "4.50",
    review_count: 12,
    list_price: "1500.00",
    currency: "KES",
    open_now: true,
    phone: "+254712345678",
    verification_tier: "verified",
    clinic_name: null,
  },
  address: "12 Peponi Road, Nairobi",
  phone: "+254712345678",
  email: "hello@smilecare.ke",
  verification_tier: "verified",
  branches: [],
};

const specialistDetail: SpecialistDetail = {
  listing: {
    id: "sp-1",
    listing_type: "specialist",
    name: "Dr. Wanjiku Kamau",
    country_code: "KE",
    subdivision_code: "NAIROBI",
    specialty_codes: ["general-dentistry"],
    rating: "4.50",
    review_count: 12,
    list_price: null,
    currency: "KES",
    open_now: true,
    phone: "+254711223344",
    verification_tier: null,
    clinic_name: "SmileCare Dental Centre",
  },
  slug: "dr-wanjiku-kamau",
  specialties: [],
  branches: [],
};

const facilityDashboard: FacilityDashboardWire = {
  facility_id: "f-1",
  facility_name: "SmileCare Dental Centre",
  country_code: "KE",
  today: [],
  pending_count: 0,
  staff: [],
};

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

function renderApp(path: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function seedAuth(role: Role): void {
  const auth: AuthResponse = {
    access_token: "test-token",
    token_type: "bearer",
    user: {
      id: "user-1",
      email: "user@example.com",
      full_name: "Test User",
      role,
      is_staff: role === ROLE.STAFF,
      account_status: "active",
      email_verified: true,
      profiles: [],
      memberships: [],
    },
  };

  window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(auth));
}

describe("App routes", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    window.localStorage.clear();
    fetchListingSearchMock.mockResolvedValue([]);
    fetchCountriesMock.mockResolvedValue({ items: [], default_country_code: "KE" });
    fetchCountryConfigMock.mockImplementation(async (code) => makeConfig(code ?? "KE"));
    fetchSpecialtiesMock.mockResolvedValue([]);
    fetchFacilityDetailMock.mockResolvedValue(facilityDetail);
    fetchSpecialistDetailMock.mockResolvedValue(specialistDetail);
    fetchFacilityDashboardMock.mockResolvedValue(facilityDashboard);
    fetchMyStoreMock.mockResolvedValue(null);
    fetchMyProviderDashboardMock.mockResolvedValue(null);
  });

  // Route screens are lazily imported (issue #66), so the first render commits
  // the Suspense fallback before the chunk resolves. Keep this first: the lazy
  // import cache means a route already rendered earlier shows no fallback.
  it("shows the route loading fallback while the screen chunk loads", () => {
    renderApp("/about");

    expect(screen.getByRole("status", { name: /loading/i })).toBeInTheDocument();
  });

  it("renders the home page at /", async () => {
    const { container } = renderApp("/");

    await waitFor(() => expect(container.querySelector("#hero-heading")).not.toBeNull());
  });

  it.each(["/dentists", "/find-dentist"])("renders dentist discovery at %s", async (path) => {
    renderApp(path);

    expect(
      await screen.findByRole("heading", { name: /find the right dental care/i }),
    ).toBeInTheDocument();
  });

  it("renders a profile at the typed route", async () => {
    renderApp("/dentists/facility/f-1");

    expect(
      await screen.findByRole("heading", { name: /smilecare dental centre/i }),
    ).toBeInTheDocument();
    expect(fetchFacilityDetailMock).toHaveBeenCalledWith("f-1", expect.anything());
    expect(fetchSpecialistDetailMock).not.toHaveBeenCalled();
  });

  it.each(["/dentists/sp-1", "/dentist/sp-1"])(
    "renders a profile at the legacy route %s via specialist fallback",
    async (path) => {
      fetchFacilityDetailMock.mockRejectedValue(
        new ApiError("Not found", { status: 404, code: "NOT_FOUND" }),
      );

      renderApp(path);

      expect(
        await screen.findByRole("heading", { name: /dr\. wanjiku kamau/i }),
      ).toBeInTheDocument();
      expect(fetchSpecialistDetailMock).toHaveBeenCalledWith("sp-1", expect.anything());
    },
  );

  it("renders the international patient page", async () => {
    renderApp("/international");

    expect(
      await screen.findByRole("heading", { name: /plan your dental journey/i }),
    ).toBeInTheDocument();
  });

  it("renders the emergency page", async () => {
    renderApp("/emergency");

    expect(
      await screen.findByRole("heading", { name: /find emergency dental care now/i }),
    ).toBeInTheDocument();
  });

  it("renders NotFound for unknown routes", async () => {
    renderApp("/definitely-not-a-page");

    expect(await screen.findByRole("heading", { name: /page not found/i })).toBeInTheDocument();
  });

  // Regression guard: every public navbar link used to fall through to NotFound.
  it.each(NAV_LINKS.map((link) => [link.label, link.href] as const))(
    "routes the %s nav link (%s) to a real page",
    async (_label, href) => {
      renderApp(href);

      // Wait for the lazy screen to replace the Suspense fallback, so the
      // assertion below runs against the rendered page, not a blank loading view.
      await waitFor(() => expect(screen.queryByRole("status", { name: /loading/i })).toBeNull());

      expect(screen.queryByRole("heading", { name: /page not found/i })).toBeNull();
    },
  );

  it("keeps dedicated page metadata for every non-home nav route", () => {
    // "/" intentionally reuses the home metadata, so it is excluded here.
    const nonHome = NAV_LINKS.filter((link) => link.href !== "/");
    expect(nonHome.length).toBeGreaterThan(0);

    for (const link of nonHome) {
      expect(getPageMeta(link.href, "DentHub").title).not.toMatch(/Complete Dental Platform/);
    }
  });

  it("titles typed and legacy dentist profile routes alike", () => {
    for (const path of ["/dentists/facility/f-1", "/dentists/sp-1", "/dentist/sp-1"]) {
      expect(getPageMeta(path, "DentHub").title).toMatch(/dentist profile/i);
    }
  });

  it("sends a guest from /dashboard to the routed sign-in page", async () => {
    renderApp("/dashboard");

    expect(
      await screen.findByRole("heading", { name: /sign in to your account/i }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /page not found/i })).toBeNull();
  });

  it("renders the standalone staff surface at /staff/access", async () => {
    renderApp("/staff/access");

    expect(await screen.findByRole("heading", { name: /staff sign in/i })).toBeInTheDocument();
    // The public login must not leak into the staff surface.
    expect(screen.queryByRole("heading", { name: /sign in to your account/i })).toBeNull();
    expect(screen.queryByRole("heading", { name: /page not found/i })).toBeNull();
  });

  it("renders the account shell for a signed-in patient", async () => {
    seedAuth(ROLE.PATIENT);

    renderApp("/dashboard");

    expect(await screen.findByRole("heading", { name: /your account/i })).toBeInTheDocument();
    expect(screen.getByText("user@example.com")).toBeInTheDocument();
  });

  it("keeps a signed-in staff user off /dashboard without a 404", async () => {
    seedAuth(ROLE.STAFF);

    const { container } = renderApp("/dashboard");

    await waitFor(() => expect(container.querySelector("#hero-heading")).not.toBeNull());
    expect(screen.queryByRole("heading", { name: /your account/i })).toBeNull();
    expect(screen.queryByRole("heading", { name: /page not found/i })).toBeNull();
  });

  it("sends a guest from /dashboard/facility to the routed sign-in page", () => {
    renderApp("/dashboard/facility");

    expect(screen.getByRole("heading", { name: /sign in to your account/i })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /page not found/i })).toBeNull();
  });

  it("sends a guest from /dashboard/training to the routed sign-in page", () => {
    renderApp("/dashboard/training");

    expect(screen.getByRole("heading", { name: /sign in to your account/i })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /page not found/i })).toBeNull();
  });

  it("sends a guest from /dashboard/supplier to the routed sign-in page", () => {
    renderApp("/dashboard/supplier");

    expect(screen.getByRole("heading", { name: /sign in to your account/i })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /page not found/i })).toBeNull();
  });

  it("renders the clinic dashboard for a signed-in facility owner", async () => {
    seedAuth(ROLE.FACILITY_OWNER);

    renderApp("/dashboard/facility");

    expect(
      await screen.findByRole("heading", { name: /smilecare dental centre/i }),
    ).toBeInTheDocument();
  });

  it("keeps a signed-in patient off /dashboard/facility without a 404", () => {
    seedAuth(ROLE.PATIENT);

    const { container } = renderApp("/dashboard/facility");

    expect(container.querySelector("#hero-heading")).not.toBeNull();
    expect(screen.queryByRole("heading", { name: /smilecare dental centre/i })).toBeNull();
    expect(screen.queryByRole("heading", { name: /page not found/i })).toBeNull();
  });

  it("renders the supplier storefront for a signed-in supplier", async () => {
    seedAuth(ROLE.SUPPLIER);

    renderApp("/dashboard/supplier");

    expect(await screen.findByRole("heading", { name: /set up your store/i })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /page not found/i })).toBeNull();
  });

  it("keeps a signed-in patient off /dashboard/supplier without a 404", () => {
    seedAuth(ROLE.PATIENT);

    const { container } = renderApp("/dashboard/supplier");

    expect(container.querySelector("#hero-heading")).not.toBeNull();
    expect(screen.queryByRole("heading", { name: /set up your store/i })).toBeNull();
    expect(screen.queryByRole("heading", { name: /page not found/i })).toBeNull();
  });

  it("keeps a patient off /dashboard/training without a 404", () => {
    seedAuth(ROLE.PATIENT);

    const { container } = renderApp("/dashboard/training");

    expect(container.querySelector("#hero-heading")).not.toBeNull();
    expect(screen.queryByRole("heading", { name: /page not found/i })).toBeNull();
  });

  it("renders the training dashboard for a training provider", async () => {
    seedAuth(ROLE.TRAINING_PROVIDER);

    renderApp("/dashboard/training");

    expect(
      await screen.findByRole("heading", { name: /create your provider profile/i }),
    ).toBeInTheDocument();
  });
});
