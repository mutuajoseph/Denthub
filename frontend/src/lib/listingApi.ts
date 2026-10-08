/**
 * Contract types for the listing endpoints, mirroring the backend Pydantic
 * models in `backend/app/logic/v1/listing.py` — `GET /facilities`,
 * `GET /facilities/{id}`, `GET /dentists`, `GET /dentists/{id}`.
 *
 * The shape is the **wire** shape: snake_case fields exactly as the API
 * answers, and money as a JSON string (`rating`, `list_price`) because
 * Pydantic serialises `Decimal` that way — so amounts stay exact and are
 * parsed once, in the mapper, never in a component. `open_now` is computed
 * server-side in the Branch's Country; the client never re-implements it.
 *
 * Fetchers, the wire-to-UI mapper, and the query hooks land with the page
 * rewiring in #18, which is the first consumer of these types.
 */

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

/** A dental specialism, as listed by `GET /specialties`. */
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
