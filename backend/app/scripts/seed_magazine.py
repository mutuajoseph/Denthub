"""Seed the magazine with demo articles for each market.

Idempotent: re-running updates the same rows keyed by slug, so it is safe to
call more than once. On purpose it also seeds a draft and a scheduled story, so
the public endpoints demonstrate they never serve an unpublished article. Run
with:

    uv run python -m app.scripts.seed_magazine
"""

from __future__ import annotations

import asyncio
from datetime import datetime

from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from structlog.typing import FilteringBoundLogger

from app.config import Settings
from app.repositories.magazine import MagazineRepository
from app.utils.logger import configure_logging
from app.utils.state import AppState
from app.utils.urls import describe_url

#: (country_code, slug, title, standfirst, body, author, category, is_featured,
#:  status, published_at, tags)
ARTICLES: list[tuple[str, str, str, str, str, str, str, bool, str, str, list[str]]] = [
    (
        "KE",
        "orthodontic-care-in-kenya",
        "Orthodontic Care in Kenya Is Growing Up",
        (
            "Braces are no longer a teenager's rite of passage: clear aligners "
            "and adult cases are reshaping Kenyan orthodontics."
        ),
        (
            "## A market in motion\n\n"
            "Orthodontic clinics in Nairobi and Mombasa report that adult "
            "patients now make up close to half of new aligner cases.\n\n"
            "- Clear aligner providers have multiplied.\n"
            "- Monthly payment plans are becoming common.\n"
            "- Retention care is the next frontier.\n\n"
            "Book a [specialist consultation](https://denthub.co.ke) to see "
            "what fits your bite."
        ),
        "Dr. Wanjiku Kamau",
        "patient-care",
        True,
        "published",
        "2026-10-03T08:00:00",
        ["orthodontics", "aligners", "costs"],
    ),
    (
        "KE",
        "does-nhif-cover-dental",
        "Does NHIF Cover Dental Treatment?",
        (
            "A plain-language rundown of what Kenya's national scheme pays "
            "for, what it does not, and what you will cover yourself."
        ),
        (
            "NHIF dental cover is partial and procedure-dependent. Extractions "
            "and simple fillings are usually covered; implants and cosmetic "
            "work are not.\n\n"
            "_Always confirm the current benefit list before you book._"
        ),
        "Grace Mwende",
        "insurance",
        False,
        "published",
        "2026-09-18T09:30:00",
        ["insurance", "nhif", "costs"],
    ),
    (
        "KE",
        "paediatric-first-visit",
        "A Paediatric Dentist's Guide to the First Visit",
        (
            "How to make a child's first dental appointment uneventful - and "
            "why it matters for a lifetime of good habits."
        ),
        (
            "Keep the first visit short, positive, and free of surprises.\n\n"
            "1. Talk about the trip beforehand in neutral language.\n"
            "2. Let the dentist lead the conversation.\n"
            "3. Celebrate a normal visit with real praise."
        ),
        "Dr. Amina Otieno",
        "patient-care",
        False,
        "published",
        "2026-08-05T07:00:00",
        ["paediatric", "first-visit"],
    ),
    (
        "KE",
        "teledentistry-kenya",
        "Teledentistry Comes to Kenyan Clinics",
        ("Remote triage is trimming waiting rooms, but a screen can only take a diagnosis so far."),
        (
            "Video triage is fastest for a mild toothache or a broken bracket. "
            "Anything involving swelling, bleeding, or pain that wakes you "
            "should still be seen in person, today.\n\n"
            "**When in doubt, see a clinic.**"
        ),
        "Mwangi Njoroge",
        "technology",
        False,
        "published",
        "2026-07-14T10:00:00",
        ["technology", "teledentistry"],
    ),
    (
        "KE",
        "whitening-vs-veneers",
        "Whitening or Veneers? What Dentists Actually Recommend",
        ("The two are not interchangeable. Here is how Kenyan dentists decide between them."),
        (
            "Whitening lifts stains out of the enamel. Veneers rebuild the "
            "surface of the tooth. The right answer depends entirely on your "
            "enamel and what is discolouring it."
        ),
        "Dr. Brian Kipchumba",
        "treatments",
        False,
        "published",
        "2026-06-20T12:00:00",
        ["whitening", "veneers", "treatments"],
    ),
    (
        "KE",
        "implant-pricing-primer",
        "An Implant Pricing Primer (Draft)",
        ("Not yet published: this draft must never appear on the board."),
        "Implant pricing in Kenya varies wildly with the component set and the surgeon.",
        "Dr. Brian Kipchumba",
        "treatments",
        False,
        "draft",
        "2026-10-08T00:00:00",
        ["implants", "costs"],
    ),
    (
        "KE",
        "sugar-tax-dental-impact",
        "Anticipating the Sugar Tax's Dental Impact (Scheduled)",
        ("Not yet published: scheduled next month, and must stay hidden until then."),
        (
            "Public-health dentists expect the sugar tax to bend consumption "
            "curves within a few years."
        ),
        "Grace Mwende",
        "policy",
        False,
        "scheduled",
        "2026-11-15T08:00:00",
        ["policy", "nutrition"],
    ),
    (
        "NG",
        "fluoride-lagos-water",
        "Fluoride and Lagos Water: Sorting Fact From Rumor",
        (
            "What Nigerian dentists want patients to understand about fluoride "
            "in the public water supply."
        ),
        (
            "Community water fluoridation in Nigeria is uneven, and bottled "
            "water is rarely fluoridated. Topical fluoride from toothpaste "
            "remains the most reliable daily protection."
        ),
        "Dr. Ngozi Adeyemi",
        "public-health",
        True,
        "published",
        "2026-09-30T08:00:00",
        ["fluoride", "public-health"],
    ),
    (
        "NG",
        "dental-tourism-trends",
        "Why Dental Tourism Is Flowing to Lagos",
        (
            "Price differences and shorter waits are drawing patients south; "
            "Kenya's clinics are watching closely."
        ),
        (
            "Lagos clinics report rising international bookings for implants "
            "and full-mouth rehab at a fraction of European prices."
        ),
        "Tunde Bakare",
        "industry",
        False,
        "published",
        "2026-08-22T09:00:00",
        ["industry", "tourism"],
    ),
]


