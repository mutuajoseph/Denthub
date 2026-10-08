"""Seed the demo jobs board: postings attached to real seeded Branches.

The board's data model (root ``AGENTS.md`` glossary) has no "employers": a
posting belongs to a Branch, so every row here names a Facility and Branch that
`seed_listings` created, and a candidate links from a card to that practice.
Salary is per-row currency with ``NUMERIC(12,2)`` amounts, never a string.

Idempotent: a posting is keyed by ``(facility, branch, title)`` and its salary
rows and specialty links are replaced in place, so re-running updates the same
rows. Requires ``seed_countries`` and ``seed_listings`` to have run first.

Run with:

    uv run python -m app.scripts.seed_jobs
"""

from __future__ import annotations

import asyncio
from decimal import Decimal

from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from structlog.typing import FilteringBoundLogger

from app.config import Settings
from app.repositories.country import CountryRepository, SpecialtyRepository
from app.repositories.job import JobSalaryRange, JobsRepository
from app.repositories.listing import FacilityRepository
from app.utils.logger import configure_logging
from app.utils.state import AppState
from app.utils.urls import describe_url

#: (facility, country, branch, title, description, requirements|None,
#:  employment_type, seniority, (currency, min|None, max|None)|None, specialties)
JOB_ROWS: list[
    tuple[
        str,
        str,
        str,
        str,
        str,
        str | None,
        str,
        str,
        tuple[str, str, str | None] | None,
        list[str],
    ]
] = [
    (
        "SmileCare Dental Centre",
        "KE",
        "Westlands",
        "Associate Dentist",
        "Join a busy Westlands practice with a steady walk-in and recall base.",
        "BDS or equivalent; registered with the Kenya Dental Practitioners Board.",
        "Full Time",
        "Mid Level",
        ("KES", "120000", "180000"),
        ["general-dentistry", "orthodontics"],
    ),
    (
        "SmileCare Dental Centre",
        "KE",
        "Westlands",
        "Dental Receptionist",
        "First point of contact for patients, bookings, and records.",
        "Experience in front-office dental administration preferred.",
        "Part Time",
        "Entry Level",
        ("KES", "35000", "45000"),
        [],
    ),
    (
        "Upper Hill Dental Specialists",
        "KE",
        "Upper Hill",
        "Oral Surgeon",
        "Leading cases in a referral-only specialist practice.",
        "Specialist qualification in oral and maxillofacial surgery.",
        "Full Time",
        "Senior",
        ("KES", "300000", None),
        ["oral-surgery"],
    ),
    (
        "Coast Maxillofacial Centre",
        "KE",
        "Nyali",
        "Practice Manager",
        "Own operations, scheduling, and the P&L of a Mombasa specialty clinic.",
        None,
        "Full Time",
        "Senior",
        None,
        [],
    ),
    (
        "Lagos Dental Specialists",
        "NG",
        "Victoria Island",
        "Orthodontist",
        "Grow our aligner and brace caseload on the Island.",
        "Specialist qualification recognised by the Nigerian Dental Council.",
        "Contract",
        "Senior",
        ("NGN", "600000", "900000"),
        ["orthodontics"],
    ),
    (
        "Harborview Dental Studio",
        "US",
        "San Francisco",
        "Hygienist",
        "Deliver gentle, thorough hygiene care in a Bay Area studio.",
        "Active California RDH licence.",
        "Part Time",
        "Entry Level",
        ("USD", "45", "60"),
        ["general-dentistry"],
    ),
    (
        "Bosphorus Dental Studio",
        "TR",
        "Kadikoy",
        "Pediatric Dentist",
        "Build a calm, child-first practice for Istanbul families.",
        "Pedodontic specialisation; Turkish working fluency.",
        "Full Time",
        "Mid Level",
        ("TRY", "80", "120"),
        ["paediatric-dentistry"],
    ),
]


async def seed(state: AppState) -> None:
    """Insert or update the demo postings."""
    async with state.db_session_maker() as session:
        specialties = {row.code: row for row in await SpecialtyRepository.list_all(session)}
        if not specialties:
            raise RuntimeError(
                "No specialties found; run `python -m app.scripts.seed_countries` first."
            )

        countries = {row.code for row in await CountryRepository.list_active(session)}
        needed = {row[1] for row in JOB_ROWS}
        missing = sorted(needed - countries)
        if missing:
            raise RuntimeError(
                f"Countries not seeded: {', '.join(missing)}; "
                "run `python -m app.scripts.seed_countries` first."
            )

        #: (facility, country) -> (branch_id, subdivision_code)
        branches: dict[tuple[str, str], tuple[str, str]] = {}

        for facility_name, country_code, branch_name, *_ in JOB_ROWS:
            key = (facility_name, country_code)
            if key in branches:
                continue

            facility = await FacilityRepository.find(
                session, name=facility_name, country_code=country_code
            )
            if facility is None:
                raise RuntimeError(
                    f"Facility '{facility_name}' is not seeded; "
                    "run `python -m app.scripts.seed_listings` first."
                )

            # `get` eager-loads branches so the by-name lookup below stays async.
            loaded = await FacilityRepository.get(session, facility.id)
            assert loaded is not None
            facility = loaded

            branches_by_name = {
                branch.name: branch for branch in facility.branches if branch.name is not None
            }
            branch = branches_by_name.get(branch_name)
            if branch is None:
                raise RuntimeError(
                    f"Branch '{branch_name}' of '{facility_name}' is not seeded; "
                    "run `python -m app.scripts.seed_listings` first."
                )
            branches[key] = (branch.id, branch.subdivision_code)

        for (
            facility_name,
            country_code,
            _branch_name,
            title,
            description,
            requirements,
            employment_type,
            seniority,
            salary,
            specialty_codes,
        ) in JOB_ROWS:
            (branch_id, subdivision_code) = branches[(facility_name, country_code)]
            posting = await JobsRepository.find(session, title=title, branch_id=branch_id)

            values: dict[str, object] = {
                "title": title,
                "description": description,
                "requirements": requirements,
                "country_code": country_code,
                "subdivision_code": subdivision_code,
                "employment_type": employment_type,
                "seniority": seniority,
                "status": "published",
            }

            if posting is None:
                posting = await JobsRepository.create(session, branch_id=branch_id, **values)
            else:
                posting = await JobsRepository.update(posting, **values)

            if salary is None:
                await JobsRepository.replace_salary_ranges(session, posting, [])
            else:
                currency, minimum, maximum = salary
                await JobsRepository.replace_salary_ranges(
                    session,
                    posting,
                    [
                        JobSalaryRange(
                            currency=currency,
                            min_amount=Decimal(minimum),
                            max_amount=Decimal(maximum) if maximum else None,
                        )
                    ],
                )

            chosen = [specialties[code] for code in specialty_codes]
            await JobsRepository.replace_specialties(session, posting, chosen)

        await session.commit()

    state.logger.info("seed.jobs", postings=len(JOB_ROWS))


async def seed_database(settings: Settings, logger: FilteringBoundLogger) -> None:
    """Insert or update the demo postings, from a running event loop."""
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
    logger.info("seed.jobs.done", url=describe_url(settings.database_url))


if __name__ == "__main__":
    main()
