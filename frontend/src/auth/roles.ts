export const ROLE = {
  PATIENT: "patient",
  INTERNATIONAL_PATIENT: "international_patient",
  DENTIST: "dentist",
  SPECIALIST: "specialist",
  INTERN: "intern",
  FACILITY_OWNER: "facility_owner",
  FRONT_OFFICE: "front_office",
  FACILITY_DENTIST: "facility_dentist",
  SUPPLIER: "supplier",
  TRAINING_PROVIDER: "training_provider",
  STAFF: "staff",
  ADMIN: "admin",
  SUPER_ADMIN: "super_admin",
  PLATFORM_OPERATOR: "platform_operator",
} as const;

export type Role = (typeof ROLE)[keyof typeof ROLE];

export const CANONICAL_ROLES = [
  ROLE.PATIENT,
  ROLE.INTERNATIONAL_PATIENT,
  ROLE.DENTIST,
  ROLE.SPECIALIST,
  ROLE.INTERN,
  ROLE.FACILITY_OWNER,
  ROLE.FRONT_OFFICE,
  ROLE.FACILITY_DENTIST,
  ROLE.SUPPLIER,
  ROLE.TRAINING_PROVIDER,
  ROLE.STAFF,
  ROLE.ADMIN,
  ROLE.SUPER_ADMIN,
  ROLE.PLATFORM_OPERATOR,
] as const satisfies readonly Role[];

export const FACILITY_ROLES = [
  ROLE.FACILITY_OWNER,
  ROLE.FRONT_OFFICE,
  ROLE.FACILITY_DENTIST,
] as const satisfies readonly Role[];

export const SUPPLIER_ROLES = [ROLE.SUPPLIER] as const satisfies readonly Role[];

export const TRAINING_PROVIDER_ROLES = [ROLE.TRAINING_PROVIDER] as const satisfies readonly Role[];

export const ADMIN_ROLES = [ROLE.ADMIN, ROLE.SUPER_ADMIN] as const satisfies readonly Role[];

export const OPERATIONS_ROLES = [ROLE.PLATFORM_OPERATOR] as const satisfies readonly Role[];

export const STAFF_ROLES = [
  ROLE.STAFF,
  ROLE.ADMIN,
  ROLE.SUPER_ADMIN,
  ROLE.PLATFORM_OPERATOR,
] as const satisfies readonly Role[];

export const PUBLIC_ROLES = [
  ROLE.PATIENT,
  ROLE.INTERNATIONAL_PATIENT,
  ROLE.DENTIST,
  ROLE.SPECIALIST,
  ROLE.INTERN,
  ...FACILITY_ROLES,
  ...SUPPLIER_ROLES,
  ...TRAINING_PROVIDER_ROLES,
] as const satisfies readonly Role[];

const ROLE_ALIASES: Readonly<Record<string, Role>> = {
  patient: ROLE.PATIENT,
  international: ROLE.INTERNATIONAL_PATIENT,
  international_patient: ROLE.INTERNATIONAL_PATIENT,
  intl_patient: ROLE.INTERNATIONAL_PATIENT,
  overseas_patient: ROLE.INTERNATIONAL_PATIENT,
  dentist: ROLE.DENTIST,
  dental_doctor: ROLE.DENTIST,
  general_dentist: ROLE.DENTIST,
  specialist: ROLE.SPECIALIST,
  dental_specialist: ROLE.SPECIALIST,
  specialist_dentist: ROLE.SPECIALIST,
  intern: ROLE.INTERN,
  dental_intern: ROLE.INTERN,
  dental_student: ROLE.INTERN,
  student: ROLE.INTERN,
  facility_owner: ROLE.FACILITY_OWNER,
  facility: ROLE.FACILITY_OWNER,
  facility_admin: ROLE.FACILITY_OWNER,
  facility_administrator: ROLE.FACILITY_OWNER,
  facility_manager: ROLE.FACILITY_OWNER,
  clinic: ROLE.FACILITY_OWNER,
  clinic_owner: ROLE.FACILITY_OWNER,
  clinic_admin: ROLE.FACILITY_OWNER,
  clinic_employer: ROLE.FACILITY_OWNER,
  employer: ROLE.FACILITY_OWNER,
  front_office: ROLE.FRONT_OFFICE,
  front_office_staff: ROLE.FRONT_OFFICE,
  reception: ROLE.FRONT_OFFICE,
  receptionist: ROLE.FRONT_OFFICE,
  reception_staff: ROLE.FRONT_OFFICE,
  front_desk: ROLE.FRONT_OFFICE,
  facility_dentist: ROLE.FACILITY_DENTIST,
  facility_specialist: ROLE.FACILITY_DENTIST,
  facility_clinical_dentist: ROLE.FACILITY_DENTIST,
  clinic_dentist: ROLE.FACILITY_DENTIST,
  clinic_specialist: ROLE.FACILITY_DENTIST,
  supplier: ROLE.SUPPLIER,
  supplier_manager: ROLE.SUPPLIER,
  training_provider: ROLE.TRAINING_PROVIDER,
  training_body: ROLE.TRAINING_PROVIDER,
  training: ROLE.TRAINING_PROVIDER,
  trainer: ROLE.TRAINING_PROVIDER,
  course_provider: ROLE.TRAINING_PROVIDER,
  education_provider: ROLE.TRAINING_PROVIDER,
  staff: ROLE.STAFF,
  internal_staff: ROLE.STAFF,
  platform_staff: ROLE.STAFF,
  team_staff: ROLE.STAFF,
  admin: ROLE.ADMIN,
  administrator: ROLE.ADMIN,
  platform_admin: ROLE.ADMIN,
  platform_administrator: ROLE.ADMIN,
  super_admin: ROLE.SUPER_ADMIN,
  superadmin: ROLE.SUPER_ADMIN,
  super_administrator: ROLE.SUPER_ADMIN,
  platform_super_admin: ROLE.SUPER_ADMIN,
  platform_operator: ROLE.PLATFORM_OPERATOR,
  operator: ROLE.PLATFORM_OPERATOR,
  operations: ROLE.PLATFORM_OPERATOR,
  operations_operator: ROLE.PLATFORM_OPERATOR,
  platform_ops: ROLE.PLATFORM_OPERATOR,
};

