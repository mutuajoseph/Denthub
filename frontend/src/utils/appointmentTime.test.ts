import { describe, expect, it } from "vitest";
import { formatAppointmentSlot } from "./appointmentTime";

describe("formatAppointmentSlot", () => {
  it("formats a wall-clock slot without shifting it", () => {
    expect(formatAppointmentSlot("2030-01-01T09:30:00")).toBe("1 Jan 2030, 09:30");
  });

  it("keeps minute precision at midnight", () => {
    expect(formatAppointmentSlot("2030-12-31T00:00:00")).toBe("31 Dec 2030, 00:00");
  });

  it("returns the raw value when it cannot be parsed", () => {
    expect(formatAppointmentSlot("not-a-date")).toBe("not-a-date");
  });
});
