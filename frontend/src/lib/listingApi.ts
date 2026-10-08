/**
 * Contract types for the listing endpoints, mirroring the backend Pydantic
 * models in `backend/app/logic/v1/listing.py` — `GET /facilities`,
 * `GET /facilities/{id}`, `GET /dentists`, `GET /dentists/{id}`.
 *
 * The **wire** shape is snake_case exactly as the API answers, with money as a
 * JSON string (`rating`, `list_price`) because Pydantic serialises `Decimal`
 * that way — so amounts stay exact and are parsed once, in the mapper, never in
 * a component. `open_now` is computed server-side in the Branch's Country; the
 * client never re-implements it.
 *
 * The **UI** shapes (`ListingView`, `ListingProfileView`, `BranchView`) are
 * camelCase, specialty codes resolved to display names, and money still an
 * exact string (`amount`). Pages and components only ever read these.
 */

import { getJson } from "./apiClient";

/** How far a profile has been checked by DentHub (`CONTEXT.md`, Verification tier). */
export type VerificationTier = "unverified" | "basic" | "verified" | "featured";

/** A clinic and a dentist are one card; this tells them apart for rendering. */
export type ListingType = "facility" | "specialist";

/** One weekday's hours, wall-clock `HH:MM` in the Branch's Country. */
export interface OpeningHour {
  /** `datetime.weekday()` numbering, Monday = 0. */
  weekday: number;
  opens: string | null;
  closes: string | null;
  is_closed: boolean;
}

/** One location of a Facility, with its hours already resolved. */
export interface Branch {
  id: string;
  facility_id: string;
  facility_name: string;
  name: string | null;
  subdivision_code: string;
  address: string;
  phone: string | null;
  email: string | null;
  hours: OpeningHour[];
  open_now: boolean;
}

/** One search result: a clinic and a dentist share this exact shape. */
export interface DentistListing {
  id: string;
  listing_type: ListingType;
  name: string;
  country_code: string;
  subdivision_code: string;
  specialty_codes: string[];
  /** Decimal as a JSON string; `null` when the listing has no rating. */
  rating: string | null;
  review_count: number;
  /** The "from" price, decimal string; never computed client-side. */
  list_price: string | null;
  /** One currency for the whole page; a listing's own currency is this value. */
  currency: string;
  open_now: boolean;
  /** A number a patient can dial: a Facility's phone or a Specialist's Branch phone. */
  phone: string | null;
  /** The tier a Facility is verified at; always `null` for a Specialist. */
  verification_tier: VerificationTier | null;
  /** For a Specialist, the Facility they work at as a card shows it. */
  clinic_name: string | null;
}

/** One page of listings plus the market it belongs to. */
export interface ListingPage {
  items: DentistListing[];
  total: number;
  limit: number;
  offset: number;
  country_code: string;
  currency: string;
}

/** A clinic profile: its card, its contact, and every Branch. */
export interface FacilityDetail {
  listing: DentistListing;
  address: string;
  phone: string | null;
  email: string | null;
  verification_tier: VerificationTier;
  branches: Branch[];
}

/** A dental specialism, as listed by `GET /config/specialties`. */
export interface Specialty {
  id: string;
  code: string;
  name: string;
  description: string | null;
  display_order: number;
}

/** A professional profile: its card, specialisms, and where they work. */
export interface SpecialistDetail {
  listing: DentistListing;
  slug: string;
  specialties: Specialty[];
  branches: Branch[];
}

/* ------------------------------------------------------------------ *
 * UI model
 * ------------------------------------------------------------------ */

/** Resolves a specialty code to its display name; falls back to a prettified code. */
export type SpecialtyName = (code: string) => string;

/** One search result as the UI reads it: names resolved, money still exact. */
export interface ListingView {
  id: string;
  listingType: ListingType;
  name: string;
  /** The Workplace a Specialist shows; `null` for a Facility (its name is its own). */
  clinic: string | null;
  specialtyCodes: string[];
  /** Display names for `specialtyCodes`, in the market's specialty order. */
  specialties: string[];
  countryCode: string;
  subdivisionCode: string;
  /** Numeric rating, `null` when the listing has none. */
  rating: number | null;
  reviewCount: number;
  /** Exact decimal string; `null` when unpriced. Never parseFloat'd. */
  amount: string | null;
  currency: string;
  openNow: boolean;
  phone: string | null;
  verificationTier: VerificationTier | null;
}

/** One weekday's hours as the UI reads it. */
export interface OpeningHourView {
  /** `datetime.weekday()` numbering, Monday = 0. */
  weekday: number;
  opens: string | null;
  closes: string | null;
  isClosed: boolean;
}

