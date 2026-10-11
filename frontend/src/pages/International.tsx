import {
  ArrowRight,
  BadgeCheck,
  ClipboardList,
  MessageCircle,
  Plane,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { type FormEvent, useId, useState } from "react";
import Button from "../components/ui/Button";

interface InternationalLead {
  treatment: string;
  country: string;
  email: string;
  travelWindow: string;
  currency: string;
  goals: string;
}

type LeadField = keyof InternationalLead;

const EMPTY_LEAD: InternationalLead = {
  treatment: "",
  country: "",
  email: "",
  travelWindow: "Next 3 months",
  currency: "GBP",
  goals: "",
};

const FIELD_LABELS: Record<LeadField, string> = {
  treatment: "Choose a treatment interest",
  country: "Enter your country of residence",
  email: "Enter a valid email address",
  travelWindow: "Choose a travel window",
  currency: "Choose a quote currency",
  goals: "Tell us briefly about your treatment goals",
};

function validateLead(lead: InternationalLead): Partial<Record<LeadField, string>> {
  const errors: Partial<Record<LeadField, string>> = {};
  if (!lead.treatment) errors.treatment = FIELD_LABELS.treatment;
  if (!lead.country.trim()) errors.country = FIELD_LABELS.country;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(lead.email.trim())) errors.email = FIELD_LABELS.email;
  if (!lead.travelWindow) errors.travelWindow = FIELD_LABELS.travelWindow;
  if (!lead.currency) errors.currency = FIELD_LABELS.currency;
  if (lead.goals.trim().length < 20) errors.goals = FIELD_LABELS.goals;
  return errors;
}

const inputClass =
  "mt-1.5 w-full rounded-button border border-steel bg-paper px-3.5 py-2.5 text-sm text-ink outline-none transition focus:border-ink focus:ring-2 focus:ring-ink/20";
const labelClass = "text-sm font-medium text-charcoal";

const JOURNEY_STEPS = [
  {
    icon: ClipboardList,
    title: "Share your goals",
    copy: "Describe the treatment you are considering.",
  },
  {
    icon: BadgeCheck,
    title: "Review specialists",
    copy: "Compare specialties, locations, and fees.",
  },
  {
    icon: MessageCircle,
    title: "Request consultation",
    copy: "Arrange a teleconsultation and written quote.",
  },
  {
    icon: Plane,
    title: "Plan your visit",
    copy: "Confirm timing, travel, payment, and documents.",
  },
  {
    icon: ShieldCheck,
    title: "Receive care",
    copy: "Follow the provider's local care and aftercare plan.",
  },
];

const BENEFITS = [
  {
    icon: BadgeCheck,
    title: "Verified listings",
    copy: "Review credentials and provider status.",
  },
  {
    icon: ClipboardList,
    title: "Written scope",
    copy: "Compare proposed treatment and fees.",
  },
  {
    icon: Sparkles,
    title: "Travel readiness",
    copy: "Plan timing, documents, and aftercare.",
  },
];

