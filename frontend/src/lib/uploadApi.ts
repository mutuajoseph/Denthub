/**
 * Contract types for `POST /uploads`, mirroring the backend Pydantic models in
 * `backend/app/logic/v1/uploads.py` (ADR-0007, #123). No file bytes cross this
 * boundary: the server returns a presigned PUT and the object key it writes.
 */

import { postJson } from "./apiClient";

/** What a file is for; the purpose picks the bucket, limits and permission. */
export type UploadPurpose = "specialist_avatar" | "verification_document";

export interface UploadRequest {
  purpose: UploadPurpose;
  content_type: string;
  size: number;
}

export interface UploadResponse {
  object_key: string;
  upload_url: string;
  headers: Record<string, string>;
  expires_in: number;
  method: "PUT";
  /** Only a public-bucket object gets a URL anyone may read. */
  public_url: string | null;
}

export function requestUpload(data: UploadRequest): Promise<UploadResponse> {
  return postJson<UploadResponse>("/uploads", data, { auth: true });
}
