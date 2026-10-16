import { CalendarDays, CheckCircle2, X } from "lucide-react";
import { type FormEvent, useId, useState } from "react";
import { isPatientRole } from "../../auth/roles";
import { useBookAppointment } from "../../hooks/useAppointments";
import { ApiError } from "../../lib/apiClient";
import type { AuthUser } from "../../lib/auth";
import type { ListingType } from "../../lib/listingApi";
import Button from "../ui/Button";

export interface BookAppointmentInlineProps {
  listingType: ListingType;
  listingId: string;
  /** Display name for the listing (Facility or Specialist). */
  listingName: string;
  /** The signed-in account; `null` renders nothing. */
  user: AuthUser | null;
}

/**
 * Inline booking for signed-in patients. Anyone else — signed out, or a staff
 * or supplier account — sees nothing: booking is a Patient action, and the
 * backend rejects anything else with 403 anyway.
 *
 * The Patient chooses a wall-clock slot in the Listing's Country via an HTML
 * `datetime-local` input. The backend treats that string as naive (no offset)
 * and checks it against the Country's local "now", so it is sent unchanged.
 */
export function BookAppointmentInline({
  listingType,
  listingId,
  listingName,
  user,
}: BookAppointmentInlineProps) {
  const headingId = useId();
  const [isOpen, setIsOpen] = useState(false);
  const [scheduledAt, setScheduledAt] = useState("");
  const [note, setNote] = useState("");
  const book = useBookAppointment();

  if (!user || !isPatientRole(user)) {
    return null;
  }

  function reset(): void {
    setScheduledAt("");
    setNote("");
    setIsOpen(false);
    book.reset();
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    book.mutate(
      {
        listing_type: listingType,
        listing_id: listingId,
        scheduled_at: scheduledAt,
        note: note.trim() ? note : undefined,
      },
      // Keep the panel open so the confirmation banner is actually read; the
      // fields clear so the next booking starts fresh.
      {
        onSuccess: () => {
          setScheduledAt("");
          setNote("");
        },
      },
    );
  }

  function getErrorMessage(error: unknown): string {
    if (error instanceof ApiError) {
      return error.message;
    }
    if (error instanceof Error) {
      return error.message;
    }
    return "The appointment could not be booked.";
  }

  /** Editing the form clears a previous result so a stale banner never lingers. */
  function updateField(setter: (value: string) => void, value: string): void {
    if (book.isSuccess || book.isError) {
      book.reset();
    }
    setter(value);
  }

  if (!isOpen) {
    return (
      <div className="rounded-card border border-steel bg-cloud p-5">
        <h2 className="font-heading text-lg font-semibold text-ink">Book appointment</h2>
        <p className="mt-2 text-sm text-charcoal">
          Choose a slot for {listingName}. Appointments are saved to your account.
        </p>
        <Button className="mt-4" icon={CalendarDays} onClick={() => setIsOpen(true)}>
          Book now
        </Button>
      </div>
    );
  }

  return (
    <section
      className="rounded-card border border-steel bg-paper p-5 shadow-card-white sm:p-6"
      aria-labelledby={headingId}
    >
      <div className="flex items-start justify-between gap-4">
        <h2 id={headingId} className="font-heading text-xl font-semibold text-ink">
          Book appointment
        </h2>
        <button
          type="button"
          onClick={reset}
          aria-label="Close booking form"
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-button text-slate transition hover:bg-cloud hover:text-ink"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>

      {book.isSuccess && (
        <div
          className="mt-5 flex items-start gap-3 rounded-button bg-green-50 p-4 text-green-950"
          aria-live="polite"
        >
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
          <div>
            <h3 className="font-heading font-semibold">Appointment requested</h3>
            <p className="mt-1 text-sm">
              Your appointment with {listingName} is pending confirmation.
            </p>
          </div>
        </div>
      )}

      {book.isError && (
        <p className="mt-4 rounded-button border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {getErrorMessage(book.error)}
        </p>
      )}

      <form className="mt-5 grid gap-4" onSubmit={handleSubmit}>
        <div>
          <label htmlFor={`${headingId}-slot`} className="text-sm font-medium text-charcoal">
            Preferred slot (wall-clock time for this listing)
          </label>
          <input
            id={`${headingId}-slot`}
            type="datetime-local"
            required
            value={scheduledAt}
            onChange={(event) => updateField(setScheduledAt, event.currentTarget.value)}
            className="mt-1.5 w-full rounded-button border border-steel bg-paper px-3.5 py-2.5 text-sm text-ink outline-none transition focus:border-ink focus:ring-2 focus:ring-ink/20"
          />
          <p className="mt-1.5 text-xs text-slate">
            Use the local time for the listing's country. Past times cannot be booked.
          </p>
        </div>

        <div>
          <label htmlFor={`${headingId}-note`} className="text-sm font-medium text-charcoal">
            Note <span className="font-normal text-slate">(optional)</span>
          </label>
          <textarea
            id={`${headingId}-note`}
            rows={3}
            value={note}
            onChange={(event) => updateField(setNote, event.currentTarget.value)}
            placeholder="Add scheduling preferences or a question"
            className="mt-1.5 w-full resize-y rounded-button border border-steel bg-paper px-3.5 py-2.5 text-sm text-ink outline-none transition focus:border-ink focus:ring-2 focus:ring-ink/20"
          />
        </div>

        <div className="flex flex-wrap gap-3">
          <Button type="submit" disabled={book.isPending || !scheduledAt}>
            {book.isPending ? "Saving…" : "Book appointment"}
          </Button>
          <Button type="button" variant="secondary" onClick={reset}>
            Cancel
          </Button>
        </div>
      </form>
    </section>
  );
}