/** One Branch as the UI reads it. */
export interface BranchView {
  id: string;
  facilityId: string;
  facilityName: string;
  name: string | null;
  subdivisionCode: string;
  address: string;
  phone: string | null;
  email: string | null;
  hours: OpeningHourView[];
  openNow: boolean;
}

/** A profile page as the UI reads it: card, contact, and every Branch. */
export interface ListingProfileView {
  listing: ListingView;
  /** The Facility's address; `null` for a Specialist, whose Branches carry theirs. */
  address: string | null;
  email: string | null;
  branches: BranchView[];
}

/* ------------------------------------------------------------------ *
 * Mappers
 * ------------------------------------------------------------------ */

export function mapOpeningHour(wire: OpeningHour): OpeningHourView {
  return {
    weekday: wire.weekday,
    opens: wire.opens,
    closes: wire.closes,
    isClosed: wire.is_closed,
  };
}

export function mapBranch(wire: Branch): BranchView {
  return {
    id: wire.id,
    facilityId: wire.facility_id,
    facilityName: wire.facility_name,
    name: wire.name,
    subdivisionCode: wire.subdivision_code,
    address: wire.address,
    phone: wire.phone,
    email: wire.email,
    hours: wire.hours.map(mapOpeningHour),
    openNow: wire.open_now,
  };
}

export function mapListing(wire: DentistListing, specialtyName: SpecialtyName): ListingView {
  return {
    id: wire.id,
    listingType: wire.listing_type,
    name: wire.name,
    clinic: wire.clinic_name,
    specialtyCodes: [...wire.specialty_codes],
    specialties: wire.specialty_codes.map(specialtyName),
    countryCode: wire.country_code,
    subdivisionCode: wire.subdivision_code,
    rating: wire.rating === null ? null : Number(wire.rating),
    reviewCount: wire.review_count,
    amount: wire.list_price,
    currency: wire.currency,
    openNow: wire.open_now,
    phone: wire.phone,
    verificationTier: wire.verification_tier,
  };
}

export function mapProfile(
  detail: FacilityDetail | SpecialistDetail,
  specialtyName: SpecialtyName,
): ListingProfileView {
  // A Specialist's detail carries its own ordered Specialties, which beats
  // looking every code up; a Facility only has codes on the card.
  const names =
    "specialties" in detail
      ? detail.specialties.map((row) => row.name)
      : detail.listing.specialty_codes.map(specialtyName);

  const listing = mapListing(detail.listing, specialtyName);
  const isFacility = "address" in detail;

  return {
    listing: { ...listing, specialties: names },
    address: isFacility ? detail.address : null,
    email: isFacility ? detail.email : null,
    branches: detail.branches.map(mapBranch),
  };
}

/* ------------------------------------------------------------------ *
 * Fetchers
 * ------------------------------------------------------------------ */

/** Every input `fetchListingSearch` reads; also the query key's inputs. */
export interface ListingSearchParams {
  /** The market being asked about (`apiCountry`, never `GLOBAL`). */
  country: string;
  subdivisionCode?: string;
  /** Which endpoints to hit; `all` merges both into one card list. */
  listingType?: ListingType | "all";
  /** Page size per endpoint. The backend caps `limit` at 100. */
  limit?: number;
}

/**
 * The market's listings, from `/facilities`, `/dentists`, or both in parallel.
 *
 * The page fetches the market once and filters/sorts in memory (#18's grill
 * decision); the server-side search past 100 rows is a follow-up issue.
 */
export async function fetchListingSearch(
  params: ListingSearchParams,
  signal?: AbortSignal,
): Promise<DentistListing[]> {
  const { country, subdivisionCode, listingType = "all", limit = 100 } = params;
  const query = { country, subdivision_code: subdivisionCode, limit };

  const wantFacilities = listingType === "all" || listingType === "facility";
  const wantSpecialists = listingType === "all" || listingType === "specialist";

  const [facilities, specialists] = await Promise.all([
    wantFacilities ? getJson<ListingPage>("/facilities", { query, signal }) : null,
    wantSpecialists ? getJson<ListingPage>("/dentists", { query, signal }) : null,
  ]);

  return [...(facilities?.items ?? []), ...(specialists?.items ?? [])];
}

export function fetchFacilityDetail(id: string, signal?: AbortSignal): Promise<FacilityDetail> {
  return getJson<FacilityDetail>(`/facilities/${encodeURIComponent(id)}`, { signal });
}

export function fetchSpecialistDetail(id: string, signal?: AbortSignal): Promise<SpecialistDetail> {
  return getJson<SpecialistDetail>(`/dentists/${encodeURIComponent(id)}`, { signal });
}