async def seed(state: AppState) -> None:
    """Insert or update the demo articles."""
    async with state.db_session_maker() as session:
        for (
            country_code,
            slug,
            title,
            standfirst,
            body,
            author_name,
            category,
            is_featured,
            status,
            published_at,
            tags,
        ) in ARTICLES:
            article = await MagazineRepository.find_by_slug(session, slug)
            values: dict[str, object] = {
                "country_code": country_code,
                "title": title,
                "standfirst": standfirst,
                "body": body,
                "author_name": author_name,
                "category": category,
                "is_featured": is_featured,
                "status": status,
                "published_at": datetime.fromisoformat(published_at),
            }

            if article is None:
                article = await MagazineRepository.create(session, slug=slug, **values)
            else:
                await MagazineRepository.update(article, **values)

            await MagazineRepository.replace_tags(session, article, tags)

        await session.commit()

    state.logger.info(
        "seed.magazine",
        articles=len(ARTICLES),
    )


def run_migrations() -> None:
    """Upgrade the configured database to the latest Alembic revision."""
    from pathlib import Path

    from alembic import command
    from alembic.config import Config

    ini_path = Path(__file__).resolve().parents[2] / "alembic.ini"
    command.upgrade(Config(str(ini_path)), "head")


async def seed_database(settings: Settings, logger: FilteringBoundLogger) -> None:
    """Insert or update the demo articles, upgrading the schema first."""
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

    run_migrations()

    asyncio.run(seed_database(settings, logger))
    logger.info("seed.done", url=describe_url(settings.database_url))


if __name__ == "__main__":
    main()
