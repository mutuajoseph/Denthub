"""Guard for the single `seed_all` entrypoint (issue #70).

`render.yaml` used to chain six seed scripts, each of which ran
`alembic upgrade head` itself, so one deploy migrated seven times. `seed_all`
must migrate once and then run the seeds in dependency order
(products → countries → listings → jobs → magazine → training). Jobs require
countries + listings, so a wrong order raises rather than silently seeding
nothing.
"""

from __future__ import annotations

import asyncio

import pytest
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.config import Settings
from app.repositories.country import Country
from app.repositories.database import Base
from app.repositories.job import JobPosting
from app.repositories.product import Product
from app.repositories.training import TrainingProvider
from app.scripts import seed_all
from app.utils.logger import configure_logging
from app.utils.state import AppState

EXPECTED_ORDER = [
    "seed_products",
    "seed_countries",
    "seed_listings",
    "seed_jobs",
    "seed_magazine",
    "seed_training",
]


def _module_names() -> list[str]:
    return [module.__name__.rsplit(".", 1)[-1] for module in seed_all.SEEDERS]


def test_seeders_are_in_dependency_order() -> None:
    assert _module_names() == EXPECTED_ORDER


def test_main_migrates_once_then_seeds(monkeypatch: pytest.MonkeyPatch) -> None:
    calls: list[str] = []

    monkeypatch.setattr(seed_all, "run_migrations", lambda: calls.append("migrate"))

    async def fake_seed_database(settings: Settings, logger: object) -> None:
        calls.append("seed")

    def fake_asyncio_run(coro: object) -> None:
        # The real call is awaited inside `seed_database`; the fake never runs it,
        # so close it to keep the coroutine from being reported as never awaited.
        close = getattr(coro, "close", None)
        if close is not None:
            close()
        calls.append("run")

    monkeypatch.setattr(seed_all, "seed_database", fake_seed_database)
    monkeypatch.setattr(asyncio, "run", fake_asyncio_run)

    seed_all.main()

    assert calls == ["migrate", "run"]


def test_seed_all_calls_every_seeder_once(monkeypatch: pytest.MonkeyPatch) -> None:
    order: list[str] = []

    def record(name: str):  # noqa: ANN202 - test helper returning a coroutine function
        async def fake(state: AppState) -> None:
            order.append(name)

        return fake

    for module in seed_all.SEEDERS:
        monkeypatch.setattr(module, "seed", record(module.__name__.rsplit(".", 1)[-1]))

    asyncio.run(seed_all.seed_all(_empty_state()))

    assert order == EXPECTED_ORDER


def _empty_state() -> AppState:
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    return AppState(
        settings=Settings.from_env(),
        logger=configure_logging(dev_mode=False, log_level="WARNING"),
        db_session_maker=async_sessionmaker(bind=engine, expire_on_commit=False),
    )


async def test_seed_all_populates_the_catalogue_and_re_runs_cleanly() -> None:
    """End-to-end: the real seeds, in order, against an empty schema."""
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")

    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

        state = AppState(
            settings=Settings.from_env(),
            logger=configure_logging(dev_mode=False, log_level="WARNING"),
            db_session_maker=async_sessionmaker(bind=engine, expire_on_commit=False),
        )

        await seed_all.seed_all(state)

        async with state.db_session_maker() as session:
            countries = await session.scalar(select(func.count()).select_from(Country))
            products = await session.scalar(select(func.count()).select_from(Product))
            jobs = await session.scalar(select(func.count()).select_from(JobPosting))
            providers = await session.scalar(select(func.count()).select_from(TrainingProvider))

        assert countries and products and jobs and providers

        # Idempotent: a second run (every deploy re-seeds) must not raise or duplicate.
        await seed_all.seed_all(state)

        async with state.db_session_maker() as session:
            assert await session.scalar(select(func.count()).select_from(Country)) == countries
            assert await session.scalar(select(func.count()).select_from(Product)) == products
            assert await session.scalar(select(func.count()).select_from(JobPosting)) == jobs
    finally:
        await engine.dispose()
