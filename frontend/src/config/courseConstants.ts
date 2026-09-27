/** Static domain config for the public training & CPD catalogue. */

export const COURSE_SPECIALTIES = [
  "Prosthodontics",
  "Orthodontics",
  "Oral Surgery",
  "Endodontics",
  "Periodontics",
  "Paediatric",
  "Digital Dentistry",
] as const;

export type CourseSpecialty = (typeof COURSE_SPECIALTIES)[number];

export const COURSE_FORMATS = [
  { id: "all", label: "All" },
  { id: "online", label: "Online" },
  { id: "physical", label: "Physical" },
  { id: "workshop", label: "Hands-On Workshop" },
] as const;

export type CourseFormat = (typeof COURSE_FORMATS)[number]["id"];
