import { describe, expect, it, vi } from "vitest";

vi.mock("./apiClient", () => ({ getJson: vi.fn(), postJson: vi.fn() }));

import { getJson, postJson } from "./apiClient";
import {
  decideAdminVerification,
  decideDivisionVerification,
  fetchAdminVerifications,
  fetchDivisionVerifications,
  fetchMyVerifications,
  submitVerification,
} from "./verificationApi";

const getJsonMock = vi.mocked(getJson);
const postJsonMock = vi.mocked(postJson);

const request = {
  subject_kind: "specialist" as const,
  licence_number: "LIC-1",
  issuing_body: "Dental Board",
  document_keys: ["private/doc.pdf"],
};

describe("verificationApi", () => {
  it("submits an application with the caller's token", async () => {
    postJsonMock.mockResolvedValue({ id: "v-1" });

    await submitVerification(request);

    expect(postJsonMock).toHaveBeenCalledWith("/verifications", request, { auth: true });
  });

  it("reads only the caller's own latest application", async () => {
    getJsonMock.mockResolvedValue({ items: [] });

    await fetchMyVerifications();

    expect(getJsonMock).toHaveBeenCalledWith(
      "/me/verifications",
      expect.objectContaining({ auth: true }),
    );
  });

  it("keeps the admin and division queues on distinct paths", async () => {
    getJsonMock.mockResolvedValue({ items: [] });

    await fetchAdminVerifications();
    await fetchDivisionVerifications();

    expect(getJsonMock).toHaveBeenNthCalledWith(
      1,
      "/admin/verifications/applications",
      expect.anything(),
    );
    expect(getJsonMock).toHaveBeenNthCalledWith(2, "/operations/verifications", expect.anything());
  });

  it("posts decisions to the matching surface with the reason", async () => {
    postJsonMock.mockResolvedValue({ id: "v-1" });

    await decideAdminVerification("v-1", "reject", "Unreadable");
    await decideDivisionVerification("v-1", "revoke", "Withdrawn");

    expect(postJsonMock).toHaveBeenNthCalledWith(
      1,
      "/admin/verifications/v-1/reject",
      { reason: "Unreadable" },
      { auth: true },
    );
    expect(postJsonMock).toHaveBeenNthCalledWith(
      2,
      "/operations/verifications/v-1/revoke",
      { reason: "Withdrawn" },
      { auth: true },
    );
  });
});
