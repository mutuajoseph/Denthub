import { Link } from "react-router-dom";
import { useMyAppointments } from "../../hooks/useAppointments";
import { APPOINTMENT_STATUS_LABELS } from "../../lib/appointmentApi";
import { formatAppointmentSlot } from "../../utils/appointmentTime";
import Badge from "../ui/Badge";
import { AppointmentActions } from "./AppointmentActions";

const STATUS_TONES: Record<string, "neutral" | "success" | "ink" | "graphite" | "danger"> = {
  PENDING: "neutral",
  CONFIRMED: "success",
  IN_PROGRESS: "graphite",
  COMPLETED: "ink",
  CANCELLED: "danger",
};

function describeError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Your appointments could not be loaded.";
}

/**
 * The signed-in Patient's appointments, soonest slot first. Empty, loading and
 * error are in-place states on this one panel, so a patient never lands on a
 * blank account area.
 */
export function AppointmentsSection({ userId }: { userId: string | null }) {
  const { items, isLoading, error, refetch } = useMyAppointments(userId);

  return (
    <section
      aria-labelledby="appointments-heading"
      className="rounded-card border border-steel bg-cloud p-5"
    >
      <h2 id="appointments-heading" className="font-heading text-lg font-semibold text-ink">
        Appointments
      </h2>

      {isLoading ? (
        <output className="mt-3 block text-sm text-slate">Loading your appointments…</output>
      ) : error ? (
        <div className="mt-3">
          <p role="alert" className="text-sm text-red-700">
            {describeError(error)}
          </p>
          <button
            type="button"
            onClick={() => void refetch()}
            className="mt-2 text-sm font-semibold text-ink underline"
          >
            Try again
          </button>
        </div>
      ) : items.length === 0 ? (
        <p className="mt-3 text-sm text-charcoal">
          You have no appointments yet.{" "}
          <Link to="/find-dentist" className="font-semibold text-ink underline">
            Find a dentist
          </Link>{" "}
          to book one.
        </p>
      ) : (
        <ul className="mt-3 space-y-3">
          {items.map((appointment) => {
            const label = APPOINTMENT_STATUS_LABELS[appointment.status] ?? appointment.status;

            return (
              <li key={appointment.id} className="rounded-button border border-steel bg-paper p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-ink">
                      {appointment.listing_name ?? "Listing no longer available"}
                    </p>
                    <p className="mt-1 text-sm text-charcoal">
                      {formatAppointmentSlot(appointment.scheduled_at)}
                    </p>
                  </div>
                  <Badge variant={STATUS_TONES[appointment.status] ?? "neutral"}>{label}</Badge>
                </div>
                {appointment.note && (
                  <p className="mt-2 border-t border-steel pt-2 text-sm text-charcoal">
                    {appointment.note}
                  </p>
                )}
                <AppointmentActions appointment={appointment} />
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
