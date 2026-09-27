import { BrainCircuit, FlaskConical, Newspaper, Printer, Sparkles, Video, Zap } from "lucide-react";
import { useMemo, useState } from "react";

import { ArticleCard } from "../components/magazine/ArticleCard";
import { ContentViewerModal } from "../components/magazine/ContentViewerModal";
import { VideoCard } from "../components/magazine/VideoCard";
import Badge from "../components/ui/Badge";
import SearchBar from "../components/ui/SearchBar";
import {
  MAGAZINE_CATEGORIES,
  MAGAZINE_FILTERS,
  type TechIconKey,
} from "../config/magazineConstants";
import { listMagazineFixtures, listTechSpotlightFixtures } from "../lib/magazineFixtures";
import type { MagazineItem } from "../lib/magazineFixtures";

const TECH_ICONS: Record<TechIconKey, typeof Sparkles> = {
  brain: BrainCircuit,
  printer: Printer,
  video: Video,
  zap: Zap,
  sparkles: Sparkles,
  flask: FlaskConical,
};

const FEATURED_FILTER = "all";
const ALL_CATEGORIES = "all";

export function Magazine() {
  const [filter, setFilter] = useState<string>(FEATURED_FILTER);
  const [category, setCategory] = useState<string>(ALL_CATEGORIES);
  const [search, setSearch] = useState("");
  const [viewing, setViewing] = useState<MagazineItem | null>(null);

  const allItems = listMagazineFixtures();

  const items = useMemo(() => {
    const query = search.trim().toLowerCase();

    return allItems
      .filter((item) => filter === ALL_CATEGORIES || item.type === filter)
      .filter((item) => category === ALL_CATEGORIES || item.category === category)
      .filter(
        (item) =>
          query === "" ||
          item.title.toLowerCase().includes(query) ||
          item.excerpt.toLowerCase().includes(query) ||
          item.tags.some((tag) => tag.toLowerCase().includes(query)),
      )
      .sort(
        (left, right) =>
          new Date(right.publishedAt).getTime() - new Date(left.publishedAt).getTime(),
      );
  }, [allItems, category, filter, search]);

  const featured = useMemo(() => allItems.find((item) => item.isFeatured), [allItems]);

  const techSpotlight = listTechSpotlightFixtures();

  const showFeatured =
    featured !== undefined &&
    filter === ALL_CATEGORIES &&
    category === ALL_CATEGORIES &&
    search.trim() === "";

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
          Dental <span className="text-gold-500">Magazine &amp; Videos</span>
        </h1>

        <p className="mt-2 max-w-2xl text-gray-600 dark:text-gray-300">
          Educational articles and videos from practising dentists, plus the latest technology
          shaping modern dentistry. Learn, share, and stay ahead.
        </p>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
          <SearchBar
            value={search}
            onChange={setSearch}
            placeholder="Search articles, videos, topics…"
            className="max-w-md"
          />
        </div>
      </section>

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
              {featured.type === "video" ? (
                <Video className="h-14 w-14 text-white/70" aria-hidden="true" />
              ) : (
                <Newspaper className="h-14 w-14 text-white/70" aria-hidden="true" />
              )}
            </div>

            <div className="flex flex-col justify-center gap-3 p-6 md:p-8">
              <div className="flex flex-wrap gap-2">
                <Badge variant="gold">{featured.category}</Badge>
                <Badge variant="navy">{featured.type === "video" ? "Video" : "Article"}</Badge>
              </div>

              <h3 className="font-display text-2xl font-bold text-gray-900 group-hover:text-orange-500 dark:text-white dark:group-hover:text-gold-300">
                {featured.title}
              </h3>

              <p className="text-gray-600 dark:text-gray-400">{featured.excerpt}</p>

              <span className="text-sm font-semibold text-orange-500 dark:text-gold-300">
                {featured.type === "video" ? "View summary →" : "Read article →"}
              </span>
            </div>
          </button>
        </section>
      )}

      <div className="mb-6 flex flex-wrap items-center gap-2">
        {MAGAZINE_FILTERS.map((option) => (
          <button
            key={option.id}
            type="button"
            aria-pressed={filter === option.id}
            onClick={() => setFilter(option.id)}
            className={`rounded-full px-4 py-2 text-sm font-medium transition ${
              filter === option.id
                ? "bg-orange-500 text-white dark:bg-gold-400 dark:text-navy-900"
                : "border border-gray-200 bg-white text-gray-600 dark:border-navy-600 dark:bg-navy-800 dark:text-gray-300"
            }`}
          >
            {option.label}
          </button>
        ))}

        <span className="mx-1 h-6 w-px bg-gray-200 dark:bg-navy-600" aria-hidden="true" />

        {[ALL_CATEGORIES, ...MAGAZINE_CATEGORIES].map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={category === option}
            onClick={() => setCategory(option)}
            className={`rounded-full px-3 py-2 text-sm font-medium ${
              category === option
                ? "bg-orange-50 text-orange-600 dark:bg-navy-700 dark:text-gold-300"
                : "text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200"
            }`}
          >
            {option === ALL_CATEGORIES ? "All topics" : option}
          </button>
        ))}
      </div>

      {items.length > 0 ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) =>
            item.type === "video" ? (
              <VideoCard key={item.id} video={item} onOpen={setViewing} />
            ) : (
              <ArticleCard key={item.id} article={item} onOpen={setViewing} />
            ),
          )}
        </div>
      ) : (
        <div className="py-16 text-center text-gray-600 dark:text-gray-400">
          <Newspaper
            className="mx-auto h-12 w-12 text-orange-400 dark:text-gold-400/50"
            aria-hidden="true"
          />
          <p className="mt-4">No content matches your filters yet.</p>
        </div>
      )}

      <section className="mt-14">
        <div className="mb-4 flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-orange-500 dark:text-gold-400" aria-hidden="true" />
          <h2 className="font-heading text-xl font-semibold text-gray-900 dark:text-gray-100">
            Latest technology in dentistry
          </h2>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {techSpotlight.map((tech) => {
            const Icon = TECH_ICONS[tech.icon];
            return (
              <div
                key={tech.id}
                className="overflow-hidden rounded-xl border border-gray-200 bg-white transition hover:border-orange-300 dark:border-navy-600 dark:bg-navy-800 dark:hover:border-gold-400/50"
              >
                <div className="flex h-24 items-center gap-3 bg-navy-800 px-5">
                  <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-black/25">
                    <Icon className="h-6 w-6 text-white" aria-hidden="true" />
                  </span>
                  <div>
                    <h3 className="font-heading font-bold text-white">{tech.name}</h3>
                    <span className="text-xs text-white/80">{tech.maturity}</span>
                  </div>
                </div>

                <div className="space-y-1 p-5">
                  <p className="font-medium text-orange-500 dark:text-gold-300">{tech.headline}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{tech.summary}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <ContentViewerModal item={viewing} onClose={() => setViewing(null)} />
    </div>
  );
}
