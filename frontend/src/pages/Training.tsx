import { GraduationCap } from "lucide-react";
import { useState } from "react";

import { CourseCard } from "../components/training/CourseCard";
import Badge from "../components/ui/Badge";
import Button from "../components/ui/Button";
import { COURSE_FORMATS, TRAINING_PAGE_LIMIT } from "../config/courseConstants";
import { useRegion } from "../hooks/useRegion";
import { useTrainingCourses, useTrainingWebinars } from "../hooks/useTraining";
import { webinarWhen } from "../lib/trainingApi";
import { useSiteContentStore } from "../store/siteContentStore";

function SectionState({
  heading,
  message,
  onRetry,
}: {
  heading: string;
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="py-14 text-center" role="alert">
      <p className="font-heading text-lg font-semibold text-ink">{heading}</p>
      <p className="mt-2 text-sm text-slate">{message}</p>
      {onRetry && (
        <Button variant="secondary" className="mt-4" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

export function Training() {
  const { title, subtitle } = useSiteContentStore((s) => s.training);
  const { regionCode, locale } = useRegion();
  const country = regionCode === "GLOBAL" ? "KE" : regionCode;

  const [format, setFormat] = useState<string>("all");
  const [archive, setArchive] = useState(false);

  const courses = useTrainingCourses({
    country,
    deliveryMode: format === "all" ? undefined : (format as "in_person" | "online" | "blended"),
    limit: TRAINING_PAGE_LIMIT,
  });
  const webinars = useTrainingWebinars({
    country,
    upcoming: archive ? "past" : "upcoming",
    limit: TRAINING_PAGE_LIMIT,
  });

  const toggleFormat = (id: string) => setFormat(format === id ? "all" : id);

  return (
    <div className="app-container py-8 lg:py-12">
      <header className="mb-6">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cloud text-graphite">
            <GraduationCap className="h-5 w-5" aria-hidden="true" />
          </span>
          <h1 className="font-heading text-3xl font-bold text-ink">{title}</h1>
        </div>
        <p className="mt-2 text-slate">{subtitle}</p>
      </header>

      <section className="mb-12" aria-labelledby="training-webinars-heading">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <h2
            id="training-webinars-heading"
            className="font-heading text-xl font-semibold text-ink"
          >
            Upcoming Live Webinars
          </h2>
          <div className="flex gap-1 rounded-full bg-cloud p-0.5">
            <button
              type="button"
              aria-pressed={!archive}
              onClick={() => setArchive(false)}
              className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
                archive ? "text-slate" : "bg-paper text-ink shadow-card-white"
              }`}
            >
              Upcoming
            </button>
            <button
              type="button"
              aria-pressed={archive}
              onClick={() => setArchive(true)}
              className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
                archive ? "bg-paper text-ink shadow-card-white" : "text-slate"
              }`}
            >
              Archive
            </button>
          </div>
        </div>

        {webinars.isLoading && webinars.webinars.length === 0 ? (
          <div className="py-14 text-center" aria-busy="true">
            <p className="font-heading text-lg font-semibold text-ink">Loading webinars…</p>
          </div>
        ) : webinars.error && webinars.webinars.length === 0 ? (
          <SectionState
            heading="Could not load the training catalogue."
            message={webinars.error.message}
            onRetry={() => void webinars.refetch()}
          />
        ) : webinars.webinars.length > 0 ? (
          <ul className="flex gap-4 overflow-x-auto pb-2">
            {webinars.webinars.map((webinar) => (
              <li
                key={webinar.id}
                className="w-64 shrink-0 rounded-xl border border-cloud bg-paper p-4 shadow-card-white"
              >
                <p className="text-sm font-semibold text-ink">{webinar.title}</p>
                <p className="mt-2 text-xs text-slate">{webinarWhen(webinar.scheduledStart)}</p>
                <p className="mt-1 text-xs text-graphite">{webinar.providerName}</p>
                <p className="mt-3 line-clamp-2 text-xs text-slate">{webinar.description}</p>
                <div className="mt-3 flex items-center justify-between">
                  <Badge variant="neutral">Live</Badge>
                  {webinar.providerVerified && <Badge variant="success">Verified</Badge>}
                </div>
                <a
                  href={webinar.joinUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-flex text-sm font-semibold text-ink underline underline-offset-2"
                >
                  Join registration
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <SectionState
            heading={archive ? "No recorded webinars yet." : "No upcoming webinars right now."}
            message={
              archive
                ? "Recordings will appear here once a past webinar is posted."
                : "Check the archive for a past session, or come back later."
            }
          />
        )}
      </section>

      <section aria-labelledby="training-courses-heading">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <h2 id="training-courses-heading" className="font-heading text-xl font-semibold text-ink">
            Courses &amp; Certifications
          </h2>
        </div>

        <div className="mb-6 flex flex-wrap gap-2">
          <button
            type="button"
            aria-pressed={format === "all"}
            onClick={() => setFormat("all")}
            className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              format === "all"
                ? "bg-aqua-relay text-ink"
                : "border border-cloud bg-paper text-slate"
            }`}
          >
            All
          </button>
          {COURSE_FORMATS.map((option) => (
            <button
              key={option.id}
              type="button"
              aria-pressed={format === option.id}
              onClick={() => toggleFormat(option.id)}
              className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                format === option.id
                  ? "bg-aqua-relay text-ink"
                  : "border border-cloud bg-paper text-slate"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        {courses.isLoading && courses.courses.length === 0 ? (
          <div className="py-14 text-center" aria-busy="true">
            <p className="font-heading text-lg font-semibold text-ink">Loading courses…</p>
          </div>
        ) : courses.error && courses.courses.length === 0 ? (
          <SectionState
            heading="Could not load the training catalogue."
            message={courses.error.message}
            onRetry={() => void courses.refetch()}
          />
        ) : courses.courses.length > 0 ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {courses.courses.map((course) => (
              <CourseCard key={course.id} course={course} locale={locale} />
            ))}
          </div>
        ) : (
          <SectionState
            heading={
              format === "all"
                ? "No courses in your region yet."
                : "No courses match those filters yet."
            }
            message={
              format === "all"
                ? "Courses appear here as training providers publish them."
                : "Try another delivery format, or check back soon."
            }
          />
        )}
      </section>
    </div>
  );
}
