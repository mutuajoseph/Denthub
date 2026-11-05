import { describe, expect, it, vi } from "vitest";

vi.mock("./apiClient", () => ({
  getJson: vi.fn(),
  patchJson: vi.fn(),
  postJson: vi.fn(),
}));

import { getJson, patchJson, postJson } from "./apiClient";
import { addProfile, fetchMe, updateMe } from "./meApi";

const getJsonMock = vi.mocked(getJson);
const patchJsonMock = vi.mocked(patchJson);
const postJsonMock = vi.mocked(postJson);

const wireUser = {
  id: "user-1",
  email: "amina@example.com",
  role: "patient",
  full_name: "Amina Wanjiku",
  phone: "+254700000000",
  home_country_code: "KE",
  is_staff: false,
  account_status: "active",
  email_verified: true,
  profiles: [{ kind: "patient" }],
  memberships: [],
};

describe("meApi", () => {
  it("reads the caller's account from /me", async () => {
    const signal = new AbortController().signal;
    getJsonMock.mockResolvedValue(wireUser);

    const user = await fetchMe({ signal });

    expect(getJsonMock).toHaveBeenCalledWith("/me", { auth: true, signal });
    expect(user.phone).toBe("+254700000000");
    expect(user.home_country_code).toBe("KE");
    expect(user.profiles).toEqual([{ kind: "patient" }]);
  });

  it("sends a partial account update to PATCH /me", async () => {
    patchJsonMock.mockResolvedValue({ ...wireUser, full_name: "Amina Updated" });

    const user = await updateMe({
      full_name: "Amina Updated",
      phone: null,
      home_country_code: "NG",
    });

    expect(patchJsonMock).toHaveBeenCalledWith(
      "/me",
      { full_name: "Amina Updated", phone: null, home_country_code: "NG" },
      { auth: true },
    );
    expect(user.full_name).toBe("Amina Updated");
  });

  it("adds a Profile kind under /me/profiles", async () => {
    postJsonMock.mockResolvedValue({
      ...wireUser,
      profiles: [{ kind: "patient" }, { kind: "specialist" }],
    });

    const user = await addProfile("specialist");

    expect(postJsonMock).toHaveBeenCalledWith(
      "/me/profiles",
      { kind: "specialist" },
      { auth: true },
    );
    expect(user.profiles).toEqual([{ kind: "patient" }, { kind: "specialist" }]);
  });

  it("rejects a response without the account identity", async () => {
    getJsonMock.mockResolvedValue({ id: "user-1" });

    await expect(fetchMe()).rejects.toThrow("Invalid authentication response");
  });
});
