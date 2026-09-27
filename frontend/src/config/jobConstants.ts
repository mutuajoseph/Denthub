/** Static domain config for the public dental jobs board. */

export const JOB_TYPES = [
  "Dentist",
  "COHO",
  "Dental Assistant",
  "Technician",
  "Receptionist",
  "Digital Marketer",
  "Equipment Tech",
  "Cleaner",
] as const;

export type JobType = (typeof JOB_TYPES)[number];

export const JOB_EMPLOYMENT_TYPES = ["Full Time", "Part Time", "Contract", "Internship"] as const;

export type JobEmployment = (typeof JOB_EMPLOYMENT_TYPES)[number];

/** How many postings are shown before the "show all" toggle appears. */
export const JOBS_PAGE_SIZE = 6;
