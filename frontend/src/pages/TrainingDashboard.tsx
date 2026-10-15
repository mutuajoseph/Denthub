import { GraduationCap, Pencil, Plus } from "lucide-react";
import { useState } from "react";

import Badge from "../components/ui/Badge";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import { COURSE_FORMATS, type CourseFormat, courseFormatLabel } from "../config/courseConstants";
import { useRegion } from "../hooks/useRegion";
import {
  useCreateCourse,
  useCreateProvider,
  useCreateWebinar,
  useTrainingProviderCourses,
  useTrainingProviderDashboard,
  useTrainingProviderWebinars,
  useUpdateCourse,
  useUpdateWebinar,
} from "../hooks/useTrainingProvider";
import { webinarWhen } from "../lib/trainingApi";
import type {
  CreateCourseInput,
  CreateWebinarInput,
  ProviderCourse,
  ProviderWebinar,
} from "../lib/trainingProviderApi";
import { formatListingPrice } from "../utils/formatCurrency";

const fieldShellClass =
  "flex min-h-[44px] items-center gap-2 rounded-button border border-steel bg-cloud px-3 transition focus-within:border-ink focus-within:ring-2 focus-within:ring-ink/10";
const inputClass =
  "min-w-0 flex-1 border-0 bg-transparent p-0 text-sm text-ink outline-none placeholder:text-slate";
const labelClass = "text-xs font-medium text-charcoal";

/** Parse a CPD-points field, defaulting a blank or malformed entry to 0. */
function parseCpd(value: string): number {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function ErrorText({ message }: { message: string }) {
  return (
    <p className="text-sm text-red-700" role="alert">
      {message}
    </p>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <Card tone="white" hover={false} className="p-5">
      <p className="font-mono text-3xl font-semibold text-ink">{value}</p>
      <p className="mt-1 text-xs font-medium text-slate">{label}</p>
    </Card>
  );
}

/* ------------------------------------------------------------------ *
 * Provider profile — a training provider creates its own record.
 * ------------------------------------------------------------------ */

function ProviderForm() {
  const createProvider = useCreateProvider();
  const { regionCode } = useRegion();
  const country = regionCode === "GLOBAL" ? "KE" : regionCode;

  const [name, setName] = useState("");

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!name.trim()) return;
    createProvider.mutate({ name: name.trim() });
  };

  return (
    <Card tone="white" hover={false} className="p-6">
      <h2 className="font-heading text-xl font-semibold text-ink">Create your provider profile</h2>
      <p className="mt-2 text-sm text-slate">
        Your courses and webinars will be shown in {country}. A DentHub admin verifies new providers
        before they are marked as verified.
      </p>

      <form onSubmit={handleSubmit} className="mt-5 max-w-lg space-y-4">
        <label className="block">
          <span className={labelClass}>Provider name</span>
          <span className={`${fieldShellClass} mt-1`}>
            <input
              className={inputClass}
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Nairobi CPD Collective"
            />
          </span>
        </label>

        {createProvider.isError && <ErrorText message={createProvider.error.message} />}

        <Button type="submit" disabled={createProvider.isPending || !name.trim()}>
          {createProvider.isPending ? "Creating…" : "Create provider"}
        </Button>
      </form>
    </Card>
  );
}

/* ------------------------------------------------------------------ *
 * Course form — create and edit share one body.
 * ------------------------------------------------------------------ */

interface CourseFormProps {
  initial?: ProviderCourse;
  onDone: () => void;
}

