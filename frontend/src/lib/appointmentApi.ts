/**
 * Contract types for the appointment endpoints, mirroring the backend Pydantic
 * models in `backend/app/logic/v1/appointments.py` — `POST /appointments`,
 * `GET /appointments`, and `PATCH /appointments/{id}`.
 *
 * The **wire** shape is snake_case exactly as the API answers. `scheduled_at` is
 * a wall-clock time at the Listing's Country with no offset (the backend stores
 * it unchanged — see the module docstring on the backend repository), so the
 * client never converts it and never invents a timezone.
 *
 * The **UI** shape (`AppointmentView`) is camelCase; both timestamps stay exact
 * strings and are formatted for display only.
 */

import { getJson, patchJson, postJson } from "./apiClient";
import type { ListingType } from "./listingApi";

/**
 * The documented lifecycle of an Appointment. `CANCELLED` is terminal and is
 * reachable from `PENDING`/`CONFIRMED` only — a Patient action, never one the
 * clinic's lifecycle reaches on its own.
 */
export type AppointmentStatus = "PENDING" | "CONFIRMED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";

/** One Appointment as the API answers it. */
export interface AppointmentWire {
  id: string;
  listing_type: ListingType;
  listing_id: string;
  /** The Facility or Specialist name; `null` when the Listing no longer exists. */
  listing_name: string | null;
  status: AppointmentStatus;
  /** Wall-clock time at the Listing's Country, no offset. */
  scheduled_at: string;
  note: string | null;
  country_code: string;
  created_at: string;
}

/** One page of a Patient's Appointments. */
export interface AppointmentPageWire {
  items: AppointmentWire[];
  total: number;
  limit: number;
  offset: number;
}

/** The body `POST /appointments` accepts; the Patient comes from the token. */
export interface BookAppointmentRequest {
  listing_type: ListingType;
  listing_id: string;
  /** Wall-clock time in the Listing's Country, as an HTML `datetime-local` value. */
  scheduled_at: string;
  note?: string | null;
}

/**
 * What the patient dashboard asks for. It is the API's own page cap: a Patient
 * will not have this many Appointments early on, and the dashboard has no pager
 * to link to, so it takes the largest honest page and shows all of it.
 */
export const DASHBOARD_APPOINTMENT_LIMIT = 100;

/** One Appointment as the UI reads it. */
export interface AppointmentView {
  id: string;
  listingType: ListingType;
  listingId: string;
  listingName: string | null;
  status: AppointmentStatus;
  /** Exact wall-clock string; formatted for display, never parsed for logic. */
  scheduledAt: string;
  note: string | null;
}

/** Human labels for the lifecycle states. */
export const APPOINTMENT_STATUS_LABELS: Record<AppointmentStatus, string> = {
  PENDING: "Pending confirmation",
  CONFIRMED: "Confirmed",
  IN_PROGRESS: "In progress",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

/** The states a Patient may still cancel or reschedule (#88). */
export const PATIENT_ACTIONABLE_STATUSES: readonly AppointmentStatus[] = [
  "PENDING",
  "CONFIRMED",
] as const;

export function isActionable(status: AppointmentStatus): boolean {
  return PATIENT_ACTIONABLE_STATUSES.includes(status);
}

export function mapAppointment(wire: AppointmentWire): AppointmentView {
  return {
    id: wire.id,
    listingType: wire.listing_type,
    listingId: wire.listing_id,
    listingName: wire.listing_name,
    status: wire.status,
    scheduledAt: wire.scheduled_at,
    note: wire.note,
  };
}

/** Book a Listing for the signed-in Patient. */
export function bookAppointment(request: BookAppointmentRequest): Promise<AppointmentWire> {
  return postJson<AppointmentWire>("/appointments", request, { auth: true });
}

/** The signed-in Patient's Appointments, soonest slot first. */
export function fetchMyAppointments(
  options: {
    limit?: number;
    signal?: AbortSignal;
  } = {},
): Promise<AppointmentPageWire> {
  const { limit, signal } = options;

  return getJson<AppointmentPageWire>("/appointments", { auth: true, signal, query: { limit } });
}

/** Withdraw a booking. The backend allows this only from PENDING/CONFIRMED. */
export interface CancelAppointmentRequest {
  action: "cancel";
}

/**
 * Move a booking to a new wall-clock slot, keeping the same Listing. Omitting
 * `note` keeps the existing one; sending `null` clears it (PATCH semantics).
 */
export interface RescheduleAppointmentRequest {
  action: "reschedule";
  /** Wall-clock time in the Listing's Country, as an HTML `datetime-local` value. */
  scheduled_at: string;
  note?: string | null;
}

/** The body `PATCH /appointments/{id}` accepts. */
export type UpdateAppointmentRequest = CancelAppointmentRequest | RescheduleAppointmentRequest;

/** Cancel or reschedule one of the signed-in Patient's own Appointments. */
export function updateAppointment(
  appointmentId: string,
  request: UpdateAppointmentRequest,
): Promise<AppointmentWire> {
  return patchJson<AppointmentWire>(`/appointments/${appointmentId}`, request, { auth: true });
}
