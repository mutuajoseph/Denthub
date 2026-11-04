import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useActiveCountryCode } from "../../hooks/useActiveCountryCode";
import { useCountries } from "../../hooks/useCountries";
import { useCountrySubdivisions } from "../../hooks/useCountrySubdivisions";
import {
  useCreateMySpecialist,
  useMySpecialist,
  useUpdateMySpecialist,
} from "../../hooks/useDentistMe";
import { useListingDetail } from "../../hooks/useListingDetail";
import { useListingSearch } from "../../hooks/useListingSearch";
import { useSpecialties } from "../../hooks/useSpecialties";
import { ApiError } from "../../lib/apiClient";
import type { AuthUser } from "../../lib/auth";
import type { MySpecialist } from "../../lib/dentistMeApi";
import { SpecialistListingSection } from "./SpecialistListingSection";

vi.mock("../../hooks/useActiveCountryCode", () => ({ useActiveCountryCode: vi.fn() }));
vi.mock("../../hooks/useCountries", () => ({ useCountries: vi.fn() }));
vi.mock("../../hooks/useCountrySubdivisions", () => ({ useCountrySubdivisions: vi.fn() }));
vi.mock("../../hooks/useDentistMe", () => ({
  useMySpecialist: vi.fn(),
  useCreateMySpecialist: vi.fn(),
  useUpdateMySpecialist: vi.fn(),
}));
vi.mock("../../hooks/useListingDetail", () => ({ useListingDetail: vi.fn() }));
vi.mock("../../hooks/useListingSearch", () => ({ useListingSearch: vi.fn() }));
vi.mock("../../hooks/useSpecialties", () => ({ useSpecialties: vi.fn() }));

const useActiveCountryCodeMock = vi.mocked(useActiveCountryCode);
const useCountriesMock = vi.mocked(useCountries);
const useCountrySubdivisionsMock = vi.mocked(useCountrySubdivisions);
const useMySpecialistMock = vi.mocked(useMySpecialist);
const useCreateMySpecialistMock = vi.mocked(useCreateMySpecialist);
const useUpdateMySpecialistMock = vi.mocked(useUpdateMySpecialist);
const useListingDetailMock = vi.mocked(useListingDetail);
const useListingSearchMock = vi.mocked(useListingSearch);
const useSpecialtiesMock = vi.mocked(useSpecialties);

const createMock = vi.fn();
const updateMock = vi.fn();
const refetchMock = vi.fn();

const user: AuthUser = {
  id: "user-1",
  email: "amina@example.com",
  full_name: "Amina Yusuf",
  phone: null,
  home_country_code: "KE",
  role: "patient",
  is_staff: false,
  account_status: "active",
  profiles: [{ kind: "patient" }, { kind: "specialist" }],
  memberships: [],
};

const listing: MySpecialist = {
  id: "sp-1",
  name: "Dr. Amina Yusuf",
  slug: "dr-amina-yusuf",
  bio: "Preventive dentistry.",
  avatarKey: null,
  countryCode: "KE",
  subdivisionCode: "NAIROBI",
  currency: "KES",
  verificationTier: "unverified",
  specialties: [
    {
      id: "spc-1",
      code: "orthodontics",
      name: "Orthodontics",
      description: null,
      display_order: 1,
    },
  ],
  branches: [
    {
      id: "br-1",
      facilityId: "f-1",
      facilityName: "SmileCare Dental Centre",
      name: "Westlands",
      subdivisionCode: "NAIROBI",
      address: "12 Peponi Road",
      phone: null,
      email: null,
      hours: [],
      openNow: false,
    },
  ],
};

function renderSection(currentUser: AuthUser = user) {
  return render(<SpecialistListingSection user={currentUser} />);
}

