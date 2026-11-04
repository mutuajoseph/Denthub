/**
 * Contract types for the admin console (#82), mirroring the backend Pydantic
 * models in `backend/app/logic/v1/admin.py` and the routes in
 * `backend/app/routes/v1/admin.py`.
 *
 * Every call here needs a staff-surface token for an `admin` or `super_admin`
 * account; the console is not reachable with a public token, even when the
 * signed-in user's stored role is an admin. Reads are always the server's own
 * vocabulary — the feature keys, verification tiers and statuses come from the
 * response rather than a second list kept here.
 */

import { getJson, patchJson, postJson } from "./apiClient";

/** The graded value one Facility or Specialist profile is verified at. */
export type VerificationTier = "unverified" | "basic" | "verified" | "featured";

/** What moderation may set a Magazine Item or Job posting to. */
export type ModerationStatus = "published" | "hidden";

export interface AdminCountryFeatureWire {
  feature: string;
  is_enabled: boolean;
  primary_scheme: string | null;
}

export interface AdminCountryWire {
  code: string;
  name: string;
  currency: string;
  currency_symbol: string;
  is_active: boolean;
  features: AdminCountryFeatureWire[];
}

export interface AdminCountryListWire {
  items: AdminCountryWire[];
}

export interface VerificationItemWire {
  entity_type: "facility" | "specialist";
  id: string;
  name: string;
  country_code: string;
  verification_tier: VerificationTier;
}

export interface VerificationListWire {
  items: VerificationItemWire[];
  /** The grades in order, as the server enforces them. */
  tiers: string[];
}

export interface ModerationItemWire {
  entity_type: "magazine" | "job";
  id: string;
  title: string;
  status: string;
  country_code: string;
}

export interface ModerationListWire {
  items: ModerationItemWire[];
}

export interface AdminAuditEntryWire {
  id: number;
  actor_email: string;
  actor_role: string;
  action: string;
  entity_type: string;
  entity_id: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  created_at: string;
}

export interface AdminAuditListWire {
  items: AdminAuditEntryWire[];
}

/** A role a Super Admin may grant. `staff` is not part of the staff surface. */
export type PlatformStaffRole = "admin" | "super_admin" | "platform_operator";

/** The Division an Operator belongs to — exactly one. */
export type OperatorDivision =
  | "jobs"
  | "shop"
  | "training"
  | "dentist"
  | "international"
  | "suppliers";

/** An Operator's authority inside their Division. */
export type OperatorTier = "lead" | "assistant";

export interface PlatformStaffMemberWire {
  id: string;
  full_name: string;
  email: string;
  role: PlatformStaffRole;
  operator_division: OperatorDivision | null;
  operator_tier: OperatorTier | null;
  is_active: boolean;
}

export interface PlatformStaffListWire {
  items: PlatformStaffMemberWire[];
}

export interface CreatePlatformStaffRequest {
  full_name: string;
  email: string;
  password: string;
  role: PlatformStaffRole;
  operator_division?: OperatorDivision | null;
  operator_tier?: OperatorTier | null;
}

export interface UpdatePlatformStaffRequest {
  role?: PlatformStaffRole;
  operator_division?: OperatorDivision | null;
  operator_tier?: OperatorTier | null;
  is_active?: boolean;
}

export function fetchAdminCountries(options: { signal?: AbortSignal } = {}) {
  return getJson<AdminCountryListWire>("/admin/countries", {
    auth: true,
    signal: options.signal,
  });
}

export function updateCountry(code: string, isActive: boolean) {
  return patchJson<AdminCountryWire>(
    `/admin/countries/${encodeURIComponent(code)}`,
    {
      is_active: isActive,
    },
    { auth: true },
  );
}

export function updateCountryFeature(
  code: string,
  feature: string,
  request: { is_enabled: boolean; primary_scheme: string | null },
) {
  return patchJson<AdminCountryFeatureWire>(
    `/admin/countries/${encodeURIComponent(code)}/features/${encodeURIComponent(feature)}`,
    request,
    { auth: true },
  );
}

export function fetchAdminVerifications(options: { signal?: AbortSignal } = {}) {
  return getJson<VerificationListWire>("/admin/verifications", {
    auth: true,
    signal: options.signal,
  });
}

export function setFacilityVerificationTier(facilityId: string, tier: VerificationTier) {
  return patchJson<VerificationItemWire>(
    `/admin/facilities/${encodeURIComponent(facilityId)}/verification-tier`,
    { verification_tier: tier },
    { auth: true },
  );
}

export function setSpecialistVerificationTier(specialistId: string, tier: VerificationTier) {
  return patchJson<VerificationItemWire>(
    `/admin/specialists/${encodeURIComponent(specialistId)}/verification-tier`,
    { verification_tier: tier },
    { auth: true },
  );
}

export function fetchAdminModeration(options: { signal?: AbortSignal } = {}) {
  return getJson<ModerationListWire>("/admin/moderation", {
    auth: true,
    signal: options.signal,
  });
}

export function moderateMagazine(articleId: string, status: ModerationStatus) {
  return patchJson<ModerationItemWire>(
    `/admin/moderation/magazine/${encodeURIComponent(articleId)}`,
    { status },
    { auth: true },
  );
}

export function moderateJob(postingId: string, status: ModerationStatus) {
  return patchJson<ModerationItemWire>(
    `/admin/moderation/jobs/${encodeURIComponent(postingId)}`,
    { status },
    { auth: true },
  );
}

export function fetchAdminAudit(options: { signal?: AbortSignal } = {}) {
  return getJson<AdminAuditListWire>("/admin/audit", {
    auth: true,
    signal: options.signal,
  });
}

export function fetchAdminStaff(options: { signal?: AbortSignal } = {}) {
  return getJson<PlatformStaffListWire>("/admin/staff", {
    auth: true,
    signal: options.signal,
  });
}

export function createPlatformStaff(request: CreatePlatformStaffRequest) {
  return postJson<PlatformStaffMemberWire>("/admin/staff", request, { auth: true });
}

export function updatePlatformStaff(staffId: string, request: UpdatePlatformStaffRequest) {
  return patchJson<PlatformStaffMemberWire>(
    `/admin/staff/${encodeURIComponent(staffId)}`,
    request,
    { auth: true },
  );
}
