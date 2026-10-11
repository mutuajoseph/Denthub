import { CalendarDays, CheckCircle2, RotateCcw, X } from "lucide-react";
import { type FormEvent, useId, useState } from "react";
import Button from "../ui/Button";

/** Who the preview is addressed to: a listing's card name and published phone. */
export interface AppointmentProvider {
  name: string;
  phone: string | null;
}

export interface AppointmentRequestPreviewProps {
  provider: AppointmentProvider;
}

interface AppointmentPreview {
  patientName: string;
  email: string;
  preferredDate: string;
  note: string;
}

const EMPTY_PREVIEW: AppointmentPreview = {
  patientName: "",
  email: "",
  preferredDate: "",
  note: "",
};

const fieldClass =
  "mt-1.5 w-full rounded-button border border-steel bg-paper px-3.5 py-2.5 text-sm text-ink outline-none transition focus:border-ink focus:ring-2 focus:ring-ink/20";
const labelClass = "text-sm font-medium text-charcoal";

export function AppointmentRequestPreview({ provider }: AppointmentRequestPreviewProps) {
  const headingId = useId();
  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState<AppointmentPreview>(EMPTY_PREVIEW);
  const [preview, setPreview] = useState<AppointmentPreview | null>(null);

  function updateField(field: keyof AppointmentPreview, value: string): void {
    setForm((current) => ({ ...current, [field]: value }));
    setPreview(null);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    setPreview(form);
  }

  function reset(): void {
    setForm(EMPTY_PREVIEW);
    setPreview(null);
    setIsOpen(false);
  }

  if (!isOpen) {
    return (
      <div className="rounded-card border border-steel bg-cloud p-5">
        <h2 className="font-heading text-lg font-semibold text-ink">Plan your next visit</h2>
        <p className="mt-2 text-sm text-charcoal">
          Build an appointment message for {provider.name} and review it before contacting the
          provider.
        </p>
        <Button className="mt-4" icon={CalendarDays} onClick={() => setIsOpen(true)}>
          Preview appointment request
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
          Appointment request preview
        </h2>
        <button
          type="button"
          onClick={reset}
          aria-label="Close appointment request preview"
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-button text-slate transition hover:bg-cloud hover:text-ink"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>

      <p className="mt-3 rounded-button border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-950">
        Preview only. Nothing is sent or saved, and no appointment is reserved.
      </p>

      {preview ? (
        <output className="mt-5 block" aria-live="polite">
          <div className="flex items-start gap-3 rounded-button bg-green-50 p-4 text-green-950">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
            <div>
              <h3 className="font-heading font-semibold">
                Preview ready — nothing was sent or saved.
              </h3>
              <p className="mt-1 text-sm">
                Use this summary to contact {provider.name} directly if the details are correct.
              </p>
            </div>
          </div>
          <dl className="mt-5 divide-y divide-steel rounded-button border border-steel">
            <div className="grid gap-1 p-4 sm:grid-cols-[9rem_1fr]">
              <dt className="text-sm font-medium text-slate">Patient</dt>
              <dd className="text-sm text-ink">{preview.patientName}</dd>
            </div>
            <div className="grid gap-1 p-4 sm:grid-cols-[9rem_1fr]">
              <dt className="text-sm font-medium text-slate">Email</dt>
              <dd className="text-sm break-words text-ink">{preview.email}</dd>
            </div>
            <div className="grid gap-1 p-4 sm:grid-cols-[9rem_1fr]">
              <dt className="text-sm font-medium text-slate">Preferred date</dt>
              <dd className="text-sm text-ink">{preview.preferredDate}</dd>
            </div>
            {preview.note && (
              <div className="grid gap-1 p-4 sm:grid-cols-[9rem_1fr]">
                <dt className="text-sm font-medium text-slate">Note</dt>
                <dd className="text-sm whitespace-pre-wrap text-ink">{preview.note}</dd>
              </div>
            )}
          </dl>
          <div className="mt-5 flex flex-wrap gap-3">
            {provider.phone && (
              <a
                href={`tel:${provider.phone}`}
                className="inline-flex min-h-11 items-center justify-center rounded-button bg-ink px-5 py-2.5 font-heading text-sm font-semibold text-paper transition hover:bg-graphite"
              >
                Call to request appointment
              </a>
            )}
            <Button variant="secondary" icon={RotateCcw} onClick={() => setPreview(null)}>
              Edit preview
            </Button>
          </div>
        </output>
      ) : (
        <form className="mt-5 grid gap-4 sm:grid-cols-2" onSubmit={handleSubmit}>
          <div className="sm:col-span-2">
            <label htmlFor={`${headingId}-name`} className={labelClass}>
              Patient name
            </label>
            <input
              id={`${headingId}-name`}
              required
              autoComplete="name"
              value={form.patientName}
              onChange={(event) => updateField("patientName", event.currentTarget.value)}
              className={fieldClass}
            />
          </div>
          <div>
            <label htmlFor={`${headingId}-email`} className={labelClass}>
              Email address
            </label>
            <input
              id={`${headingId}-email`}
              type="email"
              required
              autoComplete="email"
              value={form.email}
              onChange={(event) => updateField("email", event.currentTarget.value)}
              className={fieldClass}
            />
          </div>
          <div>
            <label htmlFor={`${headingId}-date`} className={labelClass}>
              Preferred date
            </label>
            <input
              id={`${headingId}-date`}
              type="date"
              required
              value={form.preferredDate}
              onChange={(event) => updateField("preferredDate", event.currentTarget.value)}
              className={fieldClass}
            />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor={`${headingId}-note`} className={labelClass}>
              Note to the provider <span className="font-normal text-slate">(optional)</span>
            </label>
            <textarea
              id={`${headingId}-note`}
              rows={3}
              value={form.note}
              onChange={(event) => updateField("note", event.currentTarget.value)}
              placeholder="Add scheduling preferences or a question"
              className={`${fieldClass} resize-y`}
            />
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" className="w-full sm:w-auto">
              Preview request
            </Button>
          </div>
        </form>
      )}
    </section>
  );
}
