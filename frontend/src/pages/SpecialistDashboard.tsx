import Badge from "../components/ui/Badge";
import Card from "../components/ui/Card";
import {
  useAdvanceSpecialistAppointment,
  useSpecialistAppointments,
} from "../hooks/useSpecialistAppointments";
import { APPOINTMENT_STATUS_LABELS } from "../lib/appointmentApi";
import type { AuthUser } from "../lib/auth";
import { FACILITY_ACTION_LABELS, NEXT_FACILITY_STEP } from "../lib/facilityApi";
import { formatAppointmentSlot } from "../utils/appointmentTime";

type SpecialistDashboardProps = {
  user: AuthUser | null;
};

const STATUS_TONES: Record<string, "neutral" | "success" | "ink" | "graphite"> = {
  PENDING: "neutral",
  CONFIRMED: "success",
  IN_PROGRESS: "graphite",
  COMPLETED: "ink",
};

function describeError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "The specialist dashboard could not be loaded.";
}

export function SpecialistDashboard({ user }: SpecialistDashboardProps) {
  const userId = user?.id ?? null;
  const appointments = useSpecialistAppointments(userId);
  const advance = useAdvanceSpecialistAppointment(userId);

  if (!user) {
    return null;
  }

  if (appointments.isLoading) {
    return (
      <section className="mx-auto w-full max-w-[960px] px-4 py-10">
        <output className="block text-sm text-slate">Loading your appointments…</output>
      </section>
    );
  }

  if (appointments.error) {
    return (
      <section className="mx-auto w-full max-w-[960px] px-4 py-10">
        <p role="alert" className="text-sm text-red-700">
          {describeError(appointments.error)}
        </p>
        <button
          type="button"
          onClick={() => void appointments.refetch()}
          className="mt-2 text-sm font-semibold text-ink underline"
        >
          Try again
        </button>
      </section>
    );
  }

  const items = appointments.items;

  return (
    <section className="mx-auto w-full max-w-[960px] px-4 py-10">
      <header className="mb-6">
        <h1 className="font-display text-[32px] leading-tight font-semibold tracking-[-0.03em] text-ink">
          Your appointments
        </h1>
        <p className="mt-2 text-sm text-slate">Signed in as {user.full_name}</p>
      </header>

      <Card tone="white" hover={false}>
        <h2 className="font-display text-lg font-semibold tracking-[-0.02em] text-ink">
          Appointments
        </h2>
        {items.length === 0 ? (
          <p className="mt-3 text-sm text-charcoal">
            No appointments are booked for your listing yet.
          </p>
        ) : (
          <ul className="mt-3 space-y-3">
            {items.map((appointment) => {
              const label = APPOINTMENT_STATUS_LABELS[appointment.status] ?? appointment.status;
              const next = NEXT_FACILITY_STEP[appointment.status];
              return (
                <li
                  key={appointment.id}
                  className="rounded-button border border-steel bg-paper p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-ink">
                        {formatAppointmentSlot(appointment.scheduled_at)}
                      </p>
                      <div className="mt-2">
                        <Badge variant={STATUS_TONES[appointment.status] ?? "neutral"}>
                          {label}
                        </Badge>
                      </div>
                    </div>
                    {next ? (
                      <button
                        type="button"
                        disabled={advance.isPending}
                        onClick={() =>
                          advance.mutate({ appointmentId: appointment.id, status: next })
                        }
                        className="rounded-button bg-ink px-3 py-2 text-sm font-semibold text-paper disabled:opacity-50"
                      >
                        {FACILITY_ACTION_LABELS[next]}
                      </button>
                    ) : null}
                  </div>
                  {appointment.note && (
                    <p className="mt-2 border-t border-steel pt-2 text-sm text-charcoal">
                      {appointment.note}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {advance.error && (
          <p role="alert" className="mt-3 text-sm text-red-700">
            {describeError(advance.error)}
          </p>
        )}
      </Card>
    </section>
  );
}
