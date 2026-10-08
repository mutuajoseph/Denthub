"""Seed the demo CPD training catalogue: providers, courses, and webinars.

Kenya is the only market seeded with training: Nigeria's ``CPD_TRAINING`` flag
is off (``seed_countries``), so seeding rows there would make the disabled plate
look served. A course price is nullable and, when set, carries a ``currency`` on
the same row (``NUMERIC(12,2)``), never a bare number. Webinar starts are real
timestamps computed relative to "today" so the upcoming/archive split always
holds whenever the seed runs.

Idempotent: a provider is keyed by ``(name, country_code)`` and a course or
webinar by ``(title, provider)``, with fields updated in place, so re-running
converges instead of duplicating. Requires ``seed_countries`` first.

Run with:

    uv run python -m app.scripts.seed_training
"""

from __future__ import annotations

import asyncio
from datetime import UTC, datetime, timedelta
from decimal import Decimal

from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from structlog.typing import FilteringBoundLogger

from app.config import Settings
from app.repositories.country import CountryRepository
from app.repositories.training import TrainingProvider, TrainingRepository
from app.utils.logger import configure_logging
from app.utils.state import AppState
from app.utils.urls import describe_url

#: (name, country_code, is_verified)
PROVIDERS: list[tuple[str, str, bool]] = [
    ("Nairobi Dental Academy", "KE", True),
    ("DentHub Learning", "KE", True),
    ("Coast Dental Institute", "KE", False),
]

#: (provider, country, subdivision, title, description, delivery_mode,
#:  (currency, price)|None)
COURSE_ROWS: list[tuple[str, str, str, str, str, str, tuple[str, str] | None]] = [
    (
        "Nairobi Dental Academy",
        "KE",
        "NAIROBI",
        "Rotative Endodontics Essentials",
        "Two days of hands-on rotary endodontics with fresh cases.",
        "in_person",
        ("KES", "45000"),
    ),
    (
        "Nairobi Dental Academy",
        "KE",
        "MOMBASA",
        "Clear Aligner Case Planning",
        "Selection, staging, and retention of aligner cases.",
        "in_person",
        ("KES", "78000"),
    ),
    (
        "DentHub Learning",
        "KE",
        "NAIROBI",
        "Implant Planning for the General Dentist",
        "A six-week online course on assessment and planning for implants.",
        "online",
        ("KES", "32000"),
    ),
    (
        "DentHub Learning",
        "KE",
        "NAIROBI",
        "Digital Impressions & CAD/CAM",
        "Scan-to-mill workflows for the modern practice.",
        "online",
        ("KES", "24000"),
    ),
    (
        "Coast Dental Institute",
        "KE",
        "NAIROBI",
        "Hands-on Suturing Refresher",
        "Free CPD: knot-tying and soft-tissue closure drills.",
        "blended",
        None,
    ),
]

#: (provider, country, title, description, days_from_now, join_url)
WEBINAR_ROWS: list[tuple[str, str, str, str, int, str]] = [
    (
        "Nairobi Dental Academy",
        "KE",
        "Articulation in Complete Dentures",
        "Recording and transferring jaw relations predictably.",
        -5,
        "https://denthub.test/webinar/articulation",
    ),
    (
        "Nairobi Dental Academy",
        "KE",
        "Infection Control Update 2026",
        "The year's changes in sterilisation and disinfection.",
        7,
        "https://denthub.test/webinar/infection-control",
    ),
    (
        "DentHub Learning",
        "KE",
        "Running a Modern Dental Practice",
        "Scheduling, pricing, and retention for growing clinics.",
        21,
        "https://denthub.test/webinar/practice-management",
    ),
]


async def seed(state: AppState) -> None:
    """Insert or update the demo training catalogue."""
    now = datetime.now(UTC).replace(tzinfo=None)

    async with state.db_session_maker() as session:
        countries = {row.code for row in await CountryRepository.list_active(session)}
        needed = (
            {row[1] for row in PROVIDERS}
            | {row[1] for row in COURSE_ROWS}
            | {row[1] for row in WEBINAR_ROWS}
        )
        missing = sorted(needed - countries)
        if missing:
            raise RuntimeError(
                f"Countries not seeded: {', '.join(missing)}; "
                "run `python -m app.scripts.seed_countries` first."
            )

        # (name, country_code) -> provider row
        providers: dict[tuple[str, str], TrainingProvider] = {}

        for name, country_code, is_verified in PROVIDERS:
            provider = await TrainingRepository.find_provider(
                session, name=name, country_code=country_code
            )
            if provider is None:
                provider = await TrainingRepository.create_provider(
                    session,
                    name=name,
                    country_code=country_code,
                    is_verified=is_verified,
                )
            else:
                provider.is_verified = is_verified
                await session.flush()
            providers[(name, country_code)] = provider

        for (
            provider_name,
            country_code,
            subdivision_code,
            title,
            description,
            delivery_mode,
            money,
        ) in COURSE_ROWS:
            provider = providers[(provider_name, country_code)]
            course = await TrainingRepository.find_course(
                session, title=title, provider_id=provider.id
            )

            values: dict[str, object] = {
                "description": description,
                "country_code": country_code,
                "subdivision_code": subdivision_code,
                "delivery_mode": delivery_mode,
                "price": Decimal(money[1]) if money else None,
                "currency": money[0] if money else None,
            }

            if course is None:
                await TrainingRepository.create_course(
                    session, title=title, provider_id=provider.id, **values
                )
            else:
                await TrainingRepository.update_course(course, **values)

        for (
            provider_name,
            country_code,
            title,
            description,
            days_from_now,
            join_url,
        ) in WEBINAR_ROWS:
            provider = providers[(provider_name, country_code)]
            webinar = await TrainingRepository.find_webinar(
                session, title=title, provider_id=provider.id
            )

            values = {
                "description": description,
                "country_code": country_code,
                "join_url": join_url,
                "scheduled_start": now + timedelta(days=days_from_now),
            }

            if webinar is None:
                await TrainingRepository.create_webinar(
                    session, title=title, provider_id=provider.id, **values
                )
            else:
                await TrainingRepository.update_webinar(webinar, **values)

        await session.commit()

    state.logger.info(
        "seed.training",
        providers=len(PROVIDERS),
        courses=len(COURSE_ROWS),
        webinars=len(WEBINAR_ROWS),
    )


async def seed_database(settings: Settings, logger: FilteringBoundLogger) -> None:
    """Insert or update the demo catalogue, from a running event loop."""
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
    from app.scripts.seed_products import run_migrations

    settings = Settings.from_env()
    logger = configure_logging(dev_mode=settings.dev_mode, log_level=settings.log_level)

    run_migrations()
    asyncio.run(seed_database(settings, logger))
    logger.info("seed.training.done", url=describe_url(settings.database_url))


if __name__ == "__main__":
    main()