describe("SpecialistListingSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useActiveCountryCodeMock.mockReturnValue("KE");
    useCountriesMock.mockReturnValue({
      countries: [{ code: "KE", name: "Kenya" }],
      isLoading: false,
      error: null,
    } as never);
    useCountrySubdivisionsMock.mockReturnValue({
      data: {
        regions: [{ id: "KE-NAIROBI", code: "NAIROBI", name: "Nairobi", countryCode: "KE" }],
        geography: {
          subdivisionLabel: "County",
          subdivisionPlural: "Counties",
          cityLabel: "City",
        },
      },
      isPending: false,
      error: null,
    } as never);
    useSpecialtiesMock.mockReturnValue({
      options: [{ code: "orthodontics", name: "Orthodontics" }],
      nameOf: (code: string) => code,
      isLoading: false,
      error: null,
    } as never);
    useListingSearchMock.mockReturnValue({
      listings: [{ id: "f-1", name: "SmileCare Dental Centre" }],
      isLoading: false,
      isFetching: false,
      error: null,
      refetch: vi.fn(),
    } as never);
    useListingDetailMock.mockReturnValue({
      profile: { branches: listing.branches },
      isLoading: false,
      isFetching: false,
      error: null,
      refetch: vi.fn(),
    } as never);
    useCreateMySpecialistMock.mockReturnValue({
      mutate: createMock,
      isPending: false,
      isError: false,
      error: null,
    } as never);
    useUpdateMySpecialistMock.mockReturnValue({
      mutate: updateMock,
      isPending: false,
      isError: false,
      isSuccess: false,
      error: null,
    } as never);
  });

  it("renders nothing without a Specialist Profile", () => {
    const { container } = renderSection({
      ...user,
      profiles: [{ kind: "patient" }],
    });

    expect(container).toBeEmptyDOMElement();
  });

  it("offers the create form when the Specialist has no listing", async () => {
    const events = userEvent.setup();
    useMySpecialistMock.mockReturnValue({
      data: undefined,
      isPending: false,
      error: new ApiError("Specialist listing not found", { status: 404 }),
      refetch: refetchMock,
    } as never);

    renderSection();

    expect(screen.getByRole("button", { name: /create listing/i })).toBeInTheDocument();
    await events.selectOptions(screen.getByLabelText("County"), "NAIROBI");
    await events.click(screen.getByLabelText("Orthodontics"));
    await events.click(screen.getByRole("button", { name: /create listing/i }));

    expect(createMock).toHaveBeenCalledWith({
      name: "Amina Yusuf",
      country_code: "KE",
      subdivision_code: "NAIROBI",
      bio: null,
      specialty_codes: ["orthodontics"],
      branch_ids: [],
    });
  });

  it("edits the existing listing's bio, Specialties, and Workplaces", async () => {
    const events = userEvent.setup();
    useMySpecialistMock.mockReturnValue({
      data: listing,
      isPending: false,
      error: null,
      refetch: refetchMock,
    } as never);

    renderSection();

    await userEvent.clear(screen.getByLabelText("Bio"));
    await events.type(screen.getByLabelText("Bio"), "Now focused on children.");
    await events.click(screen.getByLabelText("Orthodontics"));
    await events.click(screen.getByRole("button", { name: "Remove" }));
    await events.click(screen.getByRole("button", { name: /save listing/i }));

    expect(updateMock).toHaveBeenCalledWith({
      name: "Dr. Amina Yusuf",
      country_code: "KE",
      subdivision_code: "NAIROBI",
      bio: "Now focused on children.",
      specialty_codes: [],
      branch_ids: [],
    });
  });

  it("surfaces a load failure with a retry", async () => {
    const events = userEvent.setup();
    useMySpecialistMock.mockReturnValue({
      data: undefined,
      isPending: false,
      error: new Error("offline"),
      refetch: refetchMock,
    } as never);

    renderSection();

    expect(screen.getByRole("alert")).toHaveTextContent("offline");
    await events.click(screen.getByRole("button", { name: /try again/i }));
    expect(refetchMock).toHaveBeenCalled();
  });
});
