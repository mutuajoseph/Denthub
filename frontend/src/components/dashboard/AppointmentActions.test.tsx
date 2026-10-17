import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "../../lib/apiClient";
import * as appointmentsApi from "../../lib/appointmentApi";
import type { AppointmentWire } from "../../lib/appointmentApi";
import { AppointmentActions } from "./AppointmentActions";

const updateAppointmentMock = vi.spyOn(appointmentsApi, "updateAppointment");

function view(overrides: Partial<AppointmentWire> = {}): AppointmentWire {
  return {
    id: "a-1",
    listing_type: "facility",
    listing_id: "f-1",
    listing_name: "SmilePoint Dental",
    status: "PENDING",
    scheduled_at: "2030-01-01T09:30:00",
    note: "Morning slot please",
    country_code: "KE",
    created_at: "2029-12-01T10:00:00",
    ...overrides,
  };
}

function wire(overrides: Partial<AppointmentWire> = {}): AppointmentWire {
  return {
    id: "a-1",
    listing_type: "facility",
    listing_id: "f-1",
    listing_name: "SmilePoint Dental",
    status: "CANCELLED",
    scheduled_at: "2030-01-01T09:30:00",
    note: null,
    country_code: "KE",
    created_at: "2029-12-01T10:00:00",
    ...overrides,
  };
}

describe("AppointmentActions", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    updateAppointmentMock.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
    queryClient.clear();
  });

  function renderActions(appointment: AppointmentWire) {
    return render(
      <QueryClientProvider client={queryClient}>
        <AppointmentActions appointment={appointment} />
      </QueryClientProvider>,
    );
  }

  it("offers reschedule and cancel for a pending appointment", () => {
    renderActions(view());

    expect(screen.getByRole("button", { name: /reschedule/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /cancel appointment/i })).toBeInTheDocument();
  });

  it("offers the actions for a confirmed appointment", () => {
    renderActions(view({ status: "CONFIRMED" }));

    expect(screen.getByRole("button", { name: /reschedule/i })).toBeInTheDocument();
  });

  it.each(["IN_PROGRESS", "COMPLETED", "CANCELLED"] as const)(
    "renders nothing for a %s appointment",
    (status) => {
      const { container } = renderActions(view({ status }));

      expect(container).toBeEmptyDOMElement();
    },
  );

  it("cancels only after an inline confirmation", async () => {
    updateAppointmentMock.mockResolvedValue(wire());
    renderActions(view());

    fireEvent.click(screen.getByRole("button", { name: /cancel appointment/i }));

    // The destructive call is not made until the confirmation is accepted.
    expect(updateAppointmentMock).not.toHaveBeenCalled();
    expect(screen.getByText(/cannot be undone/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /yes, cancel it/i }));

    await waitFor(() => {
      expect(updateAppointmentMock).toHaveBeenCalledWith("a-1", { action: "cancel" });
    });
  });

  it("backs out of a cancellation without calling the API", () => {
    renderActions(view());

    fireEvent.click(screen.getByRole("button", { name: /cancel appointment/i }));
    fireEvent.click(screen.getByRole("button", { name: /keep appointment/i }));

    expect(updateAppointmentMock).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /cancel appointment/i })).toBeInTheDocument();
  });

  it("reschedules to a new slot, prefilled from the current one", async () => {
    updateAppointmentMock.mockResolvedValue(
      wire({ status: "PENDING", scheduled_at: "2030-02-01T14:00:00" }),
    );
    renderActions(view());

    fireEvent.click(screen.getByRole("button", { name: /reschedule/i }));

    const slot = screen.getByLabelText(/new slot/i) as HTMLInputElement;
    // The API's `2030-01-01T09:30:00` is trimmed to the `datetime-local` shape.
    expect(slot.value).toBe("2030-01-01T09:30");

    fireEvent.change(slot, { target: { value: "2030-02-01T14:00" } });
    fireEvent.click(screen.getByRole("button", { name: /save new slot/i }));

    await waitFor(() => {
      expect(updateAppointmentMock).toHaveBeenCalledWith("a-1", {
        action: "reschedule",
        scheduled_at: "2030-02-01T14:00",
        note: "Morning slot please",
      });
    });
  });

  it("sends a cleared note as null", async () => {
    updateAppointmentMock.mockResolvedValue(wire({ status: "PENDING" }));
    renderActions(view({ note: "Old note" }));

    fireEvent.click(screen.getByRole("button", { name: /reschedule/i }));
    fireEvent.change(screen.getByLabelText(/note/i), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: /save new slot/i }));

    await waitFor(() => {
      expect(updateAppointmentMock).toHaveBeenCalledWith(
        "a-1",
        expect.objectContaining({ note: null }),
      );
    });
  });

  it("shows the backend message when the update is rejected", async () => {
    updateAppointmentMock.mockRejectedValue(
      new ApiError("That slot is already booked.", { status: 409, code: "conflict" }),
    );
    renderActions(view());

    fireEvent.click(screen.getByRole("button", { name: /reschedule/i }));
    fireEvent.click(screen.getByRole("button", { name: /save new slot/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent("That slot is already booked.");
  });
});
