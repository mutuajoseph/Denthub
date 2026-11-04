import { getJson, patchJson, postJson } from "./apiClient";
import { type AuthUser, type ProfileKind, parseAuthUser } from "./auth";

export interface MeUpdate {
  full_name?: string;
  phone?: string | null;
  home_country_code?: string | null;
}

export async function fetchMe(options: { signal?: AbortSignal } = {}): Promise<AuthUser> {
  const data = await getJson<unknown>("/me", { auth: true, signal: options.signal });
  return parseAuthUser(data);
}

export async function updateMe(data: MeUpdate): Promise<AuthUser> {
  const response = await patchJson<unknown>("/me", data, { auth: true });
  return parseAuthUser(response);
}

export async function addProfile(kind: ProfileKind): Promise<AuthUser> {
  const response = await postJson<unknown>("/me/profiles", { kind }, { auth: true });
  return parseAuthUser(response);
}

export const PROFILE_KIND_LABELS: Record<ProfileKind, string> = {
  patient: "Patient",
  specialist: "Specialist",
  supplier: "Supplier",
  training_provider: "Training provider",
};

export const PROFILE_KINDS: readonly ProfileKind[] = [
  "patient",
  "specialist",
  "supplier",
  "training_provider",
];
