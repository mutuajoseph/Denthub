/**
 * Contract types for the Home endpoints — `GET /home/featured` and
 * `GET /home/stats`, mirroring `backend/app/logic/v1/home.py`.
 *
 * A Home card is the same `DentistListing` the search pages return, so a deep
 * link lands on the profile the card speaks about, and every figure is a plain
 * integer the server counted for the active market — the wire never carries a
 * marketing "2,400+".
 */

import { getJson } from "./apiClient";
import type { DentistListing } from "./listingApi";

/** A short, ranked set of `DentistListing` cards for the market. */
export interface HomeFeatured {
  items: DentistListing[];
  country_code: string;
  currency: string;
}

/** Counts and coverage figures for one market, all of them real queries. */
export interface HomeStats {
  country_code: string;
  clinics_listed: number;
  verified_clinics: number;
  specialists: number;
  counties_covered: number;
}

export function fetchHomeFeatured(country: string, signal?: AbortSignal): Promise<HomeFeatured> {
  return getJson<HomeFeatured>("/home/featured", { query: { country }, signal });
}

export function fetchHomeStats(country: string, signal?: AbortSignal): Promise<HomeStats> {
  return getJson<HomeStats>("/home/stats", { query: { country }, signal });
}
