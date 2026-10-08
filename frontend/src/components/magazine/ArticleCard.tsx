import { BookOpen, CalendarDays } from "lucide-react";

import type { MagazineArticleSummary } from "../../lib/magazineApi";
import Badge from "../ui/Badge";

export interface ArticleCardProps {
  article: MagazineArticleSummary;
  onOpen: (article: MagazineArticleSummary) => void;
}

function publishedLabel(publishedAt: string): string {
  const date = new Date(publishedAt);
  const format: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" };

  return Number.isNaN(date.getTime()) ? publishedAt : date.toLocaleDateString("en", format);
}

export function ArticleCard({ article, onOpen }: ArticleCardProps) {
  return (
    <article className="flex h-full flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white transition hover:border-orange-300 dark:border-navy-600 dark:bg-navy-800 dark:hover:border-gold-400/50">
      <div className="flex h-24 items-center justify-center bg-navy-800">
        <BookOpen className="h-10 w-10 text-white/70" aria-hidden="true" />
      </div>

      <div className="flex flex-1 flex-col p-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="gold">{article.category}</Badge>
        </div>

        <h3 className="mt-3 font-heading font-bold text-gray-900 dark:text-white">
          {article.title}
        </h3>

        <p className="mt-2 line-clamp-3 text-sm text-gray-600 dark:text-gray-400">
          {article.standfirst}
        </p>

        <p className="mt-3 text-xs text-gray-500 dark:text-gray-500">By {article.authorName}</p>

        <div className="mt-auto flex items-center justify-between pt-4">
          <span className="inline-flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
            <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
            {publishedLabel(article.publishedAt)}
          </span>
          <button
            type="button"
            onClick={() => onOpen(article)}
            className="text-sm font-semibold text-orange-500 hover:text-orange-600 dark:text-gold-300"
          >
            Read article →
          </button>
        </div>
      </div>
    </article>
  );
}