export function International() {
  const formId = useId();
  const [lead, setLead] = useState<InternationalLead>({ ...EMPTY_LEAD });
  const [errors, setErrors] = useState<Partial<Record<LeadField, string>>>({});
  const [submittedLead, setSubmittedLead] = useState<InternationalLead | null>(null);

  function updateField(field: LeadField, value: string): void {
    setLead((current) => ({ ...current, [field]: value }));
    setSubmittedLead(null);
    setErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const nextErrors = validateLead(lead);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    setSubmittedLead(lead);
  }

  function reset(): void {
    setLead({ ...EMPTY_LEAD });
    setErrors({});
    setSubmittedLead(null);
  }

  return (
    <div className="bg-paper">
      <section className="border-b border-steel py-16 sm:py-20 lg:py-24">
        <div className="app-container">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="font-display text-4xl font-medium tracking-[-0.04em] text-ink sm:text-5xl lg:text-display-section">
              Plan your dental journey with clear next steps
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-slate">
              Share your treatment goals, review qualified specialists, and prepare for a
              teleconsultation and written quote before you travel.
            </p>
            <a
              href="#quote-request"
              className="mt-8 inline-flex min-h-12 items-center justify-center gap-2 rounded-card bg-aqua-relay py-3 pr-4 pl-[22px] text-sm font-medium text-ink transition-colors hover:bg-aqua-relay-deep"
            >
              Start a quote request
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </a>
          </div>
        </div>
      </section>

      <section className="app-container py-12 sm:py-16" aria-labelledby="journey-heading">
        <div className="mx-auto max-w-2xl text-center">
          <h2
            id="journey-heading"
            className="font-display text-3xl font-medium tracking-[-0.03em] text-ink"
          >
            Your treatment journey
          </h2>
          <p className="mt-3 text-slate">
            Use the process below to compare options and prepare questions for your care team.
          </p>
        </div>
        <ol className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {JOURNEY_STEPS.map((step, index) => (
            <li
              key={step.title}
              className="relative rounded-card border border-steel bg-paper p-5 shadow-card-white"
            >
              <span className="absolute top-4 right-4 font-mono text-xs font-semibold text-slate">
                0{index + 1}
              </span>
              <step.icon className="h-7 w-7 text-charcoal" aria-hidden="true" />
              <h3 className="mt-4 font-heading font-semibold text-ink">{step.title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate">{step.copy}</p>
            </li>
          ))}
        </ol>
      </section>

      <section
        className="bg-ink py-12 text-paper sm:py-16"
        aria-labelledby="international-benefits-heading"
      >
        <div className="app-container">
          <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
            <div>
              <h2
                id="international-benefits-heading"
                className="font-display text-3xl font-medium tracking-[-0.03em]"
              >
                Questions before commitments
              </h2>
              <p className="mt-4 leading-7 text-white/70">
                International care involves clinical, financial, and travel decisions. A quote is an
                estimate, not a diagnosis or a guarantee. Confirm the treatment plan and total costs
                directly with the licensed provider.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              {BENEFITS.map((benefit) => (
                <div key={benefit.title} className="rounded-card bg-graphite p-5 shadow-edge">
                  <benefit.icon className="h-6 w-6 text-paper" aria-hidden="true" />
                  <h3 className="mt-4 font-heading font-semibold">{benefit.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-white/60">{benefit.copy}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section
        id="quote-request"
        className="app-container py-12 sm:py-16"
        aria-labelledby="quote-form-heading"
      >
        <div className="mx-auto max-w-3xl">
          {submittedLead ? (
            <output
              className="block rounded-card border border-steel bg-paper p-7 shadow-card-white sm:p-9"
              aria-live="polite"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-card bg-cloud text-charcoal">
                <BadgeCheck className="h-7 w-7" aria-hidden="true" />
              </div>
              <h2
                id="quote-form-heading"
                className="mt-5 font-display text-3xl font-medium tracking-[-0.03em] text-ink"
              >
                Your request is ready to review
              </h2>
              <p className="mt-3 leading-7 text-slate">
                No details were sent or saved, and no DentHub team has been notified. This frontend
                preview does not reserve a consultation or create a lead record.
              </p>
              <dl className="mt-6 divide-y divide-steel rounded-button border border-steel">
                <div className="grid gap-1 p-4 sm:grid-cols-[10rem_1fr]">
                  <dt className="text-sm font-medium text-slate">Treatment</dt>
                  <dd className="text-sm text-ink">{submittedLead.treatment}</dd>
                </div>
                <div className="grid gap-1 p-4 sm:grid-cols-[10rem_1fr]">
                  <dt className="text-sm font-medium text-slate">Residence</dt>
                  <dd className="text-sm text-ink">{submittedLead.country}</dd>
                </div>
                <div className="grid gap-1 p-4 sm:grid-cols-[10rem_1fr]">
                  <dt className="text-sm font-medium text-slate">Email</dt>
                  <dd className="text-sm break-words text-ink">{submittedLead.email}</dd>
                </div>
                <div className="grid gap-1 p-4 sm:grid-cols-[10rem_1fr]">
                  <dt className="text-sm font-medium text-slate">Goals</dt>
                  <dd className="text-sm whitespace-pre-wrap text-ink">{submittedLead.goals}</dd>
                </div>
              </dl>
              <div className="mt-6 flex flex-wrap gap-3">
                <Button variant="secondary" onClick={reset}>
                  Start another preview
                </Button>
                <Button to="/find-dentist" variant="secondary" icon={ArrowRight}>
                  Browse providers
                </Button>
              </div>
            </output>
          ) : (
            <div className="rounded-card border border-steel bg-paper p-6 shadow-card-white sm:p-9">
              <div className="text-center">
                <h2
                  id="quote-form-heading"
                  className="font-display text-3xl font-medium tracking-[-0.03em] text-ink"
                >
                  Tell us what you are considering
                </h2>
                <p className="mx-auto mt-3 max-w-xl leading-7 text-slate">
                  Share only the information needed to understand your treatment goals. Do not
                  upload medical records in this preview.
                </p>
              </div>

              <p className="mt-6 rounded-button border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
                This form validates details in your browser only. It does not send, save, or create
                an international-patient lead.
              </p>

              {Object.keys(errors).length > 0 && (
                <div
                  className="mt-5 rounded-button border border-red-200 bg-red-50 p-4 text-sm text-red-900"
                  role="alert"
                >
                  <p className="font-semibold">Check the highlighted fields:</p>
                  <ul className="mt-2 list-disc space-y-1 pl-5">
                    {(["treatment", "country", "email", "goals"] as const).map((field) =>
                      errors[field] ? <li key={field}>{errors[field]}</li> : null,
                    )}
                  </ul>
                </div>
              )}

              <form className="mt-6 grid gap-5 sm:grid-cols-2" noValidate onSubmit={handleSubmit}>
                <div>
                  <label htmlFor={`${formId}-treatment`} className={labelClass}>
                    Treatment interest
                  </label>
                  <select
                    id={`${formId}-treatment`}
                    value={lead.treatment}
                    onChange={(event) => updateField("treatment", event.currentTarget.value)}
                    aria-invalid={Boolean(errors.treatment)}
                    aria-describedby={errors.treatment ? `${formId}-treatment-error` : undefined}
                    className={inputClass}
                  >
                    <option value="">Select a treatment</option>
                    <option>Dental implants</option>
                    <option>Root canal treatment</option>
                    <option>Veneers</option>
                    <option>Full-mouth restoration</option>
                    <option>Orthodontic consultation</option>
                    <option>Other</option>
                  </select>
                  {errors.treatment && (
                    <p
                      id={`${formId}-treatment-error`}
                      className="mt-1.5 text-xs font-medium text-red-700"
                    >
                      {errors.treatment}
                    </p>
                  )}
                </div>

                <div>
                  <label htmlFor={`${formId}-country`} className={labelClass}>
                    Country of residence
                  </label>
                  <input
                    id={`${formId}-country`}
                    type="text"
                    autoComplete="country-name"
                    value={lead.country}
                    onChange={(event) => updateField("country", event.currentTarget.value)}
                    aria-invalid={Boolean(errors.country)}
                    aria-describedby={errors.country ? `${formId}-country-error` : undefined}
                    placeholder="e.g. United Kingdom"
                    className={inputClass}
                  />
                  {errors.country && (
                    <p
                      id={`${formId}-country-error`}
                      className="mt-1.5 text-xs font-medium text-red-700"
                    >
                      {errors.country}
                    </p>
                  )}
                </div>

                <div>
                  <label htmlFor={`${formId}-email`} className={labelClass}>
                    Email address
                  </label>
                  <input
                    id={`${formId}-email`}
                    type="email"
                    autoComplete="email"
                    value={lead.email}
                    onChange={(event) => updateField("email", event.currentTarget.value)}
                    aria-invalid={Boolean(errors.email)}
                    aria-describedby={errors.email ? `${formId}-email-error` : undefined}
                    placeholder="you@example.com"
                    className={inputClass}
                  />
                  {errors.email && (
                    <p
                      id={`${formId}-email-error`}
                      className="mt-1.5 text-xs font-medium text-red-700"
                    >
                      {errors.email}
                    </p>
                  )}
                </div>

                <div>
                  <label htmlFor={`${formId}-travel-window`} className={labelClass}>
                    Preferred travel window
                  </label>
                  <select
                    id={`${formId}-travel-window`}
                    value={lead.travelWindow}
                    onChange={(event) => updateField("travelWindow", event.currentTarget.value)}
                    aria-invalid={Boolean(errors.travelWindow)}
                    aria-describedby={
                      errors.travelWindow ? `${formId}-travel-window-error` : undefined
                    }
                    className={inputClass}
                  >
                    <option>Next 3 months</option>
                    <option>3–6 months</option>
                    <option>6–12 months</option>
                    <option>Flexible</option>
                  </select>
                </div>

                <div>
                  <label htmlFor={`${formId}-currency`} className={labelClass}>
                    Preferred quote currency
                  </label>
                  <select
                    id={`${formId}-currency`}
                    value={lead.currency}
                    onChange={(event) => updateField("currency", event.currentTarget.value)}
                    aria-invalid={Boolean(errors.currency)}
                    aria-describedby={errors.currency ? `${formId}-currency-error` : undefined}
                    className={inputClass}
                  >
                    <option>GBP</option>
                    <option>USD</option>
                    <option>EUR</option>
                    <option>KES</option>
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label htmlFor={`${formId}-goals`} className={labelClass}>
                    Treatment goals
                  </label>
                  <textarea
                    id={`${formId}-goals`}
                    rows={5}
                    value={lead.goals}
                    onChange={(event) => updateField("goals", event.currentTarget.value)}
                    aria-invalid={Boolean(errors.goals)}
                    aria-describedby={
                      errors.goals ? `${formId}-goals-error` : `${formId}-goals-hint`
                    }
                    placeholder="Briefly describe the treatment you are considering and any scheduling questions."
                    className={`${inputClass} resize-y`}
                  />
                  {errors.goals ? (
                    <p
                      id={`${formId}-goals-error`}
                      className="mt-1.5 text-xs font-medium text-red-700"
                    >
                      {errors.goals}
                    </p>
                  ) : (
                    <p id={`${formId}-goals-hint`} className="mt-1.5 text-xs text-slate">
                      Please do not include sensitive medical details.
                    </p>
                  )}
                </div>

                <div className="sm:col-span-2">
                  <Button
                    type="submit"
                    variant="graphite"
                    className="w-full sm:w-auto"
                    icon={ArrowRight}
                  >
                    Preview my quote request
                  </Button>
                  <p className="mt-3 text-xs text-slate">No account is needed for this preview.</p>
                </div>
              </form>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
