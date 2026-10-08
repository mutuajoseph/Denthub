/**
 * Contract types for the jobs board endpoints, mirroring the backend Pydantic
 * models in `backend/app/logic/v1/jobs.py` — `GET /jobs`,
 * `GET /jobs/{posting_id}`.
 *
 * The **wire** shape is snake_case exactly as the API answers, with money as a
 * JSON string (`min_amount`, `max_amount`) because Pydantic serialises `Decimal`
 * that way — so amounts stay exact and are parsed once, in the mapper, never in
 * a component. The board is public and read-only (PRD §2), and a posting's own
 * Country governs how its salary renders; the market currency on `JobPage` is
 * what the board is being viewed in.
 *
 * The **UI** shape (`JobView`) is camelCase, specialty codes resolved to
 * display names, and money still an exact string (`minAmount`). Pages and
 * components only ever read these.
 */

import { getJson } from "./apiClient";
import type { QueryPrimitive } from "./apiClient";
import type { SpecialtyName } from "./listingApi";

/** Employment terms; the backend stores these exact display strings. */
export type EmploymentType = "Full Time" | "Part Time" | "Contract" | "Internship";

/** Experience band for one posting, as the backend stores it. */
export type Seniority = "Entry Level" | "Mid Level" | "Senior" | "Lead";

/** One salary band; `currency` is always present, so it can differ from the market's. */
export interface JobSalaryRangeWire {
  min_amount: string | null;
  max_amount: string | null;
  currency: string;
}

/** The Branch a posting belongs to, flattened for a card. */
export interface JobWorkplaceWire {
  facility_name: string;
  branch_name: string | null;
  subdivision_code: string;
  address: string | null;
  phone: string | null;
}

/** One published posting as the API serves it. */
export interface JobPostingWire {
  id: string;
  title: string;
  description: string;
  requirements: string | null;
  employment_type: EmploymentType;
  seniority: Seniority;
  /** ISO-8601 timestamp of when the posting went public. */
  posted_at: string;
  specialty_codes: string[];
  workplace: JobWorkplaceWire;
  salary_range: JobSalaryRangeWire | null;
}

/** One page of postings plus the market it belongs to. */
export interface JobPageWire {
  items: JobPostingWire[];
  total: number;
  limit: number;
  offset: number;
  country_code: string;
  currency: string;
}

/** Every input `fetchJobs` reads; also the query key's inputs. */
export interface JobSearchParams {
  /** The market being asked about (`apiCountry`, never `GLOBAL`). */
  country: string;
  /** Filter to one subdivision code, e.g. `NAIROBI`. */
  subdivisionCode?: string;
  /** Filter to one specialism code, e.g. `orthodontics`. */
  specialtyCode?: string;
  /** Page size. The backend caps `limit` at 100. */
  limit?: number;
  offset?: number;
}

export async function fetchJobs(
  params: JobSearchParams,
  signal?: AbortSignal,
): Promise<JobPageWire> {
  const { country, subdivisionCode, specialtyCode, limit, offset } = params;

  const query: Record<string, QueryPrimitive | undefined> = {
    country,
    subdivision_code: subdivisionCode,
    specialty_code: specialtyCode,
    limit,
    offset,
  };

  return getJson<JobPageWire>("/jobs", { query, signal });
}

export function fetchJob(id: string, signal?: AbortSignal): Promise<JobPostingWire> {
  return getJson<JobPostingWire>(`/jobs/${encodeURIComponent(id)}`, { signal });
}

/* ------------------------------------------------------------------ *
 * UI model
 * ------------------------------------------------------------------ */

/** One salary band as the UI reads it; amounts still exact strings. */
export interface JobSalaryView {
  minAmount: string | null;
  maxAmount: string | null;
  currency: string;
}

/** One posting's Workplace as the UI reads it. */
export interface JobWorkplaceView {
  /** The clinic a candidate applies to. */
  facilityName: string;
  /** Distinguishes multi-site clinics ("Westlands", "24-Hour Emergency"). */
  branchName: string | null;
  subdivisionCode: string;
  address: string | null;
  phone: string | null;
}

/** One posting as the UI reads it: names resolved, money still exact. */
export interface JobView {
  id: string;
  title: string;
  description: string;
  requirements: string | null;
  employmentType: EmploymentType;
  seniority: Seniority;
  postedAt: string;
  specialtyCodes: readonly string[];
  /** Display names for `specialtyCodes`, in the market's specialty order. */
  specialties: readonly string[];
  workplace: JobWorkplaceView;
  salary: JobSalaryView | null;
}

/* ------------------------------------------------------------------ *
 * Mappers
 * ------------------------------------------------------------------ */

export function mapJob(wire: JobPostingWire, specialtyName: SpecialtyName): JobView {
  return {
    id: wire.id,
    title: wire.title,
    description: wire.description,
    requirements: wire.requirements,
    employmentType: wire.employment_type,
    seniority: wire.seniority,
    postedAt: wire.posted_at,
    specialtyCodes: [...wire.specialty_codes],
    specialties: wire.specialty_codes.map(specialtyName),
    workplace: {
      facilityName: wire.workplace.facility_name,
      branchName: wire.workplace.branch_name,
      subdivisionCode: wire.workplace.subdivision_code,
      address: wire.workplace.address,
      phone: wire.workplace.phone,
    },
    salary: wire.salary_range
      ? {
          minAmount: wire.salary_range.min_amount,
          maxAmount: wire.salary_range.max_amount,
          currency: wire.salary_range.currency,
        }
      : null,
  };
}

/* ------------------------------------------------------------------ *
 * Display helpers
 * ------------------------------------------------------------------ */

const DAY_MS = 86_400_000;

/** "Posted 2 days ago" from the API's `posted_at`; a fresh posting says "today". */
export function postedLabel(postedAt: string, now: number = Date.now()): string {
  const elapsed = Math.max(0, now - Date.parse(postedAt));
  const days = Math.floor(elapsed / DAY_MS);
  const when = days <= 0 ? "today" : `${days} day${days === 1 ? "" : "s"} ago`;
  return `Posted ${when}`;
}
