import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../../lib/apiClient";
import * as appointmentsApi from "../../lib/appointmentApi";
import type { AuthUser } from "../../lib/auth";
import { BookAppointmentInline } from "./BookAppointmentInline";

const bookAppointmentMock = vi.spyOn(appointmentsApi, "bookAppointment");

const patient: AuthUser = {
  id: "p1",
  email: "amina@example.com",
  full_name: "Amina Otieno",
  role: "patient",
  is_staff: false,
  account_status: "active",
};

const facilityOwner: AuthUser = {
  id: "f1",
  email: "owner@example.com",
  full_name: "Facility Owner",
  role: "facility_owner",
  is_staff: false,
  account_status: "active",
};

describe("BookAppointmentInline", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    bookAppointmentMock.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
    queryClient.clear();
  });

  function renderForUser(user: AuthUser | null) {
    return render(
      <QueryClientProvider client={queryClient}>
        <BookAppointmentInline
          listingType="facility"
          listingId="f-1"
          listingName="Parkside Dental"
          user={user}
        />
      </QueryClientProvider>,
    );
  }

  it("renders nothing when nobody is signed in", () => {
    const { container } = renderForUser(null);

    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing for a non-patient account", () => {
    const { container } = renderForUser(facilityOwner);

    expect(container).toBeEmptyDOMElement();
  });

  it("opens the form, books an appointment, and shows the confirmation", async () => {
    bookAppointmentMock.mockResolvedValue({
      id: "a1",
      listing_type: "facility",
      listing_id: "f-1",
      listing_name: "Parkside Dental",
      status: "PENDING",
      scheduled_at: "2030-01-02T09:00:00",
      note: null,
      country_code: "KE",
      created_at: "2030-01-01T10:00:00",
    });

    renderForUser(patient);

    fireEvent.click(screen.getByRole("button", { name: /book now/i }));
    fireEvent.change(screen.getByLabelText(/preferred slot/i), {
      target: { value: "2030-01-02T09:00" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^book appointment$/i }));

    await waitFor(() => {
      expect(bookAppointmentMock).toHaveBeenCalledWith({
        listing_type: "facility",
        listing_id: "f-1",
        scheduled_at: "2030-01-02T09:00",
        note: undefined,
      });
      expect(screen.getByRole("heading", { name: /appointment requested/i })).toBeInTheDocument();
    });
  });

  it("sends an optional note when one is written", async () => {
    bookAppointmentMock.mockResolvedValue({
      id: "a2",
      listing_type: "specialist",
      listing_id: "sp-1",
      listing_name: "Dr Amina",
      status: "PENDING",
      scheduled_at: "2030-01-02T09:00:00",
      note: "Mornings work best",
      country_code: "KE",
      created_at: "2030-01-01T10:00:00",
    });

    renderForUser(patient);

    fireEvent.click(screen.getByRole("button", { name: /book now/i }));
    fireEvent.change(screen.getByLabelText(/preferred slot/i), {
      target: { value: "2030-01-02T09:00" },
    });
    fireEvent.change(screen.getByLabelText(/note/i), {
      target: { value: "Mornings work best" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^book appointment$/i }));

    await waitFor(() => {
      expect(bookAppointmentMock).toHaveBeenCalledWith(
        expect.objectContaining({ note: "Mornings work best" }),
      );
    });
  });

  it("shows the backend message when the booking is rejected", async () => {
    bookAppointmentMock.mockRejectedValue(
      new ApiError("That slot is already taken.", { status: 409, code: "conflict" }),
    );

    renderForUser(patient);

    fireEvent.click(screen.getByRole("button", { name: /book now/i }));
    fireEvent.change(screen.getByLabelText(/preferred slot/i), {
      target: { value: "2030-01-02T09:00" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^book appointment$/i }));

    await waitFor(() => {
      expect(screen.getByText("That slot is already taken.")).toBeInTheDocument();
    });
  });

  it("does not submit until a slot is chosen", () => {
    renderForUser(patient);

    fireEvent.click(screen.getByRole("button", { name: /book now/i }));

    expect(screen.getByRole("button", { name: /book appointment/i })).toBeDisabled();
    expect(bookAppointmentMock).not.toHaveBeenCalled();
  });
});
