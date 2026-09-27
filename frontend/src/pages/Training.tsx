import { GraduationCap } from "lucide-react";
import { useMemo, useState } from "react";

import { CourseCard } from "../components/training/CourseCard";
import Badge from "../components/ui/Badge";
import { COURSE_FORMATS, COURSE_SPECIALTIES } from "../config/courseConstants";
import { listCourseFixtures, listWebinarFixtures } from "../lib/courseFixtures";
import { useSiteContentStore } from "../store/siteContentStore";

export function Training() {
  const { title, subtitle } = useSiteContentStore((s) => s.training);

  const [format, setFormat] = useState<string>("all");
  const [specialty, setSpecialty] = useState("");

  const webinars = listWebinarFixtures();

  const filtered = useMemo(
    () =>
      listCourseFixtures().filter(
        (course) =>
          (format === "all" || course.format === format) &&
          (specialty === "" || course.specialty === specialty),
      ),
    [format, specialty],
  );

  return (
    <div className="app-container py-8 text-gray-900 lg:py-12 dark:text-white">
      <header className="mb-6">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-orange-50 text-orange-500 dark:bg-gold-400/10 dark:text-gold-400">
            <GraduationCap className="h-5 w-5" aria-hidden="true" />
          </span>
          <h1 className="font-display text-3xl font-bold text-gray-900 dark:text-white">{title}</h1>
        </div>
        <p className="mt-2 text-gray-600 dark:text-gray-400">{subtitle}</p>
      </header>

      <div className="mb-6 flex flex-wrap gap-2">
        {COURSE_FORMATS.map((option) => (
          <button
            key={option.id}
            type="button"
            aria-pressed={format === option.id}
            onClick={() => setFormat(option.id)}
            className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              format === option.id
                ? "bg-gold-400 text-navy-900"
                : "border border-gray-200 bg-white text-gray-600 dark:border-navy-600 dark:bg-navy-800 dark:text-gray-300"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="mb-8 flex flex-wrap gap-2">
        {COURSE_SPECIALTIES.map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={specialty === option}
            onClick={() => setSpecialty(specialty === option ? "" : option)}
            className={`rounded-full border px-3 py-1 text-xs transition-colors ${
              specialty === option
                ? "border-gold-400 text-gold-500 dark:text-gold-300"
                : "border-gray-200 text-gray-500 dark:border-navy-600 dark:text-gray-400"
            }`}
          >
            {option}
          </button>
        ))}
      </div>

      <section className="mb-12" aria-labelledby="training-webinars-heading">
        <div className="mb-4 flex items-center gap-2">
          <h2
            id="training-webinars-heading"
            className="font-heading text-xl font-semibold text-gray-900 dark:text-white"
          >
            Upcoming Live Webinars
          </h2>
          <Badge variant="orange">New This Month</Badge>
        </div>

        <ul className="flex gap-4 overflow-x-auto pb-2">
          {webinars.map((webinar) => (
            <li
              key={webinar.id}
              className="w-64 shrink-0 rounded-xl border border-gray-200 bg-white p-4 dark:border-navy-600 dark:bg-navy-800"
            >
              <p className="text-sm font-semibold text-gray-900 dark:text-white">{webinar.title}</p>
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                {webinar.date} · {webinar.time}
              </p>
              <p className="mt-1 text-xs text-gold-500 dark:text-gold-400">{webinar.speaker}</p>
              <Badge variant={webinar.free ? "green" : "gold"} className="mt-2">
                {webinar.free ? "Free" : "Paid"}
              </Badge>
            </li>
          ))}
        </ul>
      </section>

      {filtered.length > 0 ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((course) => (
            <CourseCard key={course.id} course={course} />
          ))}
        </div>
      ) : (
        <p className="py-16 text-center text-gray-500 dark:text-gray-400">
          No courses match those filters yet.
        </p>
      )}

      <section className="mt-16 rounded-xl border border-gold-400/30 bg-orange-50 p-8 text-center dark:bg-navy-800">
        <h3 className="mb-4 font-display text-xl text-gold-600 dark:text-gold-400">
          CPD Certificate Preview
        </h3>

        <div className="mx-auto max-w-md rounded-lg border-2 border-gold-400 bg-white p-6 dark:bg-navy-900">
          <p className="font-display text-2xl text-gray-900 dark:text-white">
            Certificate of Completion
          </p>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            Kenya Dental Association Accredited
          </p>
          <p className="mt-4 font-heading text-gray-900 dark:text-white">Dr. [Your Name]</p>
          <p className="mt-2 font-bold text-gold-500 dark:text-gold-400">12 CPD Points</p>
          <p className="mt-4 text-xs text-gray-500">DentHub Kenya</p>
        </div>
      </section>
    </div>
  );
}
