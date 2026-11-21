import { afterEach, describe, expect, it, vi } from "vitest";

import type { UploadResponse } from "../lib/uploadApi";
import { putObject } from "./putObject";

const upload: UploadResponse = {
  object_key: "specialist_avatar/sp-1/photo.png",
  upload_url: "https://objects.example.com/put",
  headers: { "Content-Type": "image/png" },
  expires_in: 900,
  method: "PUT",
  public_url: null,
};

describe("putObject", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("sends the file straight to the presigned URL with the returned headers", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);
    const photo = new File(["png"], "avatar.png", { type: "image/png" });

    await putObject(upload, photo);

    expect(fetchMock).toHaveBeenCalledWith(upload.upload_url, {
      method: "PUT",
      headers: upload.headers,
      body: photo,
    });
  });

  it("reports a refused upload", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));

    await expect(putObject(upload, new File(["x"], "x.png"))).rejects.toThrow(
      /could not be uploaded/,
    );
  });
});
