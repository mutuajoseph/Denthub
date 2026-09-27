"""Seed the oral-care catalog with demo suppliers and products.

Idempotent: re-running updates the same rows keyed by supplier slug, so it is
safe to call more than once. Run with:

    uv run python -m app.scripts.seed_products
"""

from __future__ import annotations

import asyncio
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from structlog.typing import FilteringBoundLogger

from app.config import Settings
from app.repositories.product import Product, Supplier
from app.utils.logger import configure_logging
from app.utils.state import AppState

SUPPLIERS: list[dict[str, object]] = [
    {
        "slug": "nairobi-dental-supplies",
        "name": "Nairobi Dental Supplies",
        "country_code": "KE",
        "scope": "local",
        "is_verified": True,
        "description": "Nairobi-based distributor of everyday oral-care consumables.",
    },
    {
        "slug": "savannah-oral-wholesale",
        "name": "Savannah Oral Wholesale",
        "country_code": "KE",
        "scope": "local",
        "is_verified": True,
        "description": "Bulk supplier for clinics and facilities across East Africa.",
    },
    {
        "slug": "global-smile-imports",
        "name": "Global Smile Imports",
        "country_code": "KE",
        "scope": "international",
        "is_verified": False,
        "description": "Imports international brands into the Kenyan market.",
    },
]

# (supplier_slug, name, brand, category, retail, wholesale|None, min_qty, recommended, in_stock)
PRODUCTS: list[tuple[str, str, str | None, str, str, str | None, int, bool, bool]] = [
    (
        "nairobi-dental-supplies",
        "Adult Medium Toothbrush",
        "Oral-B",
        "brushing",
        "350",
        "260",
        12,
        True,
        True,
    ),
    (
        "nairobi-dental-supplies",
        "Sensitive Toothpaste 100ml",
        "Sensodyne",
        "toothpaste",
        "1250",
        "980",
        12,
        True,
        True,
    ),
    (
        "nairobi-dental-supplies",
        "Mint Dental Floss 50m",
        "Oral-B",
        "floss",
        "450",
        None,
        24,
        False,
        True,
    ),
    (
        "nairobi-dental-supplies",
        "Antibacterial Mouthwash 500ml",
        "Listerine",
        "mouthwash",
        "980",
        "740",
        12,
        False,
        True,
    ),
    (
        "nairobi-dental-supplies",
        "Whitening Strips 14ct",
        "Crest",
        "whitening",
        "2200",
        None,
        6,
        False,
        True,
    ),
    (
        "nairobi-dental-supplies",
        "Kids Bubblegum Toothbrush",
        "Colgate",
        "children",
        "300",
        "230",
        12,
        False,
        True,
    ),
    (
        "savannah-oral-wholesale",
        "Fluoride Varnish 5ml x10",
        "Duraphat",
        "specialty",
        "14500",
        "11800",
        6,
        True,
        True,
    ),
    (
        "savannah-oral-wholesale",
        "Composite Syringe Kit",
        "3M",
        "specialty",
        "9800",
        None,
        10,
        True,
        True,
    ),
    (
        "savannah-oral-wholesale",
        "Nitrile Gloves 100ct (box of 10)",
        "MediGuard",
        "specialty",
        "8500",
        "6900",
        10,
        False,
        True,
    ),
    (
        "savannah-oral-wholesale",
        "Prophy Angles 100ct",
        "Dentsply",
        "specialty",
        "6400",
        "5100",
        12,
        False,
        True,
    ),
    (
        "savannah-oral-wholesale",
        "Bulk Toothpaste 500ml (case of 12)",
        "Colgate",
        "toothpaste",
        "13200",
        "10500",
        4,
        False,
        True,
    ),
    (
        "global-smile-imports",
        "Electric Sonic Brush",
        "Philips Sonicare",
        "brushing",
        "12500",
        "9900",
        6,
        True,
        True,
    ),
    (
        "global-smile-imports",
        "Water Flosser",
        "Waterpik",
        "specialty",
        "18900",
        "15200",
        4,
        False,
        True,
    ),
    (
        "global-smile-imports",
        "X-Ray Sensor Holder",
        None,
        "specialty",
        "34000",
        None,
        2,
        False,
        False,
    ),
]


async def seed(state: AppState) -> None:
    """Insert or update the demo catalog."""
    async with state.db_session_maker() as session:
        by_slug: dict[str, Supplier] = {}

        for row in SUPPLIERS:
            existing = await session.execute(
                select(Supplier).where(Supplier.slug == str(row["slug"]))
            )
            supplier = existing.scalar_one_or_none()

            if supplier is None:
                supplier = Supplier(**row)
                session.add(supplier)
            else:
                for key, value in row.items():
                    setattr(supplier, key, value)

            by_slug[str(row["slug"])] = supplier

        await session.flush()

        supplier_country = {str(row["slug"]): str(row["country_code"]) for row in SUPPLIERS}

        for (
            supplier_slug,
            name,
            brand,
            category,
            retail,
            wholesale,
            min_qty,
            recommended,
            in_stock,
        ) in PRODUCTS:
            supplier = by_slug[supplier_slug]
            existing = await session.execute(
                select(Product).where(
                    Product.supplier_id == supplier.id,
                    Product.name == name,
                )
            )
            product = existing.scalar_one_or_none()

            values: dict[str, object] = {
                "brand": brand,
                "category": category,
                "retail_price": Decimal(retail),
                "wholesale_price": Decimal(wholesale) if wholesale else None,
                "wholesale_min_qty": min_qty,
                "dentist_recommended": recommended,
                "in_stock": in_stock,
                "country_code": supplier_country[supplier_slug],
            }

            if product is None:
                session.add(Product(supplier_id=supplier.id, name=name, **values))
            else:
                for key, value in values.items():
                    setattr(product, key, value)

        await session.commit()

    state.logger.info("seed.products", suppliers=len(SUPPLIERS), products=len(PRODUCTS))


def run_migrations() -> None:
    """Upgrade the configured database to the latest Alembic revision."""
    from pathlib import Path

    from alembic import command
    from alembic.config import Config

    ini_path = Path(__file__).resolve().parents[2] / "alembic.ini"
    command.upgrade(Config(str(ini_path)), "head")


def describe_url(url: str) -> str:
    """Render a database URL with its password masked, for logging.

    A production ``DATABASE_URL`` embeds credentials, so it must never reach a log
    sink verbatim.
    """
    from sqlalchemy.engine import make_url

    parsed = make_url(url)

    if parsed.password is None:
        return parsed.render_as_string(hide_password=False)

    return parsed.render_as_string(hide_password=True)


async def seed_database(settings: Settings, logger: FilteringBoundLogger) -> None:
    """Insert or update the demo catalog, upgrading the schema first.

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
        await seed(state)
    finally:
        await engine.dispose()


def main() -> None:
    """Migrate, then seed."""
    settings = Settings.from_env()
    logger = configure_logging(dev_mode=settings.dev_mode, log_level=settings.log_level)

    # Alembic owns the schema. Do not call create_all here: it would emit
    # CREATE TABLE without recording a revision, leaving the DB stamped behind.
    # Runs outside the event loop because migrations/env.py calls asyncio.run().
    run_migrations()

    asyncio.run(seed_database(settings, logger))
    logger.info("seed.done", url=describe_url(settings.database_url))


if __name__ == "__main__":
    main()
