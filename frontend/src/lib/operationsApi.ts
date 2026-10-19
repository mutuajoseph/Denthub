/**
 * Contract types for the operations console (#83), mirroring the backend
 * Pydantic models in `backend/app/logic/v1/operations.py` and the routes in
 * `backend/app/routes/v1/operations.py`.
 *
 * Every call needs a staff-surface token for a `platform_operator` account with
 * a Division assigned. The server reads the Division and tier from the account
 * row on each request, so the wire values below are informational for the UI:
 * the client never sends its own scope, and a write is refused server-side for
 * an Assistant even if a button were shown.
 */

import { getJson, patchJson } from "./apiClient";

/** The one Division a Platform Operator is scoped to (PRD §2). */
export type OperatorDivision =
  | "jobs"
  | "shop"
  | "training"
  | "dentist"
  | "international"
  | "suppliers";

/** A Lead writes inside its Division; an Assistant only reads. */
export type OperatorTier = "lead" | "assistant";

/** What moderation may set a Job posting to. */
export type JobStatus = "published" | "hidden";

export interface OperationsOverviewWire {
  division: OperatorDivision;
  tier: OperatorTier;
  can_write: boolean;
}

export interface DivisionJobWire {
  id: string;
  title: string;
  status: string;
  country_code: string;
  posted_at: string;
}

export interface DivisionJobListWire {
  items: DivisionJobWire[];
}

export function fetchOperationsOverview(options: { signal?: AbortSignal } = {}) {
  return getJson<OperationsOverviewWire>("/operations/overview", {
    auth: true,
    signal: options.signal,
  });
}

export function fetchDivisionJobs(options: { signal?: AbortSignal } = {}) {
  return getJson<DivisionJobListWire>("/operations/jobs", {
    auth: true,
    signal: options.signal,
  });
}

export function setDivisionJobStatus(postingId: string, status: JobStatus) {
  return patchJson<DivisionJobWire>(
    `/operations/jobs/${encodeURIComponent(postingId)}`,
    { status },
    { auth: true },
  );
}
