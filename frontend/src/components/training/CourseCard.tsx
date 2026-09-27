import { CalendarDays, Clock, MapPin, Star } from "lucide-react";

import type { Course } from "../../lib/courseFixtures";
import { formatMoney } from "../../utils/formatCurrency";
import Badge from "../ui/Badge";

export interface CourseCardProps {
  course: Course;
}

const FORMAT_LABELS: Record<string, string> = {
  online: "Online",
  physical: "Physical",
  workshop: "Hands-On Workshop",
};

export function CourseCard({ course }: CourseCardProps) {
  return (
    <article className="flex h-full flex-col rounded-2xl border border-gray-200 bg-white p-5 transition hover:-translate-y-1 hover:shadow-xl dark:border-navy-600 dark:bg-navy-800">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="navy">{FORMAT_LABELS[course.format] ?? course.format}</Badge>
        <Badge variant="gold">{course.cpdPoints} CPD</Badge>
        {course.isNew && <Badge variant="green">New</Badge>}
      </div>

      <h3 className="mt-4 font-heading text-lg font-bold text-gray-900 dark:text-white">
        {course.title}
      </h3>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{course.provider}</p>

      <dl className="mt-4 space-y-2 text-sm text-gray-600 dark:text-gray-300">
        <div className="flex items-center gap-2">
          <dt className="sr-only">Date</dt>
          <CalendarDays className="h-4 w-4 text-orange-500" aria-hidden="true" />
          <dd>
            {course.date} · {course.duration}
          </dd>
        </div>
        <div className="flex items-center gap-2">
          <dt className="sr-only">Location</dt>
          <MapPin className="h-4 w-4 text-orange-500" aria-hidden="true" />
          <dd>{course.location}</dd>
        </div>
        <div className="flex items-center gap-2">
          <dt className="sr-only">Rating</dt>
          <Star className="h-4 w-4 text-gold-400" aria-hidden="true" />
          <dd>
            {course.rating.toFixed(1)} · {course.enrolled} enrolled
          </dd>
        </div>
        <div className="flex items-center gap-2">
          <dt className="sr-only">Format</dt>
          <Clock className="h-4 w-4 text-orange-500" aria-hidden="true" />
          <dd>{course.specialty}</dd>
        </div>
      </dl>

      <p className="mt-auto pt-5 text-lg font-bold text-orange-500 dark:text-gold-300">
        {course.price === null ? "Included in membership" : formatMoney(course.price)}
      </p>
    </article>
  );
}
