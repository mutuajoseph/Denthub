import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AppointmentWire } from "../lib/appointmentApi";
import { fetchSpecialistAppointments } from "../lib/appointmentApi";
import type { AuthUser } from "../lib/auth";
import { updateFacilityAppointment } from "../lib/facilityApi";
import { SpecialistDashboard } from "./SpecialistDashboard";

vi.mock("../lib/appointmentApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/appointmentApi")>();
  return { ...actual, fetchSpecialistAppointments: vi.fn() };
});

vi.mock("../lib/facilityApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/facilityApi")>();
  return { ...actual, updateFacilityAppointment: vi.fn() };
});

const fetchMock = vi.mocked(fetchSpecialistAppointments);
const updateMock = vi.mocked(updateFacilityAppointment);

const user: AuthUser = {
  id: "user-1",
  email: "specialist@example.com",
  full_name: "Sam Otieno",
  role: "specialist",
  is_staff: false,
  account_status: "active",
  email_verified: true,
  profiles: [],
  memberships: [],
};

function appointment(overrides: Partial<AppointmentWire> = {}): AppointmentWire {
  return {
    id: "a-1",
    listing_type: "specialist",
    listing_id: "s-1",
    listing_name: "Dr. Sam",
    status: "PENDING",
    scheduled_at: "2030-01-01T09:30:00",
    note: null,
    country_code: "KE",
    created_at: "2029-12-01T10:00:00",
    ...overrides,
  };
}

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0, gcTime: 0 } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <SpecialistDashboard user={user} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("SpecialistDashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchMock.mockResolvedValue([]);
    updateMock.mockResolvedValue(appointment({ status: "CONFIRMED" }));
  });

  it("shows the empty state when there are no appointments", async () => {
    renderPage();
    expect(await screen.findByText(/no appointments are booked/i)).toBeInTheDocument();
  });

  it("lists an appointment and advances it", async () => {
    fetchMock.mockResolvedValue([appointment()]);
    renderPage();
    expect(await screen.findByText(/pending confirmation/i)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /confirm/i }));

    expect(updateMock).toHaveBeenCalledWith("a-1", "CONFIRMED");
  });
});
