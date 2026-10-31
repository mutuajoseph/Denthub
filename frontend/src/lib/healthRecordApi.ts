/**
 * Contract types for the Health Record endpoints, mirroring the backend Pydantic
 * models in `backend/app/logic/v1/health_records.py` — `GET`, `POST`, and
 * `PATCH /health-records/{patient_id}`.
 *
 * The **wire** shape is snake_case exactly as the API answers. The **UI** shape
 * (`HealthRecordView`) is camelCase and carries only what a screen renders; the
 * author badge reads `authorKind` (patient vs clinician), which the backend
 * snapshots at write time so it never changes under a later role edit.
 */

import { getJson, patchJson, postJson } from "./apiClient";

/** Record-level facts the Patient owns (`none` is the explicit default). */
export type MaternalStatus = "none" | "pregnant" | "lactating" | "deleted";

/** What an entry holds. */
export type HealthRecordEntryCategory =
  | "medical_history"
  | "dental_history"
  | "prescription"
  | "allergy";

/** Who wrote an entry — the author badge. */
export type HealthRecordAuthorKind = "patient" | "clinician";

/** One entry as the API answers it. */
export interface HealthRecordEntryWire {
  id: string;
  category: HealthRecordEntryCategory;
  body: string;
  author_id: string;
  author_kind: HealthRecordAuthorKind;
  /** The author's name; `null` when the account no longer exists. */
  author_name: string | null;
  created_at: string;
}

/** A Patient's Health Record as the API answers it. */
export interface HealthRecordWire {
  id: string;
  patient_id: string;
  maternal_status: MaternalStatus;
  entries: HealthRecordEntryWire[];
  created_at: string;
  updated_at: string;
}

/** The body `POST /health-records/{id}/entries` accepts. */
export interface HealthRecordEntryRequest {
  category: HealthRecordEntryCategory;
  body: string;
}

/** The body `PATCH /health-records/{id}` accepts. */
export interface HealthRecordUpdateRequest {
  maternal_status: MaternalStatus;
}

/** One entry as the UI reads it. */
export interface HealthRecordEntryView {
  id: string;
  category: HealthRecordEntryCategory;
  body: string;
  authorId: string;
  authorKind: HealthRecordAuthorKind;
  authorName: string | null;
  createdAt: string;
}

/** A Patient's Health Record as the UI reads it. */
export interface HealthRecordView {
  id: string;
  patientId: string;
  maternalStatus: MaternalStatus;
  entries: HealthRecordEntryView[];
}

/** Human labels for the maternal statuses. */
export const MATERNAL_STATUS_LABELS: Record<MaternalStatus, string> = {
  none: "Not recorded",
  pregnant: "Pregnant",
  lactating: "Lactating",
  deleted: "Deleted",
};

/**
 * The statuses the control offers. `deleted` is written by account erasure
 * only, so it is never an option the Patient can choose.
 */
export const MATERNAL_STATUSES: readonly MaternalStatus[] = ["none", "pregnant", "lactating"];

/** Human labels for the entry categories. */
export const HEALTH_RECORD_CATEGORY_LABELS: Record<HealthRecordEntryCategory, string> = {
  medical_history: "Medical history",
  dental_history: "Dental history",
  prescription: "Prescription",
  allergy: "Allergy",
};

/** The categories in the order the form offers them. */
export const HEALTH_RECORD_CATEGORIES: readonly HealthRecordEntryCategory[] = [
  "medical_history",
  "dental_history",
  "prescription",
  "allergy",
];

/** Human labels for the badge. */
export const HEALTH_RECORD_AUTHOR_LABELS: Record<HealthRecordAuthorKind, string> = {
  patient: "Patient",
  clinician: "Clinician",
};

export function mapHealthRecord(wire: HealthRecordWire): HealthRecordView {
  return {
    id: wire.id,
    patientId: wire.patient_id,
    maternalStatus: wire.maternal_status,
    entries: wire.entries.map((entry) => ({
      id: entry.id,
      category: entry.category,
      body: entry.body,
      authorId: entry.author_id,
      authorKind: entry.author_kind,
      authorName: entry.author_name,
      createdAt: entry.created_at,
    })),
  };
}

/** A Patient's Health Record. The Patient reads their own; a treating Medic too. */
export function fetchHealthRecord(
  patientId: string,
  options: { signal?: AbortSignal } = {},
): Promise<HealthRecordWire> {
  return getJson<HealthRecordWire>(`/health-records/${patientId}`, {
    auth: true,
    signal: options.signal,
  });
}

/** Append one entry to a Patient's record. */
export function addHealthRecordEntry(
  patientId: string,
  request: HealthRecordEntryRequest,
): Promise<HealthRecordEntryWire> {
  return postJson<HealthRecordEntryWire>(`/health-records/${patientId}/entries`, request, {
    auth: true,
  });
}

/** Update the record-level facts — the Patient's maternal status. */
export function updateHealthRecord(
  patientId: string,
  request: HealthRecordUpdateRequest,
): Promise<HealthRecordWire> {
  return patchJson<HealthRecordWire>(`/health-records/${patientId}`, request, { auth: true });
}
