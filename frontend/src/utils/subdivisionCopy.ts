/**
 * Country-aware copy for states / counties / provinces / emirates.
 */

export interface Geography {
  subdivisionLabel?: string;
  subdivisionPlural?: string;
}

const LABEL_TO_PLURAL: Record<string, string> = {
  County: "Counties",
  State: "States",
  Province: "Provinces",
  Emirate: "Emirates",
  "State / UT": "States & UTs",
  Region: "Regions",
};

export function defaultSubdivisionPlural(label?: string): string {
  if (!label) return "Regions";
  return LABEL_TO_PLURAL[label] || `${label}s`;
}

export function getSubdivisionPlural(geography: Geography = {}): string {
  return geography.subdivisionPlural || defaultSubdivisionPlural(geography.subdivisionLabel);
}

export function verifiedClinicsSubtitle(count: number, geography: Geography = {}): string {
  const plural = getSubdivisionPlural(geography).toLowerCase();
  if (!count || count < 1) {
    return "Verified clinics nationwide";
  }
  return `Verified clinics across all ${count} ${plural}`;
}

export function subdivisionTrustBadge(count: number, geography: Geography = {}): string {
  const plural = getSubdivisionPlural(geography);
  return `${count} ${plural}`;
}

function isSubdivisionCoverageBadge(badge: string): boolean {
  return /^\d+\+?\s/.test(badge) && /(Counties|States|Provinces|Regions|Emirates|UTs)/i.test(badge);
}

export function patchTrustBadges(
  badges: string[] | undefined,
  count: number,
  geography: Geography = {},
): string[] | undefined {
  if (!badges?.length || !count) return badges;
  const replacement = subdivisionTrustBadge(count, geography);
  return badges.map((b) => (isSubdivisionCoverageBadge(b) ? replacement : b));
}

export function searchBySubdivisionDesc(
  subdivisionLabel: string,
  insuranceScheme?: string | null,
): string {
  const sub = subdivisionLabel.toLowerCase();
  if (insuranceScheme) {
    return `Find dentists by ${sub}, specialty, or ${insuranceScheme}`;
  }
  return `Find dentists by ${sub} or specialty`;
}
