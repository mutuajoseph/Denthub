import { BookOpen, Clock } from "lucide-react";

import type { MagazineArticle } from "../../lib/magazineFixtures";
import Badge from "../ui/Badge";

export interface ArticleCardProps {
  article: MagazineArticle;
  onOpen: (article: MagazineArticle) => void;
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
          {article.isNew && <Badge variant="green">New</Badge>}
        </div>

        <h3 className="mt-3 font-heading font-bold text-gray-900 dark:text-white">
          {article.title}
        </h3>

        <p className="mt-2 line-clamp-3 text-sm text-gray-600 dark:text-gray-400">
          {article.excerpt}
        </p>

        <p className="mt-3 text-xs text-gray-500 dark:text-gray-500">
          {article.author} · {article.authorClinic}
        </p>

        <div className="mt-auto flex items-center justify-between pt-4">
          <span className="inline-flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
            <Clock className="h-3.5 w-3.5" aria-hidden="true" />
            {article.readMinutes} min read
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
