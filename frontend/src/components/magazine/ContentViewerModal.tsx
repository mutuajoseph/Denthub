import { BookOpen } from "lucide-react";

import { useArticleDetail } from "../../hooks/useMagazine";
import type { MagazineArticleSummary } from "../../lib/magazineApi";
import Badge from "../ui/Badge";
import Modal from "../ui/Modal";
import { MarkdownBody } from "./MarkdownBody";

export interface ContentViewerModalProps {
  article: MagazineArticleSummary | null;
  onClose: () => void;
}

const DATE_FORMAT: Intl.DateTimeFormatOptions = { dateStyle: "long" };

function publishedLabel(publishedAt: string): string {
  const date = new Date(publishedAt);

  return Number.isNaN(date.getTime()) ? publishedAt : date.toLocaleDateString("en", DATE_FORMAT);
}

export function ContentViewerModal({ article, onClose }: ContentViewerModalProps) {
  // Body lives only on the detail endpoint, so the modal fetches by slug.
  const { article: detail, isLoading, error } = useArticleDetail(article?.slug ?? "");

  if (article === null) return null;

  return (
    <Modal isOpen onClose={onClose} size="lg" ariaLabel={article.title}>
      <div className="flex flex-wrap items-center gap-2 pr-8">
        <Badge variant="gold">{article.category}</Badge>
        <Badge variant="navy">Article</Badge>
      </div>

      <h2 className="mt-4 font-display text-2xl font-bold text-gray-900 dark:text-white">
        {article.title}
      </h2>

      <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">By {article.authorName}</p>

      <p className="mt-1 text-xs text-gray-400">{publishedLabel(article.publishedAt)}</p>

      {isLoading ? (
        <p className="mt-5 text-gray-500 dark:text-gray-400">Loading article…</p>
      ) : error ? (
        <p className="mt-5 text-sm text-red-600 dark:text-red-400">
          Could not load this article. Try again later.
        </p>
      ) : detail ? (
        <>
          <p className="mt-5 font-medium text-gray-700 dark:text-gray-200">{detail.standfirst}</p>
          <div className="mt-4">
            <MarkdownBody body={detail.body} />
          </div>
        </>
      ) : null}

      <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-gray-200 pt-5 dark:border-navy-600">
        <span className="inline-flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
          <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
          Tags
        </span>
        {article.tags.map((tag) => (
          <Badge key={tag} variant="navy">
            {tag}
          </Badge>
        ))}
      </div>
    </Modal>
  );
}
