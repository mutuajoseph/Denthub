/** Static domain config for the public training & CPD catalogue. */

/** Delivery modes a course can be run in, as the API stores them. */
export const COURSE_FORMATS = [
  { id: "in_person", label: "In Person" },
  { id: "online", label: "Online" },
  { id: "blended", label: "Blended" },
] as const;

export type CourseFormat = (typeof COURSE_FORMATS)[number]["id"];

/** A format label for a chip or badge, falling back to the raw value. */
export function courseFormatLabel(format: string): string {
  return COURSE_FORMATS.find((option) => option.id === format)?.label ?? format;
}

/** The courses feed fetches one page and filters in the client. */
export const TRAINING_PAGE_LIMIT = 100;
