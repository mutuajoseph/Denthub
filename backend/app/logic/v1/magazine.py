"""Magazine logic: published articles, category rollups, and serialization.

The magazine is an always-on public module (PRD §2) shared across markets, so
it has no capability flag: rows are filtered by exactly the market asked for
and an unconfigured country produces an empty page rather than a 503, the same
behaviour as the product catalog. ``country`` is a filter, not a gate.

List endpoints return summaries without ``body``; the detail endpoint returns
the full Markdown. Only ``published`` rows are reachable either way.
"""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel

from app.exceptions import NotFoundException
from app.repositories.magazine import MagazineArticle, MagazineFilters, MagazineRepository
from app.utils.state import AppState

MAX_PAGE_SIZE = 100
DEFAULT_PAGE_SIZE = 12


class MagazineArticleSummary(BaseModel):
    """A list-row article: everything a card needs, without the body."""

    id: str
    slug: str
    title: str
    standfirst: str
    hero_image_url: str | None
    author_name: str
    category: str
    country_code: str
    is_featured: bool
    tags: list[str]
    published_at: datetime


class MagazineArticleDetail(MagazineArticleSummary):
    """One full article, body included."""

    body: str
    updated_at: datetime


class MagazinePage(BaseModel):
    """One page of published articles for a market."""

    items: list[MagazineArticleSummary]
    total: int
    limit: int
    offset: int
    country_code: str


class MagazineCategoryList(BaseModel):
    """Categories a country's published articles use."""

    country_code: str
    categories: list[str]


def _validate_limit(limit: int) -> int:
    return max(1, min(limit, MAX_PAGE_SIZE))


def _tag_names(article: MagazineArticle) -> list[str]:
    return [row.tag for row in article.tags]


def _serialize_summary(article: MagazineArticle) -> MagazineArticleSummary:
    return MagazineArticleSummary(
        id=article.id,
        slug=article.slug,
        title=article.title,
        standfirst=article.standfirst,
        hero_image_url=article.hero_image_url,
        author_name=article.author_name,
        category=article.category,
        country_code=article.country_code,
        is_featured=article.is_featured,
        tags=_tag_names(article),
        published_at=article.published_at,
    )


def _serialize_detail(article: MagazineArticle) -> MagazineArticleDetail:
    return MagazineArticleDetail(
        **_serialize_summary(article).model_dump(),
        body=article.body,
        updated_at=article.updated_at,
    )


async def list_articles(
    state: AppState,
    *,
    country_code: str,
    category: str | None = None,
    tag: str | None = None,
    limit: int = DEFAULT_PAGE_SIZE,
    offset: int = 0,
) -> MagazinePage:
    """One page of published articles for a market."""
    page_size = _validate_limit(limit)
    start = max(0, offset)

    filters = MagazineFilters(
        country_code=country_code.upper(),
        category=category,
        tag=tag,
    )

    async with state.db_session_maker() as session:
        rows = await MagazineRepository.search(session, filters, limit=page_size, offset=start)
        total = await MagazineRepository.count(session, filters)

    return MagazinePage(
        items=[_serialize_summary(row) for row in rows],
        total=total,
        limit=page_size,
        offset=start,
        country_code=filters.country_code,
    )


async def get_article(state: AppState, *, slug: str) -> MagazineArticleDetail:
    """One published article by slug, or 404."""
    async with state.db_session_maker() as session:
        article = await MagazineRepository.get_by_slug(session, slug)

        if article is None:
            raise NotFoundException(message="Article not found")

        return _serialize_detail(article)


async def list_categories(state: AppState, *, country_code: str) -> MagazineCategoryList:
    """The categories of a country's published articles."""
    code = country_code.upper()

    async with state.db_session_maker() as session:
        categories = await MagazineRepository.list_categories(session, country_code=code)

    return MagazineCategoryList(country_code=code, categories=categories)
