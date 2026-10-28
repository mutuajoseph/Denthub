import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  AdminAuditEntryWire,
  AdminCountryWire,
  ModerationItemWire,
  VerificationItemWire,
} from "../lib/adminApi";
import {
  fetchAdminAudit,
  fetchAdminCountries,
  fetchAdminModeration,
  fetchAdminVerifications,
  moderateMagazine,
  setFacilityVerificationTier,
  updateCountryFeature,
} from "../lib/adminApi";
import type { AuthUser } from "../lib/auth";
import { AdminDashboard } from "./AdminDashboard";

vi.mock("../lib/adminApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/adminApi")>();
  return {
    ...actual,
    fetchAdminCountries: vi.fn(),
    fetchAdminVerifications: vi.fn(),
    fetchAdminModeration: vi.fn(),
    fetchAdminAudit: vi.fn(),
    updateCountry: vi.fn(),
    updateCountryFeature: vi.fn(),
    setFacilityVerificationTier: vi.fn(),
    setSpecialistVerificationTier: vi.fn(),
    moderateMagazine: vi.fn(),
    moderateJob: vi.fn(),
  };
});

const fetchAdminCountriesMock = vi.mocked(fetchAdminCountries);
const fetchAdminVerificationsMock = vi.mocked(fetchAdminVerifications);
const fetchAdminModerationMock = vi.mocked(fetchAdminModeration);
const fetchAdminAuditMock = vi.mocked(fetchAdminAudit);
const updateCountryFeatureMock = vi.mocked(updateCountryFeature);
const setFacilityVerificationTierMock = vi.mocked(setFacilityVerificationTier);
const moderateMagazineMock = vi.mocked(moderateMagazine);

const admin: AuthUser = {
  id: "user-admin",
  email: "admin@example.com",
  full_name: "Asha Admin",
  role: "admin",
  is_staff: true,
  account_status: "active",
  profiles: [],
  memberships: [],
};

function country(overrides: Partial<AdminCountryWire> = {}): AdminCountryWire {
  return {
    code: "KE",
    name: "Kenya",
    currency: "KES",
    currency_symbol: "KSh",
    is_active: true,
    features: [
      { feature: "JOBS_BOARD", is_enabled: true, primary_scheme: null },
      { feature: "CPD_TRAINING", is_enabled: false, primary_scheme: null },
    ],
    ...overrides,
  };
}

function verification(overrides: Partial<VerificationItemWire> = {}): VerificationItemWire {
  return {
    entity_type: "facility",
    id: "f-1",
    name: "Nyali Coastal Dental",
    country_code: "KE",
    verification_tier: "unverified",
    ...overrides,
  };
}

function moderationItem(overrides: Partial<ModerationItemWire> = {}): ModerationItemWire {
  return {
    entity_type: "magazine",
    id: "m-1",
    title: "Brushing basics",
    status: "published",
    country_code: "KE",
    ...overrides,
  };
}

function auditEntry(overrides: Partial<AdminAuditEntryWire> = {}): AdminAuditEntryWire {
  return {
    id: 1,
    actor_email: "admin@example.com",
    actor_role: "admin",
    action: "country.feature.update",
    entity_type: "country_feature",
    entity_id: "KE:CPD_TRAINING",
    before: { is_enabled: true, primary_scheme: null },
    after: { is_enabled: false, primary_scheme: null },
    created_at: "2030-01-01T10:00:00Z",
    ...overrides,
  };
}

function renderAdmin(user: AuthUser | null) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0, gcTime: 0 } },
  });

  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <AdminDashboard user={user} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("AdminDashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchAdminCountriesMock.mockResolvedValue({ items: [country()] });
    fetchAdminVerificationsMock.mockResolvedValue({
      items: [verification()],
      tiers: ["unverified", "basic", "verified", "featured"],
    });
    fetchAdminModerationMock.mockResolvedValue({ items: [moderationItem()] });
    fetchAdminAuditMock.mockResolvedValue({ items: [auditEntry()] });
    updateCountryFeatureMock.mockResolvedValue({
      feature: "CPD_TRAINING",
      is_enabled: true,
      primary_scheme: null,
    });
    setFacilityVerificationTierMock.mockResolvedValue(
      verification({ verification_tier: "verified" }),
    );
    moderateMagazineMock.mockResolvedValue(moderationItem({ status: "hidden" }));
  });

  it("renders nothing without a user", () => {
    const { container } = renderAdmin(null);

    expect(container).toBeEmptyDOMElement();
    expect(fetchAdminCountriesMock).not.toHaveBeenCalled();
  });

  it("shows markets, verification, moderation and the audit trail", async () => {
    renderAdmin(admin);

    expect(await screen.findByRole("heading", { name: "Administration" })).toBeInTheDocument();
    expect(await screen.findByText("Kenya")).toBeInTheDocument();
    expect(await screen.findByText("Nyali Coastal Dental")).toBeInTheDocument();
    expect(await screen.findByText("Brushing basics")).toBeInTheDocument();
    expect(await screen.findByText("Feature flag changed")).toBeInTheDocument();
  });

  it("toggles a feature flag", async () => {
    renderAdmin(admin);

    await userEvent.click(await screen.findByRole("button", { name: "Disabled" }));

    expect(updateCountryFeatureMock).toHaveBeenCalledWith("KE", "CPD_TRAINING", {
      is_enabled: true,
      primary_scheme: null,
    });
  });

  it("sets a Facility verification tier", async () => {
    renderAdmin(admin);

    await userEvent.selectOptions(await screen.findByLabelText(/tier/i), "verified");

    expect(setFacilityVerificationTierMock).toHaveBeenCalledWith("f-1", "verified");
  });

  it("hides a published magazine item", async () => {
    renderAdmin(admin);

    await userEvent.click(await screen.findByRole("button", { name: "Hide" }));

    expect(moderateMagazineMock).toHaveBeenCalledWith("m-1", "hidden");
  });

  it("surfaces a load failure with a retry", async () => {
    fetchAdminCountriesMock.mockRejectedValue(new Error("offline"));

    renderAdmin(admin);

    expect(await screen.findByRole("alert")).toHaveTextContent("offline");
    expect(screen.getAllByRole("button", { name: /try again/i }).length).toBeGreaterThan(0);
  });
});
