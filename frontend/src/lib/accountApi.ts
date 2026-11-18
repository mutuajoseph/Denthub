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
  sender_id: string;
  body: string;
  created_at: string;
}

export interface ExportedProductWire {
  id: string;
  name: string;
  brand: string | null;
  category: string;
  description: string | null;
  image_url: string | null;
  currency: string;
  retail_price: string;
  wholesale_price: string | null;
  wholesale_min_qty: number;
  in_stock: boolean;
  country_code: string;
  created_at: string;
}

export interface ExportedSupplierWire {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  country_code: string;
  scope: string;
  is_verified: boolean;
  created_at: string;
  products: ExportedProductWire[];
}

export interface ExportedTrainingCourseWire {
  id: string;
  title: string;
  description: string;
  country_code: string;
  subdivision_code: string;
  delivery_mode: string;
  price: string | null;
  currency: string | null;
  cpd_points: number;
  created_at: string;
  updated_at: string;
}

export interface ExportedTrainingWebinarWire {
  id: string;
  title: string;
  description: string;
  country_code: string;
  join_url: string;
  scheduled_start: string;
  cpd_points: number;
}

export interface ExportedTrainingProviderWire {
  id: string;
  name: string;
  country_code: string;
  is_verified: boolean;
  created_at: string;
  courses: ExportedTrainingCourseWire[];
  webinars: ExportedTrainingWebinarWire[];
}

export interface ExportedBranchWire {
  id: string;
  name: string | null;
  subdivision_code: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  open_now: boolean | null;
}

export interface ExportedSpecialistWire {
  id: string;
  name: string;
  slug: string;
  bio: string | null;
  avatar_key: string | null;
  country_code: string;
  subdivision_code: string;
  verification_tier: string;
  currency: string;
  list_price: string | null;
  rating: string | null;
  review_count: number;
  specialties: string[];
  branches: ExportedBranchWire[];
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
  /** Every Message in the caller's threads, both directions; `sender_id` says which. */
  messages: ExportedMessageWire[];
  /** The Supplier storefront the caller owns, if any. */
  supplier: ExportedSupplierWire | null;
  /** The Training Provider the caller owns, if any. */
  training_provider: ExportedTrainingProviderWire | null;
  /** The Specialist listing the caller runs, if any. */
  specialist: ExportedSpecialistWire | null;
}

/** Fetch the signed-in User's export; the caller comes from the bearer token. */
export function fetchAccountExport(options: { signal?: AbortSignal } = {}) {
  return getJson<AccountExportWire>("/me/export", { auth: true, signal: options.signal });
}

/** Erase the signed-in User's account now. The API answers `204 No Content`. */
export function deleteAccount() {
  return deleteJson<null>("/me", { auth: true });
}
