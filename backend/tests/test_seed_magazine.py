"""Seed guard: the magazine seed converges on re-runs and hides unpublished rows."""

from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.config import Settings
from app.repositories.database import Base
from app.repositories.magazine import MagazineArticle
from app.scripts.seed_magazine import ARTICLES, VIDEOS, seed
from app.utils.logger import configure_logging
from app.utils.state import AppState


async def _count_by_status(state: AppState) -> dict[str, int]:
    async with state.db_session_maker() as session:
        rows = await session.execute(
            select(MagazineArticle.status, func.count()).group_by(MagazineArticle.status)
        )
        return {status: count for status, count in rows.all()}


async def test_seed_is_idempotent_and_writes_unpublished_rows() -> None:
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")

    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

        state = AppState(
            settings=Settings.from_env(),
            logger=configure_logging(dev_mode=False, log_level="WARNING"),
            db_session_maker=async_sessionmaker(bind=engine, expire_on_commit=False),
        )

        await seed(state)
        first = await _count_by_status(state)
        assert sum(first.values()) == len(ARTICLES) + len(VIDEOS)
        # Drafts and scheduled stories are seeded on purpose, so the API has
        # something to prove it never serves them.
        assert first["published"] == 14
        assert first["draft"] == 1
        assert first["scheduled"] == 1

        # Re-running converges rather than accumulating duplicates.
        await seed(state)
        second = await _count_by_status(state)
        assert second == first
    finally:
        await engine.dispose()
