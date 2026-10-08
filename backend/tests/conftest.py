"""Shared pytest fixtures.

Every test runs against a throwaway in-memory SQLite database seeded with a
small, known catalog. Prices and thresholds are fixed (see `tests/factories.py`)
so the pricing tests can assert exact amounts.
"""

from __future__ import annotations

from collections.abc import AsyncIterator

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config import Settings
from app.dependencies import get_app_state
from app.main import create_app
from app.repositories.database import Base
from app.utils.logger import configure_logging
from app.utils.state import AppState
from tests.factories import build_countries, build_products, build_specialties


@pytest.fixture
async def session_maker() -> AsyncIterator[async_sessionmaker[AsyncSession]]:
    """In-memory session factory seeded with the test catalog."""
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")

    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

        factory = async_sessionmaker(bind=engine, expire_on_commit=False)

        async with factory() as session:
            # Reference data first: a listing's country_code is meaningless
            # without the market it names.
            for country in build_countries():
                session.add(country)
            await session.flush()

            for specialty in build_specialties():
                session.add(specialty)

            for supplier, products in build_products():
                session.add(supplier)
                await session.flush()
                for product in products:
                    product.supplier_id = supplier.id
                    session.add(product)
            await session.commit()

        yield factory
    finally:
        await engine.dispose()


@pytest.fixture
async def state(session_maker: async_sessionmaker[AsyncSession]) -> AppState:
    """AppState wired to the seeded in-memory database."""
    return AppState(
        settings=Settings.from_env(),
        logger=configure_logging(dev_mode=False, log_level="WARNING"),
        db_session_maker=session_maker,
    )


@pytest.fixture
async def client(state: AppState) -> AsyncIterator[AsyncClient]:
    """HTTP client bound to the app, with `state` injected via dependency override."""
    app = create_app()
    app.dependency_overrides[get_app_state] = lambda: state

    transport = ASGITransport(app=app)

    async with AsyncClient(transport=transport, base_url="http://test") as http:
        yield http

    app.dependency_overrides.clear()


@pytest.fixture
async def product_id(client: AsyncClient) -> str:
    """Id of a known product, resolved through the API rather than hardcoded."""
    response = await client.get("/api/v1/products", params={"q": "Adult Medium Toothbrush"})
    items: list[dict[str, str]] = response.json()["items"]
    return items[0]["id"]
