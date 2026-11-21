/**
 * Contract types for Verification applications (#124), mirroring the backend
 * Pydantic models in `backend/app/logic/v1/verification.py`.
 *
 * Document keys are opaque object keys from the private bucket (ADR-0007); no
 * file bytes cross this boundary. Only the owning applicant and reviewing staff
 * ever see an application.
 */

import { getJson, postJson } from "./apiClient";

export type VerificationSubjectKind = "specialist" | "facility" | "supplier" | "training_provider";

export type VerificationStatus = "pending" | "verified" | "rejected" | "revoked";
export type VerificationDecision = "approve" | "reject" | "revoke";

export interface VerificationApplicationWire {
  id: string;
  subject_kind: VerificationSubjectKind;
  subject_id: string;
  applicant_email: string;
  licence_number: string;
  issuing_body: string;
  document_keys: string[];
  status: VerificationStatus;
  rejection_reason: string | null;
  created_at: string;
  decided_at: string | null;
}

export interface VerificationApplicationListWire {
  items: VerificationApplicationWire[];
}

export interface SubmitVerificationRequest {
  subject_kind: VerificationSubjectKind;
  licence_number: string;
  issuing_body: string;
  document_keys: string[];
}

export interface DecideVerificationRequest {
  reason?: string | null;
}

export function submitVerification(request: SubmitVerificationRequest) {
  return postJson<VerificationApplicationWire>("/verifications", request, { auth: true });
}

export function fetchMyVerifications(options: { signal?: AbortSignal } = {}) {
  return getJson<VerificationApplicationListWire>("/me/verifications", {
    auth: true,
    signal: options.signal,
  });
}

export function fetchAdminVerifications(options: { signal?: AbortSignal } = {}) {
  return getJson<VerificationApplicationListWire>("/admin/verifications/applications", {
    auth: true,
    signal: options.signal,
  });
}

export function fetchDivisionVerifications(options: { signal?: AbortSignal } = {}) {
  return getJson<VerificationApplicationListWire>("/operations/verifications", {
    auth: true,
    signal: options.signal,
  });
}

export function decideAdminVerification(
  applicationId: string,
  decision: VerificationDecision,
  reason?: string | null,
) {
  return postJson<VerificationApplicationWire>(
    `/admin/verifications/${encodeURIComponent(applicationId)}/${decision}`,
    { reason },
    { auth: true },
  );
}

export function decideDivisionVerification(
  applicationId: string,
  decision: VerificationDecision,
  reason?: string | null,
) {
  return postJson<VerificationApplicationWire>(
    `/operations/verifications/${encodeURIComponent(applicationId)}/${decision}`,
    { reason },
    { auth: true },
  );
}
