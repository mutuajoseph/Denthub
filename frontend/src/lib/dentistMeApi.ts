import { getJson, patchJson, postJson } from "./apiClient";
import {
  type Branch,
  type BranchView,
  type Specialty,
  type VerificationTier,
  mapBranch,
} from "./listingApi";

export interface MySpecialistWire {
  id: string;
  name: string;
  slug: string;
  bio: string | null;
  avatar_key: string | null;
  country_code: string;
  subdivision_code: string;
  currency: string;
  verification_tier: VerificationTier;
  specialties: Specialty[];
  branches: Branch[];
}

export interface MySpecialist {
  id: string;
  name: string;
  slug: string;
  bio: string | null;
  avatarKey: string | null;
  countryCode: string;
  subdivisionCode: string;
  currency: string;
  verificationTier: VerificationTier;
  specialties: Specialty[];
  branches: BranchView[];
}

export interface MySpecialistCreate {
  name?: string;
  country_code: string;
  subdivision_code: string;
  bio?: string | null;
  avatar_key?: string | null;
  specialty_codes?: string[];
  branch_ids?: string[];
}

export interface MySpecialistUpdate {
  name?: string;
  country_code?: string;
  subdivision_code?: string;
  bio?: string | null;
  avatar_key?: string | null;
  specialty_codes?: string[];
  branch_ids?: string[];
}

export function mapMySpecialist(wire: MySpecialistWire): MySpecialist {
  return {
    id: wire.id,
    name: wire.name,
    slug: wire.slug,
    bio: wire.bio,
    avatarKey: wire.avatar_key,
    countryCode: wire.country_code,
    subdivisionCode: wire.subdivision_code,
    currency: wire.currency,
    verificationTier: wire.verification_tier,
    specialties: wire.specialties,
    branches: wire.branches.map(mapBranch),
  };
}

export async function fetchMySpecialist(
  options: { signal?: AbortSignal } = {},
): Promise<MySpecialist> {
  const wire = await getJson<MySpecialistWire>("/dentists/me", {
    auth: true,
    signal: options.signal,
  });
  return mapMySpecialist(wire);
}

export async function createMySpecialist(data: MySpecialistCreate): Promise<MySpecialist> {
  const wire = await postJson<MySpecialistWire>("/dentists/me", data, { auth: true });
  return mapMySpecialist(wire);
}

export async function updateMySpecialist(data: MySpecialistUpdate): Promise<MySpecialist> {
  const wire = await patchJson<MySpecialistWire>("/dentists/me", data, { auth: true });
  return mapMySpecialist(wire);
}
