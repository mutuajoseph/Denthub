/**
 * Appointment slots are **wall-clock** times at the Listing's Country: the API
 * sends `YYYY-MM-DDTHH:mm` with no offset, and the value means exactly the
 * digits it shows (the same rule Opening Hours live by). Displaying it must not
 * shift it, so we read the naive string as if it were UTC and format it back in
 * UTC — every digit the Patient chose survives any browser timezone.
 */
const slotFormatter = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

/** `2030-01-01T09:30:00` → `1 Jan 2030, 09:30`, in the digits given. */
export function formatAppointmentSlot(wallClock: string): string {
  const instant = new Date(`${wallClock}Z`);

  if (Number.isNaN(instant.getTime())) {
    return wallClock;
  }

  return slotFormatter.format(instant);
}