function CourseForm({ initial, onDone }: CourseFormProps) {
  const createCourse = useCreateCourse();
  const updateCourse = useUpdateCourse();

  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [deliveryMode, setDeliveryMode] = useState<CourseFormat>(
    initial?.deliveryMode ?? "in_person",
  );
  const [subdivisionCode, setSubdivisionCode] = useState(initial?.subdivisionCode ?? "");
  const [price, setPrice] = useState(initial?.price ?? "");
  const [cpdPoints, setCpdPoints] = useState(initial ? String(initial.cpdPoints) : "");
  const [error, setError] = useState("");

  const pending = createCourse.isPending || updateCourse.isPending;
  const mutationError = createCourse.error ?? updateCourse.error;

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    if (!title.trim() || !description.trim()) {
      setError("A title and description are required.");
      return;
    }

    const payload: CreateCourseInput = {
      title: title.trim(),
      description: description.trim(),
      deliveryMode,
      subdivisionCode: subdivisionCode.trim(),
      price: price.trim() === "" ? null : price.trim(),
      cpdPoints: parseCpd(cpdPoints),
    };

    if (initial) {
      updateCourse.mutate({ courseId: initial.id, changes: payload }, { onSuccess: onDone });
    } else {
      createCourse.mutate(payload, { onSuccess: onDone });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-card bg-cloud p-4">
      <label className="block">
        <span className={labelClass}>Title</span>
        <span className={`${fieldShellClass} mt-1`}>
          <input
            className={inputClass}
            type="text"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Course title"
          />
        </span>
      </label>

      <label className="block">
        <span className={labelClass}>Description</span>
        <span className={`${fieldShellClass} mt-1 items-start py-2`}>
          <textarea
            className={`${inputClass} min-h-[72px] resize-y`}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="What the course covers"
          />
        </span>
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className={labelClass}>Delivery</span>
          <span className={`${fieldShellClass} mt-1`}>
            <select
              className={inputClass}
              value={deliveryMode}
              onChange={(event) => setDeliveryMode(event.target.value as CourseFormat)}
            >
              {COURSE_FORMATS.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </span>
        </label>

        <label className="block">
          <span className={labelClass}>Subdivision code</span>
          <span className={`${fieldShellClass} mt-1`}>
            <input
              className={inputClass}
              type="text"
              value={subdivisionCode}
              onChange={(event) => setSubdivisionCode(event.target.value)}
              placeholder="e.g. NAIROBI"
            />
          </span>
        </label>

        <label className="block">
          <span className={labelClass}>Price (leave blank for free)</span>
          <span className={`${fieldShellClass} mt-1`}>
            <input
              className={inputClass}
              inputMode="decimal"
              value={price}
              onChange={(event) => setPrice(event.target.value)}
              placeholder="e.g. 45000.00"
            />
          </span>
        </label>

        <label className="block">
          <span className={labelClass}>CPD points</span>
          <span className={`${fieldShellClass} mt-1`}>
            <input
              className={inputClass}
              inputMode="numeric"
              value={cpdPoints}
              onChange={(event) => setCpdPoints(event.target.value)}
              placeholder="0"
            />
          </span>
        </label>
      </div>

      {error && <ErrorText message={error} />}
      {mutationError && <ErrorText message={mutationError.message} />}

      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : initial ? "Save changes" : "Create course"}
        </Button>
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

/* ------------------------------------------------------------------ *
 * Webinar form — create and edit share one body.
 * ------------------------------------------------------------------ */

interface WebinarFormProps {
  initial?: ProviderWebinar;
  onDone: () => void;
}

function WebinarForm({ initial, onDone }: WebinarFormProps) {
  const createWebinar = useCreateWebinar();
  const updateWebinar = useUpdateWebinar();

  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [joinUrl, setJoinUrl] = useState(initial?.joinUrl ?? "");
  const [scheduledStart, setScheduledStart] = useState(
    initial ? initial.scheduledStart.slice(0, 16) : "",
  );
  const [cpdPoints, setCpdPoints] = useState(initial ? String(initial.cpdPoints) : "");
  const [error, setError] = useState("");

  const pending = createWebinar.isPending || updateWebinar.isPending;
  const mutationError = createWebinar.error ?? updateWebinar.error;

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    if (!title.trim() || !description.trim() || !joinUrl.trim() || !scheduledStart) {
      setError("A title, description, join link and start time are required.");
      return;
    }

    const payload: CreateWebinarInput = {
      title: title.trim(),
      description: description.trim(),
      joinUrl: joinUrl.trim(),
      scheduledStart,
      cpdPoints: parseCpd(cpdPoints),
    };

    if (initial) {
      updateWebinar.mutate({ webinarId: initial.id, changes: payload }, { onSuccess: onDone });
    } else {
      createWebinar.mutate(payload, { onSuccess: onDone });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-card bg-cloud p-4">
      <label className="block">
        <span className={labelClass}>Title</span>
        <span className={`${fieldShellClass} mt-1`}>
          <input
            className={inputClass}
            type="text"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Webinar title"
          />
        </span>
      </label>

      <label className="block">
        <span className={labelClass}>Description</span>
        <span className={`${fieldShellClass} mt-1 items-start py-2`}>
          <textarea
            className={`${inputClass} min-h-[72px] resize-y`}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="What the session covers"
          />
        </span>
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className={labelClass}>Join link</span>
          <span className={`${fieldShellClass} mt-1`}>
            <input
              className={inputClass}
              type="url"
              value={joinUrl}
              onChange={(event) => setJoinUrl(event.target.value)}
              placeholder="https://…"
            />
          </span>
        </label>

        <label className="block">
          <span className={labelClass}>Starts</span>
          <span className={`${fieldShellClass} mt-1`}>
            <input
              className={inputClass}
              type="datetime-local"
              value={scheduledStart}
              onChange={(event) => setScheduledStart(event.target.value)}
            />
          </span>
        </label>

        <label className="block">
          <span className={labelClass}>CPD points</span>
          <span className={`${fieldShellClass} mt-1`}>
            <input
              className={inputClass}
              inputMode="numeric"
              value={cpdPoints}
              onChange={(event) => setCpdPoints(event.target.value)}
              placeholder="0"
            />
          </span>
        </label>
      </div>

      {error && <ErrorText message={error} />}
      {mutationError && <ErrorText message={mutationError.message} />}

      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : initial ? "Save changes" : "Create webinar"}
        </Button>
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

/* ------------------------------------------------------------------ *
 * Rows
 * ------------------------------------------------------------------ */

function CourseRow({
  course,
  onEdit,
}: {
  course: ProviderCourse;
  onEdit: () => void;
}) {
  const { locale } = useRegion();
  const price = formatListingPrice(course.price, course.currency ?? "", locale);

  return (
    <Card tone="white" className="flex items-start justify-between gap-4 p-4">
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-ink">{course.title}</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Badge variant="neutral">{courseFormatLabel(course.deliveryMode)}</Badge>
          <Badge variant="ink">{course.cpdPoints} CPD</Badge>
          <span className="font-mono text-xs text-slate">{price ?? "Free"}</span>
        </div>
      </div>
      <Button variant="ghost" size="sm" icon={Pencil} onClick={onEdit}>
        Edit
      </Button>
    </Card>
  );
}

function WebinarRow({
  webinar,
  onEdit,
}: {
  webinar: ProviderWebinar;
  onEdit: () => void;
}) {
  return (
    <Card tone="white" className="flex items-start justify-between gap-4 p-4">
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-ink">{webinar.title}</p>
        <p className="mt-1 text-xs text-slate">{webinarWhen(webinar.scheduledStart)}</p>
        <div className="mt-2">
          <Badge variant="ink">{webinar.cpdPoints} CPD</Badge>
        </div>
      </div>
      <Button variant="ghost" size="sm" icon={Pencil} onClick={onEdit}>
        Edit
      </Button>
    </Card>
  );
}

function SectionState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="rounded-card bg-cloud p-6 text-center" role="alert">
      <p className="text-sm text-slate">{message}</p>
      <Button variant="secondary" className="mt-3" onClick={onRetry}>
        Try again
      </Button>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Page
 * ------------------------------------------------------------------ */

export function TrainingDashboard() {
  const { provider, stats, isLoading, isError, error, refetch } = useTrainingProviderDashboard();
  const hasProvider = provider !== null;

  const courses = useTrainingProviderCourses(undefined, { enabled: hasProvider });
  const webinars = useTrainingProviderWebinars(undefined, { enabled: hasProvider });

  const [showCourseForm, setShowCourseForm] = useState(false);
  const [editingCourseId, setEditingCourseId] = useState<string | null>(null);
  const [showWebinarForm, setShowWebinarForm] = useState(false);
  const [editingWebinarId, setEditingWebinarId] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="app-container py-16 text-center" aria-busy="true">
        <p className="font-heading text-lg font-semibold text-ink">Loading your dashboard…</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="app-container py-16">
        <SectionState
          message={error?.message ?? "Could not load your dashboard."}
          onRetry={() => void refetch()}
        />
      </div>
    );
  }

  return (
    <div className="app-container py-8 lg:py-12">
      <header className="mb-6 flex flex-wrap items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cloud text-graphite">
          <GraduationCap className="h-5 w-5" aria-hidden="true" />
        </span>
        <h1 className="font-heading text-3xl font-bold text-ink">
          {provider ? provider.name : "Training dashboard"}
        </h1>
        {provider &&
          (provider.isVerified ? (
            <Badge variant="success">Verified</Badge>
          ) : (
            <Badge variant="neutral">Pending verification</Badge>
          ))}
      </header>

      {!provider ? (
        <ProviderForm />
      ) : (
        <div className="space-y-10">
          {stats && (
            <section
              aria-label="Provider statistics"
              className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
            >
              <StatCard label="Courses" value={stats.courseCount} />
              <StatCard label="Webinars" value={stats.webinarCount} />
              <StatCard label="Upcoming webinars" value={stats.upcomingWebinarCount} />
              <StatCard label="Total CPD points" value={stats.totalCpdPoints} />
            </section>
          )}

          <section aria-labelledby="dashboard-courses-heading">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2
                id="dashboard-courses-heading"
                className="font-heading text-xl font-semibold text-ink"
              >
                Courses
              </h2>
              {!showCourseForm && (
                <Button
                  variant="secondary"
                  size="sm"
                  icon={Plus}
                  onClick={() => {
                    setEditingCourseId(null);
                    setShowCourseForm(true);
                  }}
                >
                  Add course
                </Button>
              )}
            </div>

            {showCourseForm && (
              <div className="mb-4">
                <CourseForm
                  onDone={() => {
                    setShowCourseForm(false);
                    setEditingCourseId(null);
                  }}
                />
              </div>
            )}

            {courses.isLoading ? (
              <p className="py-6 text-sm text-slate" aria-busy="true">
                Loading courses…
              </p>
            ) : courses.isError ? (
              <SectionState
                message={courses.error?.message ?? "Could not load your courses."}
                onRetry={() => void courses.refetch()}
              />
            ) : courses.courses.length === 0 ? (
              <p className="rounded-card bg-cloud p-6 text-center text-sm text-slate">
                No courses yet. Add your first course to appear in the training catalogue.
              </p>
            ) : (
              <ul className="space-y-3">
                {courses.courses.map((course) =>
                  editingCourseId === course.id ? (
                    <li key={course.id}>
                      <CourseForm initial={course} onDone={() => setEditingCourseId(null)} />
                    </li>
                  ) : (
                    <li key={course.id}>
                      <CourseRow course={course} onEdit={() => setEditingCourseId(course.id)} />
                    </li>
                  ),
                )}
              </ul>
            )}
          </section>

          <section aria-labelledby="dashboard-webinars-heading">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2
                id="dashboard-webinars-heading"
                className="font-heading text-xl font-semibold text-ink"
              >
                Webinars
              </h2>
              {!showWebinarForm && (
                <Button
                  variant="secondary"
                  size="sm"
                  icon={Plus}
                  onClick={() => {
                    setEditingWebinarId(null);
                    setShowWebinarForm(true);
                  }}
                >
                  Add webinar
                </Button>
              )}
            </div>

            {showWebinarForm && (
              <div className="mb-4">
                <WebinarForm
                  onDone={() => {
                    setShowWebinarForm(false);
                    setEditingWebinarId(null);
                  }}
                />
              </div>
            )}

            {webinars.isLoading ? (
              <p className="py-6 text-sm text-slate" aria-busy="true">
                Loading webinars…
              </p>
            ) : webinars.isError ? (
              <SectionState
                message={webinars.error?.message ?? "Could not load your webinars."}
                onRetry={() => void webinars.refetch()}
              />
            ) : webinars.webinars.length === 0 ? (
              <p className="rounded-card bg-cloud p-6 text-center text-sm text-slate">
                No webinars yet. Add your first webinar to appear in the catalogue.
              </p>
            ) : (
              <ul className="space-y-3">
                {webinars.webinars.map((webinar) =>
                  editingWebinarId === webinar.id ? (
                    <li key={webinar.id}>
                      <WebinarForm initial={webinar} onDone={() => setEditingWebinarId(null)} />
                    </li>
                  ) : (
                    <li key={webinar.id}>
                      <WebinarRow
                        webinar={webinar}
                        onEdit={() => setEditingWebinarId(webinar.id)}
                      />
                    </li>
                  ),
                )}
              </ul>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
