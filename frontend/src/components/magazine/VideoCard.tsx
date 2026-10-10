import { CalendarDays, Play } from "lucide-react";

import type { MagazineArticleSummary } from "../../lib/magazineApi";
import Badge from "../ui/Badge";

export interface VideoCardProps {
  video: MagazineArticleSummary;
  onOpen: (video: MagazineArticleSummary) => void;
}

function publishedLabel(publishedAt: string): string {
  const date = new Date(publishedAt);
  const format: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" };

  return Number.isNaN(date.getTime()) ? publishedAt : date.toLocaleDateString("en", format);
}

export function VideoCard({ video, onOpen }: VideoCardProps) {
  return (
    <article className="flex h-full flex-col overflow-hidden rounded-card border border-steel bg-paper shadow-card-white transition hover:border-slate">
      <div className="flex h-24 items-center justify-center bg-graphite">
        <Play className="h-9 w-9 fill-paper text-paper" aria-hidden="true" />
      </div>

      <div className="flex flex-1 flex-col p-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="neutral">{video.category}</Badge>
          <Badge variant="ink">Video</Badge>
        </div>

        <h3 className="mt-3 font-heading font-bold text-ink">{video.title}</h3>

        <p className="mt-2 line-clamp-3 text-sm text-slate">{video.standfirst}</p>

        <p className="mt-3 text-xs text-slate">By {video.authorName}</p>

        <div className="mt-auto flex items-center justify-between pt-4">
          <span className="inline-flex items-center gap-1 text-xs text-slate">
            <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
            {publishedLabel(video.publishedAt)}
          </span>
          <button
            type="button"
            onClick={() => onOpen(video)}
            className="text-sm font-semibold text-graphite hover:text-ink"
          >
            Watch video →
          </button>
        </div>
      </div>
    </article>
  );
}
