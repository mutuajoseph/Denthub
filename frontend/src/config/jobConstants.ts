/** Static domain config for the public dental jobs board. */

/**
 * Employment terms, matching the backend `employment_type` column in
 * `backend/app/repositories/job.py`, so a filter value is sent as-is.
 */
export const JOB_EMPLOYMENT_TYPES = ["Full Time", "Part Time", "Contract", "Internship"] as const;

export type JobEmployment = (typeof JOB_EMPLOYMENT_TYPES)[number];

/** How many postings are shown before the "show all" toggle appears. */
export const JOBS_PAGE_SIZE = 6;

/**
 * How many postings the board asks for per request. The backend caps `limit` at
 * 100 (its `MAX_PAGE_SIZE`), and the board fetches the market once and reveals
 * client-side, the same strategy the listings board uses.
 */
export const JOBS_BOARD_LIMIT = 100;
