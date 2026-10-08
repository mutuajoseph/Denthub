import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  MagazineArticleDetail,
  MagazineArticleSummary,
  MagazinePage,
} from "../lib/magazineApi";
import {
  fetchMagazineArticle,
  fetchMagazineArticles,
  fetchMagazineCategories,
} from "../lib/magazineApi";
import { Magazine } from "./Magazine";

const FEATURED: MagazineArticleSummary = {
  id: "article-1",
  slug: "modern-composite-artistry",
  title: "Modern Composite Artistry",
  standfirst: "Filler loading, polish and why margins matter.",
  heroImageUrl: null,
  authorName: "Dr. Mary Kamau",
  category: "clinical-guides",
  countryCode: "KE",
  isFeatured: true,
  tags: ["composites", "aesthetics"],
  publishedAt: "2026-10-02T08:00:00Z",
};

const REMINERALISATION: MagazineArticleSummary = {
  id: "article-2",
  slug: "remineralisation-in-practice",
  title: "Remineralisation in Practice",
  standfirst: "Putting fluoride and casein phospeptide to work before the drill.",
  heroImageUrl: null,
  authorName: "Dr. Brian Otieno",
  category: "clinical-guides",
  countryCode: "KE",
  isFeatured: false,
  tags: ["prevention", "fluoride"],
  publishedAt: "2026-09-20T08:00:00Z",
};

const INFECTION_CONTROL: MagazineArticleSummary = {
  id: "article-3",
  slug: "infection-control-checklist",
  title: "The Infection Control Checklist",
  standfirst: "Nine points to verify before the first patient.",
  heroImageUrl: null,
  authorName: "Dr. Wanjiku Njoroge",
  category: "clinical-guides",
  countryCode: "KE",
  isFeatured: false,
  tags: ["infection control", "safety"],
  publishedAt: "2026-09-12T08:00:00Z",
};

const PRICING: MagazineArticleSummary = {
  id: "article-4",
  slug: "pricing-your-first-practice",
  title: "Pricing Your First Practice",
  standfirst: "A simple model for fees that still feel fair.",
  heroImageUrl: null,
  authorName: "Dr. Amara Zuma",
  category: "business",
  countryCode: "NG",
  isFeatured: false,
  tags: ["business", "fees"],
  publishedAt: "2026-09-01T08:00:00Z",
};

const ARTICLES = [FEATURED, REMINERALISATION, INFECTION_CONTROL, PRICING];

const PAGE: MagazinePage = {
  items: ARTICLES,
  total: ARTICLES.length,
  limit: 100,
  offset: 0,
  countryCode: "KE",
};

const BODY =
  "## What the evidence says\n\nDo it for the margins — **the matrix band is your friend** " +
  "when _polishing_.\n\n- Check the contact point\n- Check the occlusion";

function detailFor(summary: MagazineArticleSummary): MagazineArticleDetail {
  return { ...summary, body: BODY, updatedAt: summary.publishedAt };
}

vi.mock("../lib/magazineApi", () => ({
  fetchMagazineArticles: vi.fn(),
  fetchMagazineArticle: vi.fn(),
  fetchMagazineCategories: vi.fn(),
}));

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return render(
    <QueryClientProvider client={client}>
      <Magazine />
    </QueryClientProvider>,
  );
}

function cardTitles(): string[] {
  return screen
    .getAllByRole("article")
    .map((card) => within(card).getByRole("heading", { level: 3 }).textContent ?? "");
}

async function featuredSection(): Promise<HTMLElement> {
  const heading = await screen.findByRole("heading", { name: /featured this month/i });
  return heading.closest("section") as HTMLElement;
}

describe("Magazine", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(fetchMagazineArticles).mockResolvedValue(PAGE);
    vi.mocked(fetchMagazineCategories).mockResolvedValue({
      countryCode: "KE",
      categories: ["clinical-guides", "business"],
    });
    vi.mocked(fetchMagazineArticle).mockImplementation(async (slug: string) =>
      detailFor(ARTICLES.find((article) => article.slug === slug) ?? ARTICLES[0]),
    );
  });

  it("leads with the magazine masthead", async () => {
    renderPage();

    expect(
      await screen.findByRole("heading", { level: 1, name: /dental magazine/i }),
    ).toBeInTheDocument();
  });

  it("lists every published article, newest first", async () => {
    renderPage();

    const cards = await screen.findAllByRole("article");
    expect(cards).toHaveLength(ARTICLES.length);

    const expectedOrder = [
      "Modern Composite Artistry",
      "Remineralisation in Practice",
      "The Infection Control Checklist",
      "Pricing Your First Practice",
    ];
    expect(cardTitles()).toEqual(expectedOrder);
  });

  it("features one article with a working viewer", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(
      within(await featuredSection()).getByRole("button", { name: /read article →/i }),
    );

    const dialog = await screen.findByRole("dialog", { name: /modern composite artistry/i });
    expect(within(dialog).getByText(/what the evidence says/i)).toBeInTheDocument();
    expect(within(dialog).getByText(/the matrix band is your friend/i)).toBeInTheDocument();
  });

  it("closes the viewer on Escape", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(
      within(await featuredSection()).getByRole("button", { name: /read article →/i }),
    );
    expect(await screen.findByRole("dialog")).toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("filters by category chip", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: "Clinical Guides" }));

    expect(screen.getAllByRole("article")).toHaveLength(3);
    expect(screen.queryByText(/pricing your first practice/i)).toBeNull();
  });

  it("searches titles, standfirsts and tags", async () => {
    const user = userEvent.setup();
    renderPage();

    const search = screen.getByLabelText(/search articles/i);

    await user.type(search, "remineralisation");
    expect(screen.getAllByRole("article")).toHaveLength(1);

    await user.clear(search);
    await user.type(search, "infection control");
    expect(screen.getAllByRole("article")).toHaveLength(1);

    await user.clear(search);
    await user.type(search, "fees");
    expect(screen.getAllByRole("article")).toHaveLength(1);
  });

  it("shows an empty state for a query with no matches", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText(/search articles/i), "zzzznotathing");

    expect(await screen.findByText(/no articles match your filters yet/i)).toBeInTheDocument();
  });

  it("hides the featured block while a filter is active", async () => {
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByText(/featured this month/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Clinical Guides" }));
    expect(screen.queryByText(/featured this month/i)).toBeNull();
  });

  it("shows a loading state before the first fetch resolves", () => {
    let resolveArticles!: (value: MagazinePage) => void;
    vi.mocked(fetchMagazineArticles).mockReturnValue(
      new Promise((resolve) => {
        resolveArticles = resolve;
      }),
    );

    renderPage();

    expect(screen.getByText(/loading articles/i)).toBeInTheDocument();
    resolveArticles(PAGE);

    void waitFor(() => expect(screen.getAllByRole("article")).toHaveLength(ARTICLES.length));
  });

  it("recovers from an error via retry", async () => {
    const user = userEvent.setup();
    vi.mocked(fetchMagazineArticles).mockRejectedValue(new Error("network down"));

    renderPage();

    expect(await screen.findByText(/could not load the magazine/i)).toBeInTheDocument();

    vi.mocked(fetchMagazineArticles).mockResolvedValue(PAGE);
    await user.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findAllByRole("article")).toHaveLength(ARTICLES.length);
  });

  it("hides staff publishing tools from the public page", async () => {
    renderPage();

    expect(await screen.findByRole("heading", { level: 1 })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /publish content/i })).toBeNull();
    expect(screen.queryByText(/publishing is open to dentists/i)).toBeNull();
  });
});
