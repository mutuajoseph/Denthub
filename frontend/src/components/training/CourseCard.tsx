import { Clock, MapPin, ShieldCheck } from "lucide-react";

import type { CourseView } from "../../lib/trainingApi";
import { formatListingPrice } from "../../utils/formatCurrency";
import { subdivisionLabel } from "../../utils/subdivisionLabel";
import Badge from "../ui/Badge";

export interface CourseCardProps {
  course: CourseView;
  /** The market locale, so a price in the course's own currency reads right. */
  locale: string;
}

const FORMAT_LABELS: Record<string, string> = {
  in_person: "In Person",
  online: "Online",
  blended: "Blended",
};

export function CourseCard({ course, locale }: CourseCardProps) {
  const price = formatListingPrice(course.price, course.currency ?? "KES", locale);

  return (
    <article className="flex h-full flex-col rounded-card border border-cloud bg-paper p-5 shadow-card-cloud">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="neutral">{FORMAT_LABELS[course.deliveryMode] ?? course.deliveryMode}</Badge>
        {course.providerVerified && (
          <Badge variant="success">
            <ShieldCheck className="h-3 w-3" aria-hidden="true" />
            Verified
          </Badge>
        )}
      </div>

      <h3 className="mt-4 font-heading text-lg font-bold text-ink">{course.title}</h3>
      <p className="mt-1 text-sm text-slate">{course.providerName}</p>

      <p className="mt-3 line-clamp-2 text-sm text-slate">{course.description}</p>

      <div className="mt-3 flex items-center gap-1.5 text-sm text-slate">
        <MapPin className="h-4 w-4 text-graphite" aria-hidden="true" />
        {subdivisionLabel(course.subdivisionCode)}
      </div>

      <div className="mt-auto flex items-center justify-between pt-5">
        <p className="font-mono text-lg font-bold text-ink">{price ?? "Free CPD"}</p>
        <p className="flex items-center gap-1.5 text-xs text-slate">
          <Clock className="h-3.5 w-3.5" aria-hidden="true" />
          {FORMAT_LABELS[course.deliveryMode] ?? course.deliveryMode}
        </p>
      </div>
    </article>
  );
}
