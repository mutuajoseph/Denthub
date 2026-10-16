"""Seed the whole demo catalogue from a single entrypoint (issue #70).

`render.yaml` used to chain six seed scripts in `preDeployCommand`, and every
one of those ran `alembic upgrade head` itself, so each deploy migrated seven
times. This entrypoint migrates once and then runs each seed in dependency
order. The six scripts stay independently runnable — this module reuses their
`seed()` functions rather than re-implementing them.

Order is significant: listings needs countries; jobs needs countries and
listings; training needs countries.

    uv run python -m app.scripts.seed_all
"""

from __future__ import annotations

import asyncio
from typing import Protocol

from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from structlog.typing import FilteringBoundLogger

from app.config import Settings
from app.scripts import (
    seed_countries,
    seed_jobs,
    seed_listings,
    seed_magazine,
    seed_products,
    seed_training,
)
from app.scripts.seed_products import run_migrations
from app.utils.logger import configure_logging
from app.utils.state import AppState
from app.utils.urls import describe_url


class _SeedScript(Protocol):
    """A seed module: anything exposing `seed(state)` (the six `seed_*` scripts)."""

    async def seed(self, state: AppState) -> None: ...


#: Dependency order. Do not reorder without checking each seed's guard: jobs
#: raise if countries or listings are missing.
SEEDERS: tuple[_SeedScript, ...] = (
    seed_products,
    seed_countries,
    seed_listings,
    seed_jobs,
    seed_magazine,
    seed_training,
)


async def seed_all(state: AppState) -> None:
    """Run every seed against one session maker, in dependency order."""
    for module in SEEDERS:
        await module.seed(state)


async def seed_database(settings: Settings, logger: FilteringBoundLogger) -> None:
    """Insert or update the whole demo catalogue, from a running event loop.

    Must be called from a *running* event loop. `migrations/env.py` calls
    `asyncio.run()` internally, so the migration itself has to happen from a
    synchronous entrypoint — see `main()`.
    """
    engine = create_async_engine(settings.database_url, echo=settings.dev_mode)

    state = AppState(
        settings=settings,
        logger=logger,
        db_session_maker=async_sessionmaker(bind=engine, expire_on_commit=False),
    )

    try:
        await seed_all(state)
    finally:
        await engine.dispose()


def main() -> None:
    """Migrate once, then run every seed."""
    settings = Settings.from_env()
    logger = configure_logging(dev_mode=settings.dev_mode, log_level=settings.log_level)

    # Alembic owns the schema. Do not call create_all here: it would emit
    # CREATE TABLE without recording a revision, leaving the DB stamped behind.
    # Runs outside the event loop because migrations/env.py calls asyncio.run().
    run_migrations()

    asyncio.run(seed_database(settings, logger))
    logger.info("seed.all.done", url=describe_url(settings.database_url))


if __name__ == "__main__":
    main()
