import { Eye, Video } from "lucide-react";

import type { MagazineVideo } from "../../lib/magazineFixtures";
import Badge from "../ui/Badge";

export interface VideoCardProps {
  video: MagazineVideo;
  onOpen: (video: MagazineVideo) => void;
}

function formatViews(views: number): string {
  return new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(
    views,
  );
}

export function VideoCard({ video, onOpen }: VideoCardProps) {
  return (
    <article className="flex h-full flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white transition hover:border-orange-300 dark:border-navy-600 dark:bg-navy-800 dark:hover:border-gold-400/50">
      <div className="flex h-24 items-center justify-center bg-navy-800">
        <Video className="h-10 w-10 text-white/70" aria-hidden="true" />
      </div>

      <div className="flex flex-1 flex-col p-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="orange">{video.category}</Badge>
          {video.isNew && <Badge variant="green">New</Badge>}
        </div>

        <h3 className="mt-3 font-heading font-bold text-gray-900 dark:text-white">{video.title}</h3>

        <p className="mt-2 line-clamp-3 text-sm text-gray-600 dark:text-gray-400">
          {video.excerpt}
        </p>

        <p className="mt-3 text-xs text-gray-500 dark:text-gray-500">
          {video.speaker} · {video.speakerClinic}
        </p>

        <div className="mt-auto flex items-center justify-between pt-4">
          <span className="inline-flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
            <span>{video.duration}</span>
            <span className="inline-flex items-center gap-1">
              <Eye className="h-3.5 w-3.5" aria-hidden="true" />
              {formatViews(video.views)}
            </span>
          </span>
          <button
            type="button"
            onClick={() => onOpen(video)}
            className="text-sm font-semibold text-orange-500 hover:text-orange-600 dark:text-gold-300"
          >
            View summary →
          </button>
        </div>
      </div>
    </article>
  );
}
