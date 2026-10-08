/**
 * Opening-hours summaries for a profile page.
 *
 * A Branch's `hours` are seven weekday rows as the API resolved them; the
 * profile renders one line per Branch, grouping consecutive days that share a
 * window (`Mon–Fri 08:00–17:00 · Sat 09:00–13:00 · Sun closed`). A weekday
 * with no row, or a row marked closed, reads as closed — the same rule the
 * backend uses to compute `open_now`.
 */

import type { OpeningHourView } from "../lib/listingApi";

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

/** `""` when the Branch publishes no hours, so the caller can say so. */
export function summarizeHours(hours: readonly OpeningHourView[]): string {
  const byDay = new Array<string | null>(7).fill(null);

  for (const row of hours) {
    if (row.weekday < 0 || row.weekday > 6) continue;
    const isOpen = !row.isClosed && Boolean(row.opens) && Boolean(row.closes);
    byDay[row.weekday] = isOpen ? `${row.opens}\u2013${row.closes}` : "closed";
  }

  if (byDay.every((value) => value === null)) return "";

  const days = byDay.map((value) => value ?? "closed");
  if (days.every((value) => value === "closed")) return "Closed all week";

  const segments: string[] = [];
  let start = 0;

  while (start < 7) {
    let end = start;
    while (end + 1 < 7 && days[end + 1] === days[start]) end += 1;

    const label =
      end > start ? `${WEEKDAY_LABELS[start]}\u2013${WEEKDAY_LABELS[end]}` : WEEKDAY_LABELS[start];
    segments.push(`${label} ${days[start]}`);

    start = end + 1;
  }

  return segments.join(" \u00b7 ");
}
