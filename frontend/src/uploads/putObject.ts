/**
 * The one third-party call in the upload flow: PUT the bytes straight to the
 * object store with the URL the API presigned. It lives outside `lib/` because
 * `lib/apiClient.ts` owns only `/api/v1` traffic; this call goes to R2 (or the
 * local stand-in), carries no session cookie, and must not pick up the bearer
 * token or the country headers.
 */

import type { UploadResponse } from "../lib/uploadApi";

export async function putObject(upload: UploadResponse, file: File): Promise<void> {
  const response = await fetch(upload.upload_url, {
    method: upload.method,
    headers: upload.headers,
    body: file,
  });

  if (!response.ok) {
    throw new Error("The file could not be uploaded. Please try again.");
  }
}
