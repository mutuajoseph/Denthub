/**
 * Contract types for the facility dashboard endpoints, mirroring the backend
 * Pydantic models in `backend/app/logic/v1/facility.py` — `GET /facility/dashboard`
 * and `PATCH /facility/appointments/{id}`.
 *
 * The dashboard is scoped **on the server** to the Facility the signed-in account
 * is linked to (`users.facility_id`), so the client never names a facility and a
 * clinic can only ever see its own bookings and staff. Today's Appointments carry
 * the same wall-clock `scheduled_at` as the patient side (no offset; see
 * `appointmentApi.ts`), so they are formatted for display only, never converted.
 */

import { getJson, patchJson } from "./apiClient";
import type { AppointmentStatus, AppointmentWire } from "./appointmentApi";

/** One member of the clinic's staff, as the API answers it. */
export interface FacilityStaffWire {
  id: string;
  full_name: string;
  role: string;
}

/** One clinic's day: today's bookings, the pending queue, and its staff. */
export interface FacilityDashboardWire {
  facility_id: string;
  facility_name: string | null;
  country_code: string;
  /** The clinic's own today (its Country's clock), soonest slot first. */
  today: AppointmentWire[];
  /** The clinic's whole pending backlog — not limited to today. */
  pending_count: number;
  staff: FacilityStaffWire[];
}

/** The forward steps a facility account may drive along the workflow. */
export type FacilityAppointmentStatus = "CONFIRMED" | "IN_PROGRESS" | "COMPLETED";

/** The body `PATCH /facility/appointments/{id}` accepts. */
export interface UpdateFacilityAppointmentRequest {
  status: FacilityAppointmentStatus;
}

/** What each forward step is called on the button that drives it. */
export const FACILITY_ACTION_LABELS: Record<FacilityAppointmentStatus, string> = {
  CONFIRMED: "Confirm",
  IN_PROGRESS: "Check in",
  COMPLETED: "Complete",
};

/**
 * The step each current status moves to next. A terminal status (`COMPLETED`)
 * has no entry, so the appointment shows no action — the same forward-only rule
 * the backend enforces.
 */
export const NEXT_FACILITY_STEP: Partial<Record<AppointmentStatus, FacilityAppointmentStatus>> = {
  PENDING: "CONFIRMED",
  CONFIRMED: "IN_PROGRESS",
  IN_PROGRESS: "COMPLETED",
};

/** The signed-in clinic's dashboard: today's Appointments, pending count, staff. */
export function fetchFacilityDashboard(
  options: { signal?: AbortSignal } = {},
): Promise<FacilityDashboardWire> {
  return getJson<FacilityDashboardWire>("/facility/dashboard", {
    auth: true,
    signal: options.signal,
  });
}

/** Move one of the clinic's Appointments one step forward along the workflow. */
export function updateFacilityAppointment(
  appointmentId: string,
  status: FacilityAppointmentStatus,
): Promise<AppointmentWire> {
  return patchJson<AppointmentWire>(
    `/facility/appointments/${appointmentId}`,
    { status },
    { auth: true },
  );
}
