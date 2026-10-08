import { Newspaper } from "lucide-react";
import { useMemo, useState } from "react";

import { ArticleCard } from "../components/magazine/ArticleCard";
import { ContentViewerModal } from "../components/magazine/ContentViewerModal";
import Badge from "../components/ui/Badge";
import SearchBar from "../components/ui/SearchBar";
import { useMagazineArticles, useMagazineCategories } from "../hooks/useMagazine";
import type { MagazineArticleSummary } from "../lib/magazineApi";

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
      <section className="mb-8 overflow-hidden rounded-2xl border border-orange-100 bg-gradient-to-br from-white via-orange-50 to-white p-8 md:p-12 dark:border-navy-600 dark:from-navy-950 dark:via-navy-800 dark:to-navy-900">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="gold">
            <Newspaper className="h-3 w-3" aria-hidden="true" />
            DentHub Magazine
          </Badge>
          <Badge variant="orange">Dentist-written</Badge>
        </div>

        <h1 className="mt-4 font-display text-3xl font-bold text-gray-900 md:text-4xl dark:text-white">
          Dental <span className="text-gold-500">Magazine</span>
        </h1>

        <p className="mt-2 max-w-2xl text-gray-600 dark:text-gray-300">
          Educational articles from practising dentists, written for patients and professionals.
          Learn, share, and stay ahead.
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
        <p className="py-16 text-center text-gray-600 dark:text-gray-400">Loading articles…</p>
      ) : error ? (
        <div className="py-16 text-center">
          <Newspaper
            className="mx-auto h-12 w-12 text-orange-400 dark:text-gold-400/50"
            aria-hidden="true"
          />
          <p className="mt-4 text-gray-600 dark:text-gray-400">Could not load the magazine.</p>
          <button
            type="button"
            onClick={() => void refetch()}
            className="mx-auto mt-5 block rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-orange-500 hover:text-orange-600 dark:border-navy-600 dark:bg-navy-800 dark:text-gold-300"
          >
            Try again
          </button>
        </div>
      ) : (
        <>
          {showFeatured && (
            <section className="mb-10">
              <h2 className="mb-3 font-heading text-lg font-semibold text-gray-900 dark:text-gray-200">
                Featured this month
              </h2>

              <button
                type="button"
                onClick={() => setViewing(featured)}
                className="group grid w-full overflow-hidden rounded-2xl border border-gray-200 bg-white text-left transition hover:border-orange-300 dark:border-navy-600 dark:bg-navy-800 dark:hover:border-gold-400/50 md:grid-cols-2"
              >
                <div className="flex h-48 items-center justify-center bg-navy-800 md:h-full">
                  <Newspaper className="h-14 w-14 text-white/70" aria-hidden="true" />
                </div>

                <div className="flex flex-col justify-center gap-3 p-6 md:p-8">
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="gold">{featured.category}</Badge>
                    <Badge variant="navy">Article</Badge>
                  </div>

                  <h3 className="font-display text-2xl font-bold text-gray-900 group-hover:text-orange-500 dark:text-white dark:group-hover:text-gold-300">
                    {featured.title}
                  </h3>

                  <p className="text-gray-600 dark:text-gray-400">{featured.standfirst}</p>

                  <span className="text-sm font-semibold text-orange-500 dark:text-gold-300">
                    Read article →
                  </span>
                </div>
              </button>
            </section>
          )}

          <aside
            className="mb-6 flex flex-wrap items-center gap-2"
            aria-label="Filter dental articles"
          >
            {[ALL_CATEGORIES, ...categories].map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={category === option}
                onClick={() => setCategory(option)}
                className={`rounded-full px-3 py-2 text-sm font-medium ${
                  option === ALL_CATEGORIES
                    ? "border border-gray-200 bg-white text-gray-600 dark:border-navy-600 dark:bg-navy-800 dark:text-gray-300"
                    : "text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200"
                }`}
              >
                {option === ALL_CATEGORIES ? "All topics" : chipLabel(option)}
              </button>
            ))}
          </aside>

          {items.length > 0 ? (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((article) => (
                <ArticleCard key={article.id} article={article} onOpen={setViewing} />
              ))}
            </div>
          ) : (
            <div className="py-16 text-center text-gray-600 dark:text-gray-400">
              <Newspaper
                className="mx-auto h-12 w-12 text-orange-400 dark:text-gold-400/50"
                aria-hidden="true"
              />
              <p className="mt-4">No articles match your filters yet.</p>
            </div>
          )}
        </>
      )}

      <ContentViewerModal article={viewing} onClose={() => setViewing(null)} />
    </div>
  );
}
