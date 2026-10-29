/**
 * Contract types for the caller's own account endpoints, mirroring the backend
 * Pydantic models in `backend/app/logic/v1/me.py` — `GET /me/export` and
 * `DELETE /me` (#128).
 *
 * The **wire** shape is snake_case exactly as the API answers. The export is a
 * file the User keeps, so the client downloads the wire document unchanged
 * rather than inventing a second shape for it.
 */

import { deleteJson, getJson } from "./apiClient";
import type { AppointmentStatus } from "./appointmentApi";
import type { AccountStatus, MembershipSummary, ProfileSummary } from "./auth";
import type {
  HealthRecordAuthorKind,
  HealthRecordEntryCategory,
  MaternalStatus,
} from "./healthRecordApi";
import type { ListingType } from "./listingApi";

export interface ExportedUserWire {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  role: string;
  is_staff: boolean;
  account_status: AccountStatus;
  facility_id: string | null;
  created_at: string;
}

export interface ExportedHealthEntryWire {
  id: string;
  category: HealthRecordEntryCategory;
  body: string;
  author_id: string;
  author_kind: HealthRecordAuthorKind;
  author_name: string | null;
  created_at: string;
}

export interface ExportedHealthRecordWire {
  id: string;
  patient_id: string;
  maternal_status: MaternalStatus;
  entries: ExportedHealthEntryWire[];
  created_at: string;
  updated_at: string;
}

export interface ExportedAppointmentWire {
  id: string;
  listing_type: ListingType;
  listing_id: string;
  listing_name: string | null;
  country_code: string;
  scheduled_at: string;
  note: string | null;
  status: AppointmentStatus;
  created_at: string;
}

export interface ExportedMessageWire {
  id: string;
  conversation_id: string;
  body: string;
  created_at: string;
}

/** A complete copy of the caller's own account data. */
export interface AccountExportWire {
  exported_at: string;
  user: ExportedUserWire;
  profiles: ProfileSummary[];
  memberships: MembershipSummary[];
  /** `null` when the caller has no Health Record. */
  health_record: ExportedHealthRecordWire | null;
  appointments: ExportedAppointmentWire[];
  /** Only the Messages the caller sent; the other participant's are not theirs. */
  messages: ExportedMessageWire[];
}

/** Fetch the signed-in User's export; the caller comes from the bearer token. */
export function fetchAccountExport(options: { signal?: AbortSignal } = {}) {
  return getJson<AccountExportWire>("/me/export", { auth: true, signal: options.signal });
}

/** Erase the signed-in User's account now. The API answers `204 No Content`. */
export function deleteAccount() {
  return deleteJson<null>("/me", { auth: true });
}
