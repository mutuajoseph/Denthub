"""Seed guard: the training seed needs the reference data and converges.

A course and a webinar live under a provider that belongs to a Country, and the
seed keys everything on ``(name, country)`` or ``(title, provider)``, so it must
refuse with an actionable message when ``seed_countries`` has not run, and a
re-run must converge on the same rows instead of duplicating.
"""

from __future__ import annotations

import pytest
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.config import Settings
from app.repositories.database import Base
from app.repositories.training import (
    TrainingCourse,
    TrainingProvider,
    TrainingWebinar,
)
from app.scripts.seed_training import seed
from app.utils.logger import configure_logging
from app.utils.state import AppState
from tests.factories import build_countries


async def _guard_state() -> tuple[create_async_engine, AppState]:
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    state = AppState(
        settings=Settings.from_env(),
        logger=configure_logging(dev_mode=False, log_level="WARNING"),
        db_session_maker=async_sessionmaker(bind=engine, expire_on_commit=False),
    )
    return engine, state


async def test_seed_refuses_to_run_before_reference_data() -> None:
    engine, state = await _guard_state()

    try:
        with pytest.raises(RuntimeError, match="seed_countries"):
            await seed(state)
    finally:
        await engine.dispose()


async def test_seed_is_idempotent() -> None:
    """Running the seed twice converges: same providers, courses, webinars."""
    engine, state = await _guard_state()

    try:
        async with state.db_session_maker() as session:
            for country in build_countries():
                session.add(country)
            await session.commit()

        for _ in range(2):
            await seed(state)

        async with state.db_session_maker() as session:
            providers = (
                await session.execute(select(func.count()).select_from(TrainingProvider))
            ).scalar_one()
            courses = (
                await session.execute(select(func.count()).select_from(TrainingCourse))
            ).scalar_one()
            webinars = (
                await session.execute(select(func.count()).select_from(TrainingWebinar))
            ).scalar_one()

        assert providers == 3
        assert courses == 5
        assert webinars == 3
    finally:
        await engine.dispose()