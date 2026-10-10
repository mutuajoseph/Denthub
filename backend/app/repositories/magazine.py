"""Magazine: published articles/videos and their tag join.

The magazine publishes two content types (PRD §3.8, §4): ``article`` rows carry
a Markdown ``body``, ``video`` rows carry a YouTube ``video_url`` instead (the
body stays a summary). ``content_type`` distinguishes them and defaults to
``article``. ``body`` holds Markdown; the public client renders a safe subset
(headings, paragraphs, bold, italic, bullets, links) and HTML-escapes
everything else, so a stray angle bracket renders as text. ``status`` defaults
to ``published`` and every public read path selects only published rows, so a
draft or scheduled story can never leak by guessing a slug.

Tags live on a join table (``magazine_article_tags``) but are plain strings,
not a dimension table - a country's tag set is whatever its published articles
use, which keeps the endpoint that filters by ``tag`` and the category rollup
both satisfied without a third catalog.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text, delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Mapped, mapped_column, relationship, selectinload
from sqlalchemy.sql.expression import ColumnElement

from app.repositories.database import Base


class MagazineArticle(Base):
    """A magazine story: summary fields up top, the Markdown body below."""

    __tablename__ = "magazine_articles"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )
    slug: Mapped[str] = mapped_column(String(160), nullable=False, unique=True, index=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    standfirst: Mapped[str] = mapped_column(Text, nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    hero_image_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    author_name: Mapped[str] = mapped_column(String(120), nullable=False, index=True)
    category: Mapped[str] = mapped_column(String(50), nullable=False, index=True)

    #: ``article`` or ``video`` (PRD §3.8). Set from a controlled vocabulary in
    #: logic; videos carry a YouTube ``video_url`` and never a Markdown body.
    content_type: Mapped[str] = mapped_column(
        String(20), default="article", nullable=False, index=True
    )
    video_url: Mapped[str | None] = mapped_column(String(500), nullable=True)

    country_code: Mapped[str] = mapped_column(String(2), default="KE", index=True, nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="published", nullable=False, index=True)
    is_featured: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    #: When the story went, or goes, live. The list is ordered newest first.
    published_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), nullable=False, index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    tags: Mapped[list[MagazineArticleTag]] = relationship(
        back_populates="article",
        cascade="all, delete-orphan",
        order_by="MagazineArticleTag.tag",
    )


class MagazineArticleTag(Base):
    """One tag on one article; the pair is the key, no separate tag catalog."""

    __tablename__ = "magazine_article_tags"

    article_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("magazine_articles.id", ondelete="CASCADE"),
        primary_key=True,
    )
    tag: Mapped[str] = mapped_column(String(50), primary_key=True)

    article: Mapped[MagazineArticle] = relationship(back_populates="tags")


class MagazineFilters:
    """Filter set shared by :meth:`MagazineRepository.search` and ``count``.

    ``status`` is locked to ``published`` here: the public magazine never
    serves a draft, so a caller cannot ask the repository to hand one over.
    """

    def __init__(
        self,
        *,
        country_code: str,
        category: str | None = None,
        tag: str | None = None,
    ) -> None:
        self.country_code = country_code
        self.category = category
        self.tag = tag

    def conditions(self) -> list[ColumnElement[bool]]:
        clauses: list[ColumnElement[bool]] = [
            MagazineArticle.status == "published",
            MagazineArticle.country_code == self.country_code,
        ]

        if self.category:
            clauses.append(MagazineArticle.category == self.category)

        return clauses


class MagazineRepository:
    """Reads and writes for the magazine."""

    @staticmethod
    async def search(
        session: AsyncSession,
        filters: MagazineFilters,
        *,
        limit: int,
        offset: int,
    ) -> list[MagazineArticle]:
        """One page of published articles, newest first, tags eager-loaded."""
        stmt = (
            select(MagazineArticle)
            .options(selectinload(MagazineArticle.tags))
            .where(*filters.conditions())
            .order_by(MagazineArticle.published_at.desc(), MagazineArticle.slug.asc())
            .limit(limit)
            .offset(offset)
        )

        if filters.tag:
            stmt = stmt.join(
                MagazineArticleTag,
                MagazineArticleTag.article_id == MagazineArticle.id,
            ).where(MagazineArticleTag.tag == filters.tag)

        result = await session.execute(stmt)
        return list(result.scalars().unique().all())

    @staticmethod
    async def count(session: AsyncSession, filters: MagazineFilters) -> int:
        """Count published articles matching the same filters :meth:`search` applies."""
        stmt = select(func.count()).select_from(MagazineArticle).where(*filters.conditions())

        if filters.tag:
            stmt = stmt.join(
                MagazineArticleTag,
                MagazineArticleTag.article_id == MagazineArticle.id,
            ).where(MagazineArticleTag.tag == filters.tag)

        result = await session.execute(stmt)
        return int(result.scalar_one())

    @staticmethod
    async def get_by_slug(session: AsyncSession, slug: str) -> MagazineArticle | None:
        """One published article with its tags, or ``None``."""
        stmt = (
            select(MagazineArticle)
            .options(selectinload(MagazineArticle.tags))
            .where(
                MagazineArticle.slug == slug,
                MagazineArticle.status == "published",
            )
        )
        result = await session.execute(stmt)
        return result.scalar_one_or_none()

    @staticmethod
    async def list_categories(session: AsyncSession, *, country_code: str) -> list[str]:
        """The distinct categories of a country's published articles."""
        stmt = (
            select(MagazineArticle.category)
            .where(
                MagazineArticle.status == "published",
                MagazineArticle.country_code == country_code,
            )
            .distinct()
            .order_by(MagazineArticle.category.asc())
        )
        result = await session.execute(stmt)
        return list(result.scalars().all())

    @staticmethod
    async def find_by_slug(session: AsyncSession, slug: str) -> MagazineArticle | None:
        """Look an article up by its natural key, for an idempotent seed."""
        result = await session.execute(select(MagazineArticle).where(MagazineArticle.slug == slug))
        return result.scalar_one_or_none()

    @staticmethod
    async def create(session: AsyncSession, **kwargs: Any) -> MagazineArticle:
        """Create and persist a MagazineArticle."""
        article = MagazineArticle(**kwargs)
        session.add(article)
        await session.flush()
        return article

    @staticmethod
    async def update(article: MagazineArticle, **kwargs: Any) -> MagazineArticle:
        """Apply ``kwargs`` to an existing article (idempotent seed)."""
        for key, value in kwargs.items():
            setattr(article, key, value)
        return article

    @staticmethod
    async def replace_tags(
        session: AsyncSession,
        article: MagazineArticle,
        tags: list[str],
    ) -> None:
        """Make ``tags`` exactly the article's rows (idempotent seed).

        Replaces the collection via explicit delete and insert rather than
        reassigning the relationship: ``article.tags`` may not be loaded, and a
        relationship setter lazy-loads it, which is illegal in an async session.
        """
        await session.execute(
            delete(MagazineArticleTag).where(MagazineArticleTag.article_id == article.id)
        )
        for tag in dict.fromkeys(tags):
            session.add(MagazineArticleTag(article_id=article.id, tag=tag))
        await session.flush()
