import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AppointmentWire } from "../lib/appointmentApi";
import { fetchMyAppointments } from "../lib/appointmentApi";
import type { AuthUser } from "../lib/auth";
import { fetchHealthRecord } from "../lib/healthRecordApi";
import { Dashboard } from "./Dashboard";

vi.mock("../lib/appointmentApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/appointmentApi")>();
  return { ...actual, fetchMyAppointments: vi.fn() };
});

vi.mock("../lib/healthRecordApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/healthRecordApi")>();
  return { ...actual, fetchHealthRecord: vi.fn() };
});

const fetchMyAppointmentsMock = vi.mocked(fetchMyAppointments);
const fetchHealthRecordMock = vi.mocked(fetchHealthRecord);

const patient: AuthUser = {
  id: "user-1",
  email: "patient@example.com",
  full_name: "Amina Yusuf",
  role: "patient",
  is_staff: false,
  account_status: "active",
};

const facilityOwner: AuthUser = {
  id: "user-2",
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
    listing_name: "SmilePoint Dental",
    status: "PENDING",
    scheduled_at: "2030-01-01T09:30:00",
    note: null,
    country_code: "KE",
    created_at: "2029-12-01T10:00:00",
    ...overrides,
  };
}

function renderDashboard(user: AuthUser | null) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0, gcTime: 0 } },
  });

  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <Dashboard user={user} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("Dashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchMyAppointmentsMock.mockResolvedValue({ items: [], total: 0, limit: 20, offset: 0 });
    fetchHealthRecordMock.mockResolvedValue({
      id: "hr-1",
      patient_id: "user-1",
      maternal_status: "none",
      entries: [],
      created_at: "2026-01-01T08:00:00",
      updated_at: "2026-01-01T08:00:00",
    });
  });

  it("shows the signed-in user's identity", () => {
    renderDashboard(patient);

    expect(screen.getByRole("heading", { name: /your account/i })).toBeInTheDocument();
    expect(screen.getByText("Amina Yusuf")).toBeInTheDocument();
    expect(screen.getByText("patient@example.com")).toBeInTheDocument();
    expect(screen.getByText("Patient")).toBeInTheDocument();
  });

  it("renders nothing without a user", () => {
    const { container } = renderDashboard(null);

    expect(container).toBeEmptyDOMElement();
  });

  it("lists a patient's appointments with their slot and status", async () => {
    fetchMyAppointmentsMock.mockResolvedValue({
      items: [
        appointment(),
        appointment({
          id: "a-2",
          listing_type: "specialist",
          listing_id: "sp-1",
          listing_name: "Dr. Wanjiku Kamau",
          status: "CONFIRMED",
          scheduled_at: "2030-01-03T14:00:00",
          note: "Bring the referral letter",
        }),
      ],
      total: 2,
      limit: 20,
      offset: 0,
    });

    renderDashboard(patient);

    expect(await screen.findByText("SmilePoint Dental")).toBeInTheDocument();
    expect(screen.getByText("1 Jan 2030, 09:30")).toBeInTheDocument();
    expect(screen.getByText("Dr. Wanjiku Kamau")).toBeInTheDocument();
    expect(screen.getByText("3 Jan 2030, 14:00")).toBeInTheDocument();
    expect(screen.getByText("Bring the referral letter")).toBeInTheDocument();
    expect(screen.getByText("Pending confirmation")).toBeInTheDocument();
    expect(screen.getByText("Confirmed")).toBeInTheDocument();
  });

  it("shows an empty state when the patient has nothing booked", async () => {
    renderDashboard(patient);

    expect(await screen.findByText(/you have no appointments yet/i)).toBeInTheDocument();
    // The dashboard has no pager, so it asks for the API's largest page rather
    // than silently truncating a Patient's history at the default of 20.
    expect(fetchMyAppointmentsMock).toHaveBeenCalledWith({
      limit: 100,
      signal: expect.any(AbortSignal),
    });
    expect(fetchMyAppointmentsMock).toHaveBeenCalledTimes(1);
  });

  it("does not fetch patient data for a non-patient account", () => {
    renderDashboard(facilityOwner);

    expect(fetchMyAppointmentsMock).not.toHaveBeenCalled();
    expect(fetchHealthRecordMock).not.toHaveBeenCalled();
    expect(screen.queryByRole("heading", { name: /appointments/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /health record/i })).not.toBeInTheDocument();
  });

  it("surfaces an appointment load failure with a retry", async () => {
    fetchMyAppointmentsMock.mockRejectedValue(new Error("offline"));

    renderDashboard(patient);

    expect(await screen.findByRole("alert")).toHaveTextContent("offline");
    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
  });
});
