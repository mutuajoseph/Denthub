import { CalendarDays, CheckCircle2, RotateCcw, X } from "lucide-react";
import { type FormEvent, useId, useState } from "react";
import type { DentistListing } from "../../lib/dentistFixtures";
import Button from "../ui/Button";

export interface AppointmentRequestPreviewProps {
  listing: DentistListing;
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
  "mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 dark:border-navy-600 dark:bg-navy-900 dark:text-white";

export function AppointmentRequestPreview({ listing }: AppointmentRequestPreviewProps) {
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
      <div className="rounded-2xl border border-orange-200 bg-orange-50 p-5 dark:border-gold-400/30 dark:bg-navy-800">
        <h2 className="font-heading text-lg font-semibold text-slate-900 dark:text-white">
          Plan your next visit
        </h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-gray-300">
          Build an appointment message for {listing.name} and review it before contacting the
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
      className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_14px_40px_rgba(15,23,42,0.06)] sm:p-6 dark:border-navy-600 dark:bg-navy-800"
      aria-labelledby={headingId}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-orange-600 dark:text-gold-300">
            Frontend preview
          </p>
          <h2
            id={headingId}
            className="mt-1 font-heading text-xl font-semibold text-slate-900 dark:text-white"
          >
            Appointment request preview
          </h2>
        </div>
        <button
          type="button"
          onClick={reset}
          aria-label="Close appointment request preview"
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:text-gray-300 dark:hover:bg-navy-700 dark:hover:text-white"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>

      <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-950 dark:border-gold-400/30 dark:bg-gold-400/10 dark:text-gold-300">
        Preview only. Nothing is sent or saved, and no appointment is reserved.
      </p>

      {preview ? (
        <output className="mt-5 block" aria-live="polite">
          <div className="flex items-start gap-3 rounded-xl bg-green-50 p-4 text-green-950 dark:bg-green-500/10 dark:text-green-300">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
            <div>
              <h3 className="font-heading font-semibold">
                Preview ready — nothing was sent or saved.
              </h3>
              <p className="mt-1 text-sm">
                Use this summary to contact {listing.name} directly if the details are correct.
              </p>
            </div>
          </div>
          <dl className="mt-5 divide-y divide-slate-200 rounded-xl border border-slate-200 dark:divide-navy-600 dark:border-navy-600">
            <div className="grid gap-1 p-4 sm:grid-cols-[9rem_1fr]">
              <dt className="text-sm font-medium text-slate-500 dark:text-gray-400">Patient</dt>
              <dd className="text-sm text-slate-900 dark:text-white">{preview.patientName}</dd>
            </div>
            <div className="grid gap-1 p-4 sm:grid-cols-[9rem_1fr]">
              <dt className="text-sm font-medium text-slate-500 dark:text-gray-400">Email</dt>
              <dd className="text-sm break-words text-slate-900 dark:text-white">
                {preview.email}
              </dd>
            </div>
            <div className="grid gap-1 p-4 sm:grid-cols-[9rem_1fr]">
              <dt className="text-sm font-medium text-slate-500 dark:text-gray-400">
                Preferred date
              </dt>
              <dd className="text-sm text-slate-900 dark:text-white">{preview.preferredDate}</dd>
            </div>
            {preview.note && (
              <div className="grid gap-1 p-4 sm:grid-cols-[9rem_1fr]">
                <dt className="text-sm font-medium text-slate-500 dark:text-gray-400">Note</dt>
                <dd className="text-sm whitespace-pre-wrap text-slate-900 dark:text-white">
                  {preview.note}
                </dd>
              </div>
            )}
          </dl>
          <div className="mt-5 flex flex-wrap gap-3">
            <a
              href={`tel:${listing.contact.phone}`}
              className="inline-flex min-h-11 items-center justify-center rounded-lg bg-red-600 px-5 py-2.5 font-heading text-sm font-semibold text-white transition hover:bg-red-700"
            >
              Call to request appointment
            </a>
            <Button variant="secondary" icon={RotateCcw} onClick={() => setPreview(null)}>
              Edit preview
            </Button>
          </div>
        </output>
      ) : (
        <form className="mt-5 grid gap-4 sm:grid-cols-2" onSubmit={handleSubmit}>
          <div className="sm:col-span-2">
            <label
              htmlFor={`${headingId}-name`}
              className="text-sm font-medium text-slate-700 dark:text-gray-300"
            >
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
            <label
              htmlFor={`${headingId}-email`}
              className="text-sm font-medium text-slate-700 dark:text-gray-300"
            >
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
            <label
              htmlFor={`${headingId}-date`}
              className="text-sm font-medium text-slate-700 dark:text-gray-300"
            >
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
            <label
              htmlFor={`${headingId}-note`}
              className="text-sm font-medium text-slate-700 dark:text-gray-300"
            >
              Note to the provider <span className="font-normal text-slate-400">(optional)</span>
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
