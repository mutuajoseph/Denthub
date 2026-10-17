import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AppointmentWire } from "../lib/appointmentApi";
import type { AuthUser } from "../lib/auth";
import type { FacilityDashboardWire, FacilityStaffWire } from "../lib/facilityApi";
import { fetchFacilityDashboard, updateFacilityAppointment } from "../lib/facilityApi";
import { FacilityDashboard } from "./FacilityDashboard";

vi.mock("../lib/facilityApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/facilityApi")>();
  return { ...actual, fetchFacilityDashboard: vi.fn(), updateFacilityAppointment: vi.fn() };
});

const fetchFacilityDashboardMock = vi.mocked(fetchFacilityDashboard);
const updateFacilityAppointmentMock = vi.mocked(updateFacilityAppointment);

const owner: AuthUser = {
  id: "user-1",
  email: "owner@example.com",
  full_name: "Sam Otieno",
  role: "facility_owner",
  is_staff: false,
  account_status: "active",
};

function appointment(overrides: Partial<AppointmentWire> = {}): AppointmentWire {
  return {
    id: "a-1",
    listing_type: "facility",
    listing_id: "f-1",
    listing_name: "Smile Point Dental",
    status: "PENDING",
    scheduled_at: "2030-01-01T09:30:00",
    note: null,
    country_code: "KE",
    created_at: "2029-12-01T10:00:00",
    ...overrides,
  };
}

function staff(overrides: Partial<FacilityStaffWire> = {}): FacilityStaffWire {
  return { id: "s-1", full_name: "Grace Wanjiku", role: "front_office", ...overrides };
}

function dashboard(overrides: Partial<FacilityDashboardWire> = {}): FacilityDashboardWire {
  return {
    facility_id: "f-1",
    facility_name: "Smile Point Dental",
    country_code: "KE",
    today: [],
    pending_count: 0,
    staff: [],
    ...overrides,
  };
}

function renderFacility(user: AuthUser | null) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0, gcTime: 0 } },
  });

  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <FacilityDashboard user={user} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("FacilityDashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchFacilityDashboardMock.mockResolvedValue(dashboard());
    updateFacilityAppointmentMock.mockResolvedValue(appointment({ status: "CONFIRMED" }));
  });

  it("renders nothing without a user", () => {
    const { container } = renderFacility(null);

    expect(container).toBeEmptyDOMElement();
    expect(fetchFacilityDashboardMock).not.toHaveBeenCalled();
  });

  it("shows the clinic name, its counts, and today's bookings", async () => {
    fetchFacilityDashboardMock.mockResolvedValue(
      dashboard({
        today: [
          appointment(),
          appointment({
            id: "a-2",
            status: "CONFIRMED",
            scheduled_at: "2030-01-01T14:00:00",
            note: "Bring X-ray",
          }),
        ],
        pending_count: 3,
        staff: [staff()],
      }),
    );

    renderFacility(owner);

    expect(await screen.findByRole("heading", { name: "Smile Point Dental" })).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("1 Jan 2030, 09:30")).toBeInTheDocument();
    expect(screen.getByText("Bring X-ray")).toBeInTheDocument();
    expect(screen.getByText("Grace Wanjiku")).toBeInTheDocument();
  });

  it("offers only the next forward step per appointment", async () => {
    fetchFacilityDashboardMock.mockResolvedValue(
      dashboard({
        today: [
          appointment({ id: "a-1", status: "PENDING" }),
          appointment({ id: "a-2", status: "CONFIRMED" }),
          appointment({ id: "a-3", status: "COMPLETED" }),
        ],
      }),
    );

    renderFacility(owner);

    expect(await screen.findByRole("button", { name: "Confirm" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Check in" })).toBeInTheDocument();
    // Nothing is in progress, and a completed appointment is terminal: no step
    // button, only its status chip.
    expect(screen.queryByRole("button", { name: "Complete" })).not.toBeInTheDocument();
    expect(screen.getByText("Completed")).toBeInTheDocument();
  });

  it("advances an appointment one step when its action is pressed", async () => {
    fetchFacilityDashboardMock.mockResolvedValue(dashboard({ today: [appointment()] }));

    renderFacility(owner);

    await userEvent.click(await screen.findByRole("button", { name: "Confirm" }));

    expect(updateFacilityAppointmentMock).toHaveBeenCalledWith("a-1", "CONFIRMED");
  });

  it("shows an empty state when nothing is booked today", async () => {
    renderFacility(owner);

    expect(await screen.findByText(/no appointments are booked for today/i)).toBeInTheDocument();
  });

  it("surfaces a load failure with a retry", async () => {
    fetchFacilityDashboardMock.mockRejectedValue(new Error("offline"));

    renderFacility(owner);

    expect(await screen.findByRole("alert")).toHaveTextContent("offline");
    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
  });
});
