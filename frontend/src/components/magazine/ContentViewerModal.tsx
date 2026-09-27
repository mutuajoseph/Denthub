import { BookOpen, Video } from "lucide-react";

import type { MagazineItem } from "../../lib/magazineFixtures";
import Badge from "../ui/Badge";
import Modal from "../ui/Modal";

export interface ContentViewerModalProps {
  item: MagazineItem | null;
  onClose: () => void;
}

const DATE_FORMAT: Intl.DateTimeFormatOptions = { dateStyle: "long" };

function publishedLabel(publishedAt: string): string {
  const date = new Date(publishedAt);

  return Number.isNaN(date.getTime()) ? publishedAt : date.toLocaleDateString("en", DATE_FORMAT);
}

export function ContentViewerModal({ item, onClose }: ContentViewerModalProps) {
  if (item === null) return null;

  const isArticle = item.type === "article";
  const paragraphs = isArticle ? item.body : item.summary;

  return (
    <Modal isOpen onClose={onClose} size="lg" ariaLabel={item.title}>
      <div className="flex flex-wrap items-center gap-2 pr-8">
        <Badge variant={isArticle ? "gold" : "orange"}>{item.category}</Badge>
        <Badge variant="navy">{isArticle ? "Article" : "Video"}</Badge>
      </div>

      <h2 className="mt-4 font-display text-2xl font-bold text-gray-900 dark:text-white">
        {item.title}
      </h2>

      <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
        {isArticle
          ? `By ${item.author}, ${item.authorClinic} · ${item.readMinutes} min read`
          : `With ${item.speaker}, ${item.speakerClinic} · ${item.duration}`}
      </p>

      <p className="mt-1 text-xs text-gray-400">{publishedLabel(item.publishedAt)}</p>

      <p className="mt-5 font-medium text-gray-700 dark:text-gray-200">{item.excerpt}</p>

      {isArticle ? (
        <div className="mt-4 space-y-4">
          {paragraphs.map((paragraph) => (
            <p key={paragraph} className="leading-7 text-gray-600 dark:text-gray-300">
              {paragraph}
            </p>
          ))}
        </div>
      ) : (
        <div className="mt-4">
          <p className="mb-4 flex items-center gap-2 rounded-xl border border-navy-600 bg-navy-900 p-4 text-sm text-gray-300">
            <Video className="h-4 w-4 shrink-0" aria-hidden="true" />
            Video playback is not connected yet. The session summary is below.
          </p>
          <div className="space-y-4">
            {paragraphs.map((paragraph) => (
              <p key={paragraph} className="leading-7 text-gray-600 dark:text-gray-300">
                {paragraph}
              </p>
            ))}
          </div>
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-gray-200 pt-5 dark:border-navy-600">
        <span className="inline-flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
          {isArticle ? (
            <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
          ) : (
            <Video className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          Tags
        </span>
        {item.tags.map((tag) => (
          <Badge key={tag} variant="navy">
            {tag}
          </Badge>
        ))}
      </div>
    </Modal>
  );
}
