import { describe, expect, it } from "vitest";

import type { OpeningHourView } from "../lib/listingApi";
import { summarizeHours } from "./hours";

function row(
  weekday: number,
  opens: string | null,
  closes: string | null,
  isClosed = false,
): OpeningHourView {
  return { weekday, opens, closes, isClosed };
}

const WEEKDAYS_SAME_WINDOW = [
  row(0, "08:00", "17:00"),
  row(1, "08:00", "17:00"),
  row(2, "08:00", "17:00"),
  row(3, "08:00", "17:00"),
  row(4, "08:00", "17:00"),
  row(5, "09:00", "13:00"),
  row(6, null, null, true),
];

describe("summarizeHours", () => {
  it("groups consecutive weekdays that share a window", () => {
    expect(summarizeHours(WEEKDAYS_SAME_WINDOW)).toBe(
      "Mon–Fri 08:00–17:00 · Sat 09:00–13:00 · Sun closed",
    );
  });

  it("reads a single day without a range", () => {
    expect(summarizeHours([row(0, "08:00", "17:00")])).toBe("Mon 08:00–17:00 · Tue–Sun closed");
  });

  it("reads a missing weekday row as closed", () => {
    // Only Mon–Wed published; the backend treats the rest as closed.
    expect(
      summarizeHours([
        row(0, "08:00", "17:00"),
        row(1, "08:00", "17:00"),
        row(2, "08:00", "17:00"),
      ]),
    ).toBe("Mon–Wed 08:00–17:00 · Thu–Sun closed");
  });

  it("reads a row marked closed as closed even with times on it", () => {
    expect(
      summarizeHours([
        row(0, "08:00", "17:00", true),
        row(1, "08:00", "17:00"),
        row(2, "08:00", "17:00"),
      ]),
    ).toBe("Mon closed · Tue–Wed 08:00–17:00 · Thu–Sun closed");
  });

  it("reads a row with no window as closed", () => {
    expect(summarizeHours([row(0, null, "17:00"), row(1, "08:00", "17:00")])).toBe(
      "Mon closed · Tue 08:00–17:00 · Wed–Sun closed",
    );
  });

  it("collapses a branch that is closed every day", () => {
    const allClosed = [0, 1, 2, 3, 4, 5, 6].map((weekday) => row(weekday, null, null, true));

    expect(summarizeHours(allClosed)).toBe("Closed all week");
  });

  it("collapses a branch whose only published row is closed", () => {
    expect(summarizeHours([row(0, "08:00", "17:00", true)])).toBe("Closed all week");
  });

  it("returns an empty string when no hours are published", () => {
    expect(summarizeHours([])).toBe("");
  });

  it("ignores out-of-range weekday rows", () => {
    expect(summarizeHours([row(7, "08:00", "17:00"), row(-1, "08:00", "17:00")])).toBe("");
  });
});
