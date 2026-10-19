import Badge from "../components/ui/Badge";
import Card from "../components/ui/Card";
import { useFacilityDashboard, useUpdateFacilityAppointment } from "../hooks/useFacilityDashboard";
import { APPOINTMENT_STATUS_LABELS, type AppointmentWire } from "../lib/appointmentApi";
import type { AuthUser } from "../lib/auth";
import {
  FACILITY_ACTION_LABELS,
  type FacilityAppointmentStatus,
  type FacilityDashboardWire,
  NEXT_FACILITY_STEP,
} from "../lib/facilityApi";
import { formatAppointmentSlot } from "../utils/appointmentTime";

type FacilityDashboardProps = {
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
  return "The clinic dashboard could not be loaded.";
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-button border border-steel bg-paper p-4">
      <p className="text-xs font-medium text-slate">{label}</p>
      <p className="mt-1 font-display text-2xl font-semibold tracking-[-0.02em] text-ink">
        {value}
      </p>
    </div>
  );
}

function AppointmentRow({
  appointment,
  disabled,
  onAdvance,
}: {
  appointment: AppointmentWire;
  disabled: boolean;
  onAdvance: (appointmentId: string, status: FacilityAppointmentStatus) => void;
}) {
  const label = APPOINTMENT_STATUS_LABELS[appointment.status] ?? appointment.status;
  const next = NEXT_FACILITY_STEP[appointment.status];

  return (
    <li className="rounded-button border border-steel bg-paper p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ink">
            {formatAppointmentSlot(appointment.scheduled_at)}
          </p>
          <div className="mt-2">
            <Badge variant={STATUS_TONES[appointment.status] ?? "neutral"}>{label}</Badge>
          </div>
        </div>
        {next ? (
          <button
            type="button"
            disabled={disabled}
            onClick={() => onAdvance(appointment.id, next)}
            className="rounded-button bg-ink px-3 py-2 text-sm font-semibold text-paper disabled:opacity-50"
          >
            {FACILITY_ACTION_LABELS[next]}
          </button>
        ) : null}
      </div>
      {appointment.note && (
        <p className="mt-2 border-t border-steel pt-2 text-sm text-charcoal">{appointment.note}</p>
      )}
    </li>
  );
}

/**
 * A clinic's own day (#81): today's bookings each carry the one forward step the
 * staff can take next, alongside the pending queue and the staff list. Empty,
 * loading and error are in-place states, so a facility account never lands on a
 * blank screen — even one not yet linked to a clinic, which the backend answers
 * with a 403 that reads here as an error message.
 */
export function FacilityDashboard({ user }: FacilityDashboardProps) {
  const userId = user?.id ?? null;
  const dashboard = useFacilityDashboard(userId);
  const advance = useUpdateFacilityAppointment(userId);

  if (!user) {
    return null;
  }

  if (dashboard.isPending) {
    return (
      <section className="mx-auto w-full max-w-[960px] px-4 py-10">
        <output className="block text-sm text-slate">Loading the clinic dashboard…</output>
      </section>
    );
  }

  if (dashboard.error || !dashboard.data) {
    return (
      <section className="mx-auto w-full max-w-[960px] px-4 py-10">
        <p role="alert" className="text-sm text-red-700">
          {describeError(dashboard.error)}
        </p>
        <button
          type="button"
          onClick={() => void dashboard.refetch()}
          className="mt-2 text-sm font-semibold text-ink underline"
        >
          Try again
        </button>
      </section>
    );
  }

  const data: FacilityDashboardWire = dashboard.data;

  return (
    <section className="mx-auto w-full max-w-[960px] px-4 py-10">
      <header className="mb-6">
        <h1 className="font-display text-[32px] leading-tight font-semibold tracking-[-0.03em] text-ink">
          {data.facility_name ?? "Your clinic"}
        </h1>
        <p className="mt-2 text-sm text-slate">
          Facility dashboard · {data.country_code} · signed in as {user.full_name}
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Pending appointments" value={data.pending_count} />
        <Stat label="Today" value={data.today.length} />
        <Stat label="Staff" value={data.staff.length} />
      </div>

      <Card tone="white" hover={false} className="mt-4">
        <h2 className="font-display text-lg font-semibold tracking-[-0.02em] text-ink">
          Today's appointments
        </h2>
        {data.today.length === 0 ? (
          <p className="mt-3 text-sm text-charcoal">No appointments are booked for today.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {data.today.map((appointment) => (
              <AppointmentRow
                key={appointment.id}
                appointment={appointment}
                disabled={advance.isPending}
                onAdvance={(appointmentId, status) => advance.mutate({ appointmentId, status })}
              />
            ))}
          </ul>
        )}
        {advance.error && (
          <p role="alert" className="mt-3 text-sm text-red-700">
            {describeError(advance.error)}
          </p>
        )}
      </Card>

      <Card tone="white" hover={false} className="mt-4">
        <h2 className="font-display text-lg font-semibold tracking-[-0.02em] text-ink">Staff</h2>
        {data.staff.length === 0 ? (
          <p className="mt-3 text-sm text-charcoal">No staff are linked to this clinic yet.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {data.staff.map((member) => (
              <li
                key={member.id}
                className="flex items-center justify-between rounded-button border border-steel bg-paper px-4 py-3"
              >
                <span className="text-sm font-semibold text-ink">{member.full_name}</span>
                <Badge variant="neutral">{member.role}</Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </section>
  );
}
