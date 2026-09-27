import type { JobEmployment, JobType } from "../config/jobConstants";

export interface Job {
  readonly id: string;
  readonly title: string;
  readonly clinic: string;
  readonly countryCode: string;
  /** Matches `Subdivision.id` in `config/subdivisions.ts`. */
  readonly subdivisionId: string;
  readonly subdivision: string;
  readonly employment: JobEmployment;
  readonly type: JobType;
  /** Monthly gross pay. `null` when the employer does not disclose a range. */
  readonly salaryMin: number | null;
  readonly salaryMax: number | null;
  readonly requirements: string;
  readonly posted: string;
}

/**
 * Postings are fixture-backed: there is no jobs backend yet. Salaries are plain
 * whole-unit amounts in the region's currency, formatted with `formatMoney`.
 */
const JOBS: readonly Job[] = [
  {
    id: "job-nairobi-bds",
    title: "Dentist (BDS)",
    clinic: "Nairobi Dental Care Centre",
    countryCode: "KE",
    subdivisionId: "static-KE-NAIROBI",
    subdivision: "Nairobi",
    employment: "Full Time",
    type: "Dentist",
    salaryMin: 180000,
    salaryMax: 250000,
    requirements: "BDS with a valid KDC registration and two years of clinical experience.",
    posted: "2 days ago",
  },
  {
    id: "job-mombasa-assistant",
    title: "Dental Assistant",
    clinic: "Mombasa Smile Studio",
    countryCode: "KE",
    subdivisionId: "static-KE-MOMBASA",
    subdivision: "Mombasa",
    employment: "Full Time",
    type: "Dental Assistant",
    salaryMin: 45000,
    salaryMax: 60000,
    requirements: "Certificate in dental assisting; chairside assistance and infection control.",
    posted: "4 days ago",
  },
  {
    id: "job-kisumu-hygienist",
    title: "Dental Hygienist",
    clinic: "Lake Basin Dental Group",
    countryCode: "KE",
    subdivisionId: "static-KE-KISUMU",
    subdivision: "Kisumu",
    employment: "Part Time",
    type: "COHO",
    salaryMin: 60000,
    salaryMax: null,
    requirements: "Diploma in dental hygiene; prevention clinics and oral health education.",
    posted: "1 week ago",
  },
  {
    id: "job-nairobi-reception",
    title: "Receptionist",
    clinic: "Dental Partners Kenya",
    countryCode: "KE",
    subdivisionId: "static-KE-NAIROBI",
    subdivision: "Nairobi",
    employment: "Full Time",
    type: "Receptionist",
    salaryMin: 35000,
    salaryMax: 45000,
    requirements: "Front desk experience, patient records and appointment scheduling.",
    posted: "1 week ago",
  },
  {
    id: "job-eldoret-tech",
    title: "Dental Technician",
    clinic: "North Rift Dental Labs",
    countryCode: "KE",
    subdivisionId: "static-KE-ELDORET",
    subdivision: "Eldoret",
    employment: "Full Time",
    type: "Technician",
    salaryMin: 70000,
    salaryMax: 95000,
    requirements: "Prosthetics experience with digital impression and CAD/CAM workflows.",
    posted: "2 weeks ago",
  },
  {
    id: "job-nakuru-coho",
    title: "Community Oral Health Officer",
    clinic: "Nakuru Outreach Dental Unit",
    countryCode: "KE",
    subdivisionId: "static-KE-NAKURU",
    subdivision: "Nakuru",
    employment: "Contract",
    type: "COHO",
    salaryMin: 55000,
    salaryMax: 70000,
    requirements: "Diploma in dental technology; community outreach and oral health campaigns.",
    posted: "2 weeks ago",
  },
  {
    id: "job-nairobi-equipment",
    title: "Equipment Technician",
    clinic: "Dental Equipment Kenya",
    countryCode: "KE",
    subdivisionId: "static-KE-NAIROBI",
    subdivision: "Nairobi",
    employment: "Full Time",
    type: "Equipment Tech",
    salaryMin: 80000,
    salaryMax: 110000,
    requirements: "Installation, servicing and maintenance of dental chairs and compressors.",
    posted: "3 weeks ago",
  },
  {
    id: "job-mombasa-intern",
    title: "Dental Intern",
    clinic: "Coast General Dental Centre",
    countryCode: "KE",
    subdivisionId: "static-KE-MOMBASA",
    subdivision: "Mombasa",
    employment: "Internship",
    type: "Dental Assistant",
    salaryMin: 25000,
    salaryMax: 25000,
    requirements: "Final-year dental student; supervised chairside rotations.",
    posted: "3 weeks ago",
  },
];

export function listJobFixtures(): readonly Job[] {
  return JOBS;
}
