import { Newspaper, Play } from "lucide-react";
import { useMemo, useState } from "react";

import { ArticleCard } from "../components/magazine/ArticleCard";
import { ContentViewerModal } from "../components/magazine/ContentViewerModal";
import { VideoCard } from "../components/magazine/VideoCard";
import Badge from "../components/ui/Badge";
import SearchBar from "../components/ui/SearchBar";
import { useMagazineArticles, useMagazineCategories } from "../hooks/useMagazine";
import type { MagazineArticleSummary } from "../lib/magazineApi";
import { cn } from "../utils/cn";

const ALL_CATEGORIES = "all";

function chipLabel(category: string): string {
  return category
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function Magazine() {
  const [category, setCategory] = useState<string>(ALL_CATEGORIES);
  const [search, setSearch] = useState("");
  const [viewing, setViewing] = useState<MagazineArticleSummary | null>(null);

  const { articles, isLoading, error, refetch } = useMagazineArticles();
  const { categories } = useMagazineCategories();

  const items = useMemo(() => {
    const query = search.trim().toLowerCase();

    return articles
      .filter((article) => category === ALL_CATEGORIES || article.category === category)
      .filter(
        (article) =>
          query === "" ||
          article.title.toLowerCase().includes(query) ||
          article.standfirst.toLowerCase().includes(query) ||
          article.tags.some((tag) => tag.toLowerCase().includes(query)),
      )
      .sort(
        (left, right) =>
          new Date(right.publishedAt).getTime() - new Date(left.publishedAt).getTime(),
      );
  }, [articles, category, search]);

  const featured = useMemo(() => articles.find((article) => article.isFeatured), [articles]);

  const showFeatured =
    featured !== undefined && category === ALL_CATEGORIES && search.trim() === "";

  return (
    <div className="app-container py-8 lg:py-12">
      <section className="mb-8 overflow-hidden rounded-card border border-steel bg-cloud p-8 md:p-12">
        <h1 className="font-display text-display-section text-ink">
          Dental <span className="text-graphite">Magazine</span>
        </h1>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Badge variant="ink">
            <Newspaper className="h-3 w-3" aria-hidden="true" />
            DentHub Magazine
          </Badge>
          <Badge variant="neutral">Dentist-written</Badge>
        </div>

        <p className="mt-3 max-w-2xl text-slate">
          Educational articles and videos from practising dentists, written for patients and
          professionals. Learn, share, and stay ahead.
        </p>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
          <SearchBar
            value={search}
            onChange={setSearch}
            placeholder="Search articles…"
            className="max-w-md"
          />
        </div>
      </section>

      {isLoading ? (
        <p className="py-16 text-center text-slate">Loading articles…</p>
      ) : error ? (
        <div className="py-16 text-center">
          <Newspaper className="mx-auto h-12 w-12 text-graphite" aria-hidden="true" />
          <p className="mt-4 text-slate">Could not load the magazine.</p>
          <button
            type="button"
            onClick={() => void refetch()}
            className="mx-auto mt-5 block rounded-button border border-steel bg-paper px-4 py-2 text-sm font-semibold text-graphite hover:text-ink"
          >
            Try again
          </button>
        </div>
      ) : (
        <>
          {showFeatured && (
            <section className="mb-10">
              <h2 className="mb-3 font-heading text-lg font-semibold text-ink">
                Featured this month
              </h2>

              <button
                type="button"
                onClick={() => setViewing(featured)}
                className="group grid w-full overflow-hidden rounded-card border border-steel bg-paper text-left shadow-card-white transition hover:border-slate md:grid-cols-2"
              >
                <div className="flex h-48 items-center justify-center bg-graphite md:h-full">
                  {featured.contentType === "video" ? (
                    <Play className="h-14 w-14 fill-paper text-paper" aria-hidden="true" />
                  ) : (
                    <Newspaper className="h-14 w-14 text-paper" aria-hidden="true" />
                  )}
                </div>

                <div className="flex flex-col justify-center gap-3 p-6 md:p-8">
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="neutral">{featured.category}</Badge>
                    <Badge variant="ink">
                      {featured.contentType === "video" ? "Video" : "Article"}
                    </Badge>
                  </div>

                  <h3 className="font-display text-2xl font-bold text-ink group-hover:text-graphite">
                    {featured.title}
                  </h3>

                  <p className="text-slate">{featured.standfirst}</p>

                  <span className="text-sm font-semibold text-graphite">
                    {featured.contentType === "video" ? "Watch video →" : "Read article →"}
                  </span>
                </div>
              </button>
            </section>
          )}

          <aside
            className="mb-6 flex flex-wrap items-center gap-2"
            aria-label="Filter dental articles"
          >
            {[ALL_CATEGORIES, ...categories].map((option) => {
              const pressed = category === option;

              return (
                <button
                  key={option}
                  type="button"
                  aria-pressed={pressed}
                  onClick={() => setCategory(option)}
                  className={cn(
                    "rounded-button px-3 py-2 text-sm font-medium transition",
                    pressed
                      ? "bg-ink text-paper"
                      : "border border-steel bg-paper text-slate hover:text-ink",
                  )}
                >
                  {option === ALL_CATEGORIES ? "All topics" : chipLabel(option)}
                </button>
              );
            })}
          </aside>

          {items.length > 0 ? (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((item) =>
                item.contentType === "video" ? (
                  <VideoCard key={item.id} video={item} onOpen={setViewing} />
                ) : (
                  <ArticleCard key={item.id} article={item} onOpen={setViewing} />
                ),
              )}
            </div>
          ) : (
            <div className="py-16 text-center text-slate">
              <Newspaper className="mx-auto h-12 w-12 text-graphite" aria-hidden="true" />
              <p className="mt-4">No articles match your filters yet.</p>
            </div>
          )}
        </>
      )}

      <ContentViewerModal article={viewing} onClose={() => setViewing(null)} />
    </div>
  );
}
