import { describe, expect, it, vi } from "vitest";

vi.mock("./apiClient", () => ({ postJson: vi.fn() }));

import { postJson } from "./apiClient";
import { type UploadRequest, type UploadResponse, requestUpload } from "./uploadApi";

const postJsonMock = vi.mocked(postJson);

describe("uploadApi", () => {
  it("asks the API for a presigned PUT using the caller's token", async () => {
    const response: UploadResponse = {
      object_key: "specialist_avatar/sp-1/photo.png",
      upload_url: "https://objects.example.com/put",
      headers: { "Content-Type": "image/png" },
      expires_in: 900,
      method: "PUT",
      public_url: "https://images.example.com/specialist_avatar/sp-1/photo.png",
    };
    postJsonMock.mockResolvedValue(response);
    const data: UploadRequest = {
      purpose: "specialist_avatar",
      content_type: "image/png",
      size: 12,
    };

    expect(await requestUpload(data)).toEqual(response);
    expect(postJsonMock).toHaveBeenCalledWith("/uploads", data, { auth: true });
  });
});
