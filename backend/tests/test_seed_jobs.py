"""Seed guard: the jobs board seed needs the reference data and the listings.

A posting is attached to a real Branch, so the seed must refuse with an
actionable message when either the reference data (`seed_countries`) or the
Workplaces (`seed_listings`) it builds on are missing, instead of failing later
on a KeyError or a lazy-load. The idempotent replace paths (salary rows,
specialty links) are pinned separately so the seed loop cannot accumulate
duplicates on re-run.
"""

from __future__ import annotations

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.config import Settings
from app.repositories.country import Country, SpecialtyRepository
from app.repositories.database import Base
from app.repositories.job import (
    JobPosting,
    JobPostingSpecialty,
    JobSalaryRange,
    JobsRepository,
)
from app.scripts.seed_jobs import seed
from app.utils.logger import configure_logging
from app.utils.state import AppState
from tests.factories import build_countries, build_listings, build_specialties


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


#: The JOB_ROWS seed data spans KE, NG, US, TR; the country guard needs them all.
EXTRA_COUNTRIES = [
    {
        "code": "US",
        "name": "United States",
        "currency": "USD",
        "currency_symbol": "$",
        "locale": "en-US",
        "default_locale": "en",
        "domain": "denthub.com",
        "phone_prefix": "+1",
        "subdivision_label": "State",
        "subdivision_label_plural": "States",
        "city_label": "City",
        "timezone": "America/Los_Angeles",
    },
    {
        "code": "TR",
        "name": "Türkiye",
        "currency": "TRY",
        "currency_symbol": "₺",
        "locale": "tr-TR",
        "default_locale": "tr",
        "domain": "denthub.com.tr",
        "phone_prefix": "+90",
        "subdivision_label": "Province",
        "subdivision_label_plural": "Provinces",
        "city_label": "City",
        "timezone": "Europe/Istanbul",
    },
]


async def test_seed_refuses_to_run_before_reference_data() -> None:
    engine, state = await _guard_state()

    try:
        with pytest.raises(RuntimeError, match="seed_countries"):
            await seed(state)
    finally:
        await engine.dispose()


async def test_seed_refuses_to_run_before_listings() -> None:
    engine, state = await _guard_state()

    try:
        async with state.db_session_maker() as session:
            for country in [*build_countries(), *[Country(**row) for row in EXTRA_COUNTRIES]]:
                session.add(country)
            for specialty in build_specialties():
                session.add(specialty)
            await session.commit()

        with pytest.raises(RuntimeError, match="seed_listings"):
            await seed(state)
    finally:
        await engine.dispose()


async def test_salary_and_specialty_replace_is_idempotent() -> None:
    """The seed loop deletes then inserts, so a re-run cannot duplicate rows."""
    engine, state = await _guard_state()

    try:
        async with state.db_session_maker() as session:
            for country in build_countries():
                session.add(country)
            for specialty in build_specialties():
                session.add(specialty)
            facilities, _ = build_listings(await SpecialtyRepository.list_all(session))
            for facility in facilities:
                session.add(facility)
            await session.flush()

            posting = await JobsRepository.create(
                session,
                title="Associate Dentist",
                description="demo",
                country_code="KE",
                subdivision_code="NAIROBI",
                employment_type="Full Time",
                seniority="Mid Level",
                branch=facilities[0].branches[0],
            )
            await session.commit()

        async with state.db_session_maker() as session:
            posting = (
                await session.execute(select(JobPosting).limit(1))
            ).scalars().first()
            assert posting is not None
            specialty = (await SpecialtyRepository.list_all(session))[0]

            for _ in range(2):
                await JobsRepository.replace_salary_ranges(
                    session,
                    posting,
                    [JobSalaryRange(currency="KES", min_amount=10000, max_amount=None)],
                )
                await JobsRepository.replace_specialties(session, posting, [specialty])
            await session.commit()

        async with state.db_session_maker() as session:
            ranges = (
                await session.execute(
                    select(JobSalaryRange).where(JobSalaryRange.posting_id == posting.id)
                )
            ).scalars().all()
            links = (
                await session.execute(
                    select(JobPostingSpecialty).where(
                        JobPostingSpecialty.posting_id == posting.id
                    )
                )
            ).scalars().all()

        assert len(ranges) == 1
        assert len(links) == 1
    finally:
        await engine.dispose()