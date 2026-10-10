import { describe, expect, it } from "vitest";

import { youtubeEmbedUrl } from "./ContentViewerModal";

describe("youtubeEmbedUrl", () => {
  it("converts a watch link to an embed link", () => {
    expect(youtubeEmbedUrl("https://www.youtube.com/watch?v=abc123")).toBe(
      "https://www.youtube.com/embed/abc123",
    );
  });

  it("converts a short youtu.be link", () => {
    expect(youtubeEmbedUrl("https://youtu.be/abc123")).toBe("https://www.youtube.com/embed/abc123");
  });

  it("passes through an embed link unchanged", () => {
    expect(youtubeEmbedUrl("https://www.youtube.com/embed/abc123")).toBe(
      "https://www.youtube.com/embed/abc123",
    );
  });

  it("returns null for a non-YouTube link", () => {
    expect(youtubeEmbedUrl("https://vimeo.com/12345")).toBeNull();
  });

  it("returns null for a malformed link", () => {
    expect(youtubeEmbedUrl("not a url")).toBeNull();
  });
});
