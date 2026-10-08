"""Seed guard: listings need the reference data `seed_countries` writes.

A fresh database has no countries and no specialties, so the listing seed must
refuse with an actionable message instead of failing later on a KeyError or
inserting rows whose country does not exist.
"""

from __future__ import annotations

import pytest
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config import Settings
from app.repositories.database import Base
from app.scripts.seed_listings import seed
from app.utils.logger import configure_logging
from app.utils.state import AppState


async def test_seed_refuses_to_run_before_reference_data() -> None:
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")

    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

        state = AppState(
            settings=Settings.from_env(),
            logger=configure_logging(dev_mode=False, log_level="WARNING"),
            db_session_maker=async_sessionmaker(bind=engine, expire_on_commit=False),
        )

        with pytest.raises(RuntimeError, match="seed_countries"):
            await seed(state)
    finally:
        await engine.dispose()
