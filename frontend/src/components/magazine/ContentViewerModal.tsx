import { BookOpen, Play } from "lucide-react";

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

/** Turn a YouTube watch/short/embed link into a privacy-friendly embed URL. */
export function youtubeEmbedUrl(videoUrl: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(videoUrl);
  } catch {
    return null;
  }

  if (parsed.hostname === "youtu.be") {
    const id = parsed.pathname.slice(1);
    return id ? `https://www.youtube.com/embed/${id}` : null;
  }

  if (parsed.hostname.endsWith("youtube.com") || parsed.hostname.endsWith("youtube-nocookie.com")) {
    const id = parsed.searchParams.get("v");
    if (id) return `https://www.youtube.com/embed/${id}`;
    if (parsed.pathname.startsWith("/embed/")) return videoUrl;
  }

  return null;
}

export function ContentViewerModal({ article, onClose }: ContentViewerModalProps) {
  // Body lives only on the detail endpoint, so the modal fetches by slug.
  const { article: detail, isLoading, error } = useArticleDetail(article?.slug ?? "");

  if (article === null) return null;

  const isVideo = article.contentType === "video";
  const embedUrl = article.videoUrl ? youtubeEmbedUrl(article.videoUrl) : null;

  return (
    <Modal isOpen onClose={onClose} size="lg" ariaLabel={article.title}>
      <div className="flex flex-wrap items-center gap-2 pr-8">
        <Badge variant="neutral">{article.category}</Badge>
        <Badge variant="ink">{isVideo ? "Video" : "Article"}</Badge>
      </div>

      <h2 className="mt-4 font-display text-2xl font-bold text-ink">{article.title}</h2>

      <p className="mt-2 text-sm text-slate">By {article.authorName}</p>

      <p className="mt-1 text-xs text-charcoal">{publishedLabel(article.publishedAt)}</p>

      {isVideo ? (
        <div className="mt-5">
          {embedUrl ? (
            <div className="aspect-video overflow-hidden rounded-card border border-steel bg-graphite">
              <iframe
                src={embedUrl}
                title={article.title}
                className="h-full w-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          ) : (
            <div className="flex aspect-video flex-col items-center justify-center gap-2 rounded-card border border-steel bg-cloud text-slate">
              <Play className="h-10 w-10 text-graphite" aria-hidden="true" />
              <p className="text-sm font-medium">Video playback is coming soon.</p>
            </div>
          )}
        </div>
      ) : null}

      {isLoading ? (
        <p className="mt-5 text-slate">Loading {isVideo ? "video" : "article"}…</p>
      ) : error ? (
        <p className="mt-5 text-sm text-red-600">
          Could not load this {isVideo ? "video" : "article"}. Try again later.
        </p>
      ) : detail ? (
        <>
          <p className="mt-5 font-medium text-charcoal">{detail.standfirst}</p>
          <div className="mt-4">
            <MarkdownBody body={detail.body} />
          </div>
        </>
      ) : null}

      <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-steel pt-5">
        <span className="inline-flex items-center gap-1 text-xs text-slate">
          <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
          Tags
        </span>
        {article.tags.map((tag) => (
          <Badge key={tag} variant="neutral">
            {tag}
          </Badge>
        ))}
      </div>
    </Modal>
  );
}
