/** Static domain config for the public DentHub magazine. */

export const MAGAZINE_CATEGORIES = [
  "Clinical",
  "Technology",
  "Practice Management",
  "Patient Education",
  "Research",
] as const;

export type MagazineCategory = (typeof MAGAZINE_CATEGORIES)[number];

export const MAGAZINE_FILTERS = [
  { id: "all", label: "All" },
  { id: "article", label: "Articles" },
  { id: "video", label: "Videos" },
] as const;

export type MagazineItemType = "article" | "video";

/** Lucide icon keys used by the technology spotlight. */
export const TECH_ICON_KEYS = ["brain", "printer", "video", "zap", "sparkles", "flask"] as const;

export type TechIconKey = (typeof TECH_ICON_KEYS)[number];
