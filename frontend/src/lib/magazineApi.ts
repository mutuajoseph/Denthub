/**
 * Typed client for the public magazine, mirroring the backend Pydantic models
 * in `backend/app/logic/v1/magazine.py`.
 *
 * The list endpoint returns summaries without the article body; the detail
 * endpoint (keyed by slug) returns the full Markdown. ``country`` travels in
 * the ``Accept-Country`` header via `apiClient`, so the list/categories calls
 * here are market-aware without a query parameter.
 */

import { getJson } from "./apiClient";

/** The two content types the magazine publishes (PRD §3.8). */
export type MagazineContentType = "article" | "video";

export interface MagazineArticleSummary {
  id: string;
  slug: string;
  title: string;
  standfirst: string;
  heroImageUrl: string | null;
  authorName: string;
  category: string;
  contentType: MagazineContentType;
  /** YouTube link for a video; null for an article. */
  videoUrl: string | null;
  countryCode: string;
  isFeatured: boolean;
  tags: string[];
  /** ISO date; the page sorts newest-first without a date library. */
  publishedAt: string;
}

export interface MagazineArticleDetail extends MagazineArticleSummary {
  /** Markdown, rendered by a safe client-side subset. */
  body: string;
  updatedAt: string;
}

export interface MagazinePage {
  items: MagazineArticleSummary[];
  total: number;
  limit: number;
  offset: number;
  countryCode: string;
}

export interface MagazineCategoryList {
  countryCode: string;
  categories: string[];
}

export interface MagazineQuery {
  category?: string;
  tag?: string;
  limit?: number;
  offset?: number;
}

/* ------------------------------------------------------------------ *
 * Wire types — mirror the JSON exactly.
 * ------------------------------------------------------------------ */

type WireRecord = Record<string, unknown>;

interface WireArticleSummary extends WireRecord {
  id: string;
  slug: string;
  title: string;
  standfirst: string;
  hero_image_url: string | null;
  author_name: string;
  category: string;
  content_type: string;
  video_url: string | null;
  country_code: string;
  is_featured: boolean;
  tags: string[];
  published_at: string;
}

interface WireArticleDetail extends WireArticleSummary {
  body: string;
  updated_at: string;
}

interface WirePage extends WireRecord {
  items: WireArticleSummary[];
  total: number;
  limit: number;
  offset: number;
  country_code: string;
}

interface WireCategoryList extends WireRecord {
  country_code: string;
  categories: string[];
}

/* ------------------------------------------------------------------ *
 * Coercion helpers — the API contract is trusted, but a stray `null`
 * must not break a card.
 * ------------------------------------------------------------------ */

function toOptionalString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

export function mapArticleSummary(wire: WireArticleSummary): MagazineArticleSummary {
  return {
    id: wire.id,
    slug: wire.slug,
    title: wire.title,
    standfirst: wire.standfirst,
    heroImageUrl: toOptionalString(wire.hero_image_url),
    authorName: wire.author_name,
    category: wire.category,
    contentType: wire.content_type === "video" ? "video" : "article",
    videoUrl: toOptionalString(wire.video_url),
    countryCode: wire.country_code,
    isFeatured: Boolean(wire.is_featured),
    tags: Array.isArray(wire.tags) ? wire.tags.filter((tag) => typeof tag === "string") : [],
    publishedAt: wire.published_at,
  };
}

export function mapArticleDetail(wire: WireArticleDetail): MagazineArticleDetail {
  return {
    ...mapArticleSummary(wire),
    body: wire.body,
    updatedAt: wire.updated_at,
  };
}

export function mapMagazinePage(wire: WirePage): MagazinePage {
  return {
    items: (wire.items ?? []).map(mapArticleSummary),
    total: typeof wire.total === "number" ? wire.total : 0,
    limit: typeof wire.limit === "number" ? wire.limit : 0,
    offset: typeof wire.offset === "number" ? wire.offset : 0,
    countryCode: wire.country_code,
  };
}

export function mapMagazineCategories(wire: WireCategoryList): MagazineCategoryList {
  return {
    countryCode: wire.country_code,
    categories: Array.isArray(wire.categories)
      ? wire.categories.filter((category) => typeof category === "string")
      : [],
  };
}

/* ------------------------------------------------------------------ *
 * Calls
 * ------------------------------------------------------------------ */

export function fetchMagazineArticles(
  query: MagazineQuery = {},
  signal?: AbortSignal,
): Promise<MagazinePage> {
  return getJson<WirePage>("/magazine/articles", {
    query: {
      category: query.category,
      tag: query.tag,
      limit: query.limit,
      offset: query.offset,
    },
    signal,
  }).then(mapMagazinePage);
}

export function fetchMagazineArticle(
  slug: string,
  signal?: AbortSignal,
): Promise<MagazineArticleDetail> {
  return getJson<WireArticleDetail>(`/magazine/articles/${encodeURIComponent(slug)}`, {
    signal,
  }).then(mapArticleDetail);
}

export function fetchMagazineCategories(signal?: AbortSignal): Promise<MagazineCategoryList> {
  return getJson<WireCategoryList>("/magazine/categories", { signal }).then(mapMagazineCategories);
}
