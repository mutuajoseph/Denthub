import { type FormEvent, useId, useState } from "react";
import { useUpdateAppointment } from "../../hooks/useAppointments";
import { ApiError } from "../../lib/apiClient";
import { type AppointmentWire, isActionable } from "../../lib/appointmentApi";
import Button from "../ui/Button";

/**
 * Cancel and reschedule controls for one Appointment (#88). Only a Patient's own
 * `PENDING`/`CONFIRMED` booking has them; anything the clinic has started,
 * finished, or that was already cancelled renders nothing.
 *
 * Cancelling is destructive, so it goes through an inline confirmation rather
 * than firing on the first click. Rescheduling reuses the booking form's
 * wall-clock `datetime-local` input: the value is sent unchanged, in the
 * Listing's Country, exactly as `BookAppointmentInline` does.
 */
export function AppointmentActions({ appointment }: { appointment: AppointmentWire }) {
  const formId = useId();
  const [mode, setMode] = useState<"idle" | "confirm-cancel" | "reschedule">("idle");
  const [scheduledAt, setScheduledAt] = useState(() => toDateTimeLocal(appointment.scheduled_at));
  const [note, setNote] = useState(appointment.note ?? "");
  const update = useUpdateAppointment();

  if (!isActionable(appointment.status)) {
    return null;
  }

  function reset(): void {
    setMode("idle");
    update.reset();
  }

  function handleCancel(): void {
    update.mutate(
      { appointmentId: appointment.id, request: { action: "cancel" } },
      { onSuccess: () => setMode("idle") },
    );
  }

  function handleReschedule(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    update.mutate(
      {
        appointmentId: appointment.id,
        request: {
          action: "reschedule",
          scheduled_at: scheduledAt,
          // A cleared note is sent as null to remove it; otherwise the text is kept.
          note: note.trim() ? note : null,
        },
      },
      {
        onSuccess: (updated) => {
          setScheduledAt(toDateTimeLocal(updated.scheduled_at));
          setNote(updated.note ?? "");
          setMode("idle");
        },
      },
    );
  }

  return (
    <div className="mt-3 border-t border-steel pt-3">
      {update.isError && (
        <p role="alert" className="mb-3 text-sm text-red-700">
          {describeError(update.error)}
        </p>
      )}

      {mode === "idle" && (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" onClick={() => setMode("reschedule")}>
            Reschedule
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setMode("confirm-cancel")}>
            Cancel appointment
          </Button>
        </div>
      )}

      {mode === "confirm-cancel" && (
        <div>
          <p className="text-sm text-charcoal">Cancel this appointment? This cannot be undone.</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button size="sm" variant="danger" onClick={handleCancel} disabled={update.isPending}>
              {update.isPending ? "Cancelling…" : "Yes, cancel it"}
            </Button>
            <Button size="sm" variant="secondary" onClick={reset}>
              Keep appointment
            </Button>
          </div>
        </div>
      )}

      {mode === "reschedule" && (
        <form className="grid gap-3" onSubmit={handleReschedule}>
          <div>
            <label htmlFor={`${formId}-slot`} className="text-sm font-medium text-charcoal">
              New slot (wall-clock time for this listing)
            </label>
            <input
              id={`${formId}-slot`}
              type="datetime-local"
              required
              value={scheduledAt}
              onChange={(event) => setScheduledAt(event.currentTarget.value)}
              className="mt-1.5 w-full rounded-button border border-steel bg-paper px-3.5 py-2.5 text-sm text-ink outline-none transition focus:border-ink focus:ring-2 focus:ring-ink/20"
            />
            <p className="mt-1.5 text-xs text-slate">
              Use the local time for the listing's country. Past times cannot be booked.
            </p>
          </div>

          <div>
            <label htmlFor={`${formId}-note`} className="text-sm font-medium text-charcoal">
              Note <span className="font-normal text-slate">(optional)</span>
            </label>
            <textarea
              id={`${formId}-note`}
              rows={2}
              value={note}
              onChange={(event) => setNote(event.currentTarget.value)}
              className="mt-1.5 w-full resize-y rounded-button border border-steel bg-paper px-3.5 py-2.5 text-sm text-ink outline-none transition focus:border-ink focus:ring-2 focus:ring-ink/20"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button size="sm" type="submit" disabled={update.isPending || !scheduledAt}>
              {update.isPending ? "Saving…" : "Save new slot"}
            </Button>
            <Button size="sm" variant="secondary" onClick={reset}>
              Keep current
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

/** `2030-01-01T09:30:00` → `2030-01-01T09:30`, the shape `datetime-local` wants. */
function toDateTimeLocal(wallClock: string): string {
  return wallClock.slice(0, 16);
}

function describeError(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "The appointment could not be updated.";
}