function normalizeKey(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const key = value
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  return key || null;
}

function subjectRole(subject: unknown): unknown {
  if (typeof subject === "object" && subject !== null && "role" in subject) {
    return (subject as { role?: unknown }).role;
  }

  return subject;
}

export function normalizeRole(value: unknown): Role | null {
  const key = normalizeKey(subjectRole(value));
  return key ? (ROLE_ALIASES[key] ?? null) : null;
}

export function isCanonicalRole(value: unknown): value is Role {
  return typeof value === "string" && (CANONICAL_ROLES as readonly string[]).includes(value);
}

export function roleMatches(subject: unknown, expected: Role | readonly Role[]): boolean {
  const role = normalizeRole(subject);
  const expectedRoles = Array.isArray(expected) ? expected : [expected];

  return role !== null && expectedRoles.some((candidate) => normalizeRole(candidate) === role);
}

export const hasRole = roleMatches;
export const matchesRole = roleMatches;

export function isStaffRole(subject: unknown): boolean {
  return roleMatches(subject, STAFF_ROLES);
}

export const isStaffUser = isStaffRole;

export function isFacilityRole(subject: unknown): boolean {
  return roleMatches(subject, FACILITY_ROLES);
}

export const canAccessFacility = isFacilityRole;

export function isSupplierRole(subject: unknown): boolean {
  return roleMatches(subject, SUPPLIER_ROLES);
}

export const isSupplierUser = isSupplierRole;

export function isTrainingProviderRole(subject: unknown): boolean {
  return roleMatches(subject, TRAINING_PROVIDER_ROLES);
}

export const isTrainingProviderUser = isTrainingProviderRole;

export function isAdminRole(subject: unknown): boolean {
  return roleMatches(subject, ADMIN_ROLES);
}

export function isOperationsRole(subject: unknown): boolean {
  return roleMatches(subject, OPERATIONS_ROLES);
}

export const isPublicRole = (subject: unknown): boolean => roleMatches(subject, PUBLIC_ROLES);

export const DASHBOARD_PATHS = {
  patient: "/dashboard",
  international_patient: "/dashboard",
  dentist: "/dashboard",
  specialist: "/dashboard",
  intern: "/dashboard",
  facility_owner: "/dashboard/facility",
  front_office: "/dashboard/facility",
  facility_dentist: "/dashboard/facility",
  supplier: "/dashboard/supplier",
  training_provider: "/dashboard/training",
  staff: "/admin",
  admin: "/admin",
  super_admin: "/admin",
  platform_operator: "/operations",
} as const satisfies Record<Role, string>;

export function getDashboardPath(subject: Role): string;
export function getDashboardPath(subject: unknown): string | null;
export function getDashboardPath(subject: unknown): string | null {
  const role = normalizeRole(subject);

  return role ? DASHBOARD_PATHS[role] : null;
}

export const getCanonicalDashboardPath = getDashboardPath;
