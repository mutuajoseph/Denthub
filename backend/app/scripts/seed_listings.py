"""Seed the demo listings: Facilities, Specialists, Branches, Opening Hours.

The faces are the ones the client already renders from
``frontend/src/lib/dentistFixtures.ts``, moved behind the API so the same card
reads live data rather than a fixture. Where a fixture's clinic already exists
as a practice it is reused; the rest are created here so every Specialist works
at a real Branch.

Two things the fixtures carried that this schema deliberately does not:

* **A practice's specialisms** are not stored. What a clinic offers is what its
  Specialists offer (``FacilityRepository.specialty_codes_by_facility``), so
  only Specialists get ``specialist_specialties`` rows.
* **A Specialist's own hours** do not exist. Opening Hours belong to a Branch,
  so where a fixture's hours disagreed with the practice's, the Branch wins.

Idempotent: a Facility is keyed by ``(name, country)``, a Specialist by slug, a
Branch by ``(facility, address)``, and a Branch's week of hours is replaced
wholesale, so re-running updates the same rows.

Run with:

    uv run python -m app.scripts.seed_listings
"""

from __future__ import annotations

import asyncio
import re
from datetime import time
from decimal import Decimal
from typing import cast

from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from structlog.typing import FilteringBoundLogger

from app.config import Settings
from app.repositories.country import CountryRepository, SpecialtyRepository
from app.repositories.listing import (
    Branch,
    BranchRepository,
    FacilityRepository,
    SpecialistRepository,
    VerificationTier,
)
from app.utils.logger import configure_logging
from app.utils.state import AppState
from app.utils.urls import describe_url

DAY_INDEX = {"mon": 0, "tue": 1, "wed": 2, "thu": 3, "fri": 4, "sat": 5, "sun": 6}

#: Facility rows. ``hours`` are ``(days, opens, closes)`` spans for the one
#: Branch, with days like ``"mon-sat"`` or ``"sun-thu"`` (wrapping the week).
FACILITIES: list[dict[str, object]] = [
    {
        "name": "SmileCare Dental Centre",
        "country_code": "KE",
        "subdivision_code": "NAIROBI",
        "address": "Westlands, Nairobi",
        "phone": "+254712345601",
        "verification_tier": "featured",
        "currency": "KES",
        "list_price": "2000",
        "rating": "4.9",
        "review_count": 312,
        "branch_name": "Westlands",
        "branch_address": "Westlands, Nairobi",
        "branch_phone": "+254712345601",
        "hours": [("mon-sat", "08:00", "19:00")],
    },
    {
        "name": "Upper Hill Dental Specialists",
        "country_code": "KE",
        "subdivision_code": "NAIROBI",
        "address": "Upper Hill, Nairobi",
        "phone": "+254712345605",
        "verification_tier": "featured",
        "currency": "KES",
        "list_price": "3500",
        "rating": "4.8",
        "review_count": 198,
        "branch_name": "Upper Hill",
        "branch_address": "Upper Hill, Nairobi",
        "branch_phone": "+254712345605",
        "hours": [("mon-fri", "08:00", "18:00")],
    },
    {
        "name": "Coast Maxillofacial Centre",
        "country_code": "KE",
        "subdivision_code": "MOMBASA",
        "address": "Nyali, Mombasa",
        "phone": "+254734567891",
        "verification_tier": "verified",
        "currency": "KES",
        "list_price": "4000",
        "rating": "4.7",
        "review_count": 145,
        "branch_name": "Nyali",
        "branch_address": "Nyali, Mombasa",
        "branch_phone": "+254734567891",
        "hours": [("mon-sat", "08:00", "18:00")],
    },
    {
        "name": "Rift Valley Oral Surgery",
        "country_code": "KE",
        "subdivision_code": "NAKURU",
        "address": "Nakuru Town, Nakuru",
        "phone": "+254745678902",
        "verification_tier": "basic",
        "currency": "KES",
        "list_price": "5000",
        "rating": "4.6",
        "review_count": 72,
        "branch_name": "Nakuru Town",
        "branch_address": "Nakuru Town, Nakuru",
        "branch_phone": "+254745678902",
        "hours": [("mon-fri", "08:00", "16:00")],
    },
    {
        "name": "Eldoret Dental Hub",
        "country_code": "KE",
        "subdivision_code": "UASIN_GISHU",
        "address": "Eldoret, Uasin Gishu",
        "phone": "+254767890123",
        "verification_tier": "featured",
        "currency": "KES",
        "list_price": "2200",
        "rating": "4.8",
        "review_count": 118,
        "branch_name": "Eldoret",
        "branch_address": "Eldoret, Uasin Gishu",
        "branch_phone": "+254767890123",
        "hours": [("mon-sat", "08:00", "20:00")],
    },
    {
        "name": "Thames Dental Collective",
        "country_code": "GB",
        "subdivision_code": "ENGLAND",
        "address": "London, England",
        "phone": "+442079460120",
        "verification_tier": "featured",
        "currency": "GBP",
        "list_price": "120",
        "rating": "4.8",
        "review_count": 141,
        "branch_name": "London",
        "branch_address": "London, England",
        "branch_phone": "+442079460120",
        "hours": [("mon-fri", "08:30", "18:00")],
    },
    {
        "name": "Desert Bloom Dental",
        "country_code": "AE",
        "subdivision_code": "DUBAI",
        "address": "Dubai",
        "phone": "+97145550102",
        "verification_tier": "verified",
        "currency": "AED",
        "list_price": "650",
        "rating": "4.7",
        "review_count": 98,
        "branch_name": "Dubai",
        "branch_address": "Dubai",
        "branch_phone": "+97145550102",
        # Friday and Saturday are the weekend here, so the week is Sun-Thu.
        "hours": [("sun-thu", "09:00", "20:00")],
    },
    {
        "name": "Greenline Dental Mumbai",
        "country_code": "IN",
        "subdivision_code": "MAHARASHTRA",
        "address": "Mumbai, Maharashtra",
        "phone": "+91225550104",
        "verification_tier": "featured",
        "currency": "INR",
        "list_price": "1500",
        "rating": "4.8",
        "review_count": 164,
        "branch_name": "Mumbai",
        "branch_address": "Mumbai, Maharashtra",
        "branch_phone": "+91225550104",
        "hours": [("mon-sat", "10:00", "19:00")],
    },
    # Clinics the fixtures named on a Specialist but never listed as a practice.
    # Their rating and price are unknown rather than borrowed from the dentist
    # who works there, so they are unverified and unpriced until someone says
    # otherwise.
    {
        "name": "Lakeview Dental Clinic",
        "country_code": "KE",
        "subdivision_code": "KISUMU",
        "address": "Kisumu CBD, Kisumu",
        "phone": "+254723456789",
        "verification_tier": "unverified",
        "currency": "KES",
        "list_price": None,
        "rating": None,
        "review_count": 0,
        "branch_name": "Kisumu CBD",
        "branch_address": "Kisumu CBD, Kisumu",
        "branch_phone": "+254723456789",
        "hours": [("mon-fri", "09:00", "17:00")],
    },
    {
        "name": "Machakos Dental Care",
        "country_code": "KE",
        "subdivision_code": "MACHAKOS",
        "address": "Machakos, Machakos",
        "phone": "+254789012345",
        "verification_tier": "unverified",
        "currency": "KES",
        "list_price": None,
        "rating": None,
        "review_count": 0,
        "branch_name": "Machakos",
        "branch_address": "Machakos, Machakos",
        "branch_phone": "+254789012345",
        "hours": [("mon-fri", "08:00", "17:00")],
    },
    {
        "name": "Lagos Dental Specialists",
        "country_code": "NG",
        "subdivision_code": "LAGOS",
        "address": "Victoria Island, Lagos",
        "phone": "+2348023456789",
        "verification_tier": "unverified",
        "currency": "NGN",
        "list_price": None,
        "rating": None,
        "review_count": 0,
        "branch_name": "Victoria Island",
        "branch_address": "Victoria Island, Lagos",
        "branch_phone": "+2348023456789",
        "hours": [("mon-fri", "08:00", "17:00")],
    },
    {
        "name": "Harborview Dental Studio",
        "country_code": "US",
        "subdivision_code": "CALIFORNIA",
        "address": "San Francisco, California",
        "phone": "+14155550101",
        "verification_tier": "unverified",
        "currency": "USD",
        "list_price": None,
        "rating": None,
        "review_count": 0,
        "branch_name": "San Francisco",
        "branch_address": "San Francisco, California",
        "branch_phone": "+14155550101",
        "hours": [("tue-sat", "09:00", "17:00")],
    },
    {
        "name": "Joburg Dental Care",
        "country_code": "ZA",
        "subdivision_code": "GAUTENG",
        "address": "Johannesburg, Gauteng",
        "phone": "+27115550103",
        "verification_tier": "unverified",
        "currency": "ZAR",
        "list_price": None,
        "rating": None,
        "review_count": 0,
        "branch_name": "Johannesburg",
        "branch_address": "Johannesburg, Gauteng",
        "branch_phone": "+27115550103",
        "hours": [("mon-fri", "08:00", "17:00")],
    },
    {
        "name": "Bosphorus Dental Studio",
        "country_code": "TR",
        "subdivision_code": "ISTANBUL",
        "address": "Kadikoy, Istanbul",
        "phone": "+90212550105",
        "verification_tier": "unverified",
        "currency": "TRY",
        "list_price": None,
        "rating": None,
        "review_count": 0,
        "branch_name": "Kadikoy",
        "branch_address": "Kadikoy, Istanbul",
        "branch_phone": "+90212550105",
        "hours": [("mon-sat", "09:00", "19:00")],
    },
]

#: Specialist rows. ``clinic`` names a Facility seeded above in the same
#: country; ``specialties`` are codes, translated from the fixtures' display
#: names ("Implants" -> implantology, "Pediatric" -> paediatric-dentistry).
SPECIALISTS: list[dict[str, object]] = [
    {
        "name": "Dr. Wanjiku Kamau",
        "country_code": "KE",
        "subdivision_code": "NAIROBI",
        "currency": "KES",
        "list_price": "2500",
        "rating": "4.9",
        "review_count": 187,
        "specialties": ["implantology", "cosmetic-dentistry"],
        "clinic": "SmileCare Dental Centre",
    },
    {
        "name": "Dr. Peter Mwangi",
        "country_code": "KE",
        "subdivision_code": "NAIROBI",
        "currency": "KES",
        "list_price": "8000",
        "rating": "4.8",
        "review_count": 112,
        "specialties": ["oral-surgery", "implantology"],
        "clinic": "Upper Hill Dental Specialists",
    },
    {
        "name": "Dr. James Ochieng",
        "country_code": "KE",
        "subdivision_code": "KISUMU",
        "currency": "KES",
        "list_price": "4500",
        "rating": "4.7",
        "review_count": 94,
        "specialties": ["implantology", "oral-surgery"],
        "clinic": "Lakeview Dental Clinic",
    },
    {
        "name": "Dr. Fatima Hassan",
        "country_code": "KE",
        "subdivision_code": "MOMBASA",
        "currency": "KES",
        "list_price": "6000",
        "rating": "4.8",
        "review_count": 156,
        "specialties": ["oral-surgery"],
        "clinic": "Coast Maxillofacial Centre",
    },
    {
        "name": "Dr. Samuel Otieno",
        "country_code": "KE",
        "subdivision_code": "MACHAKOS",
        "currency": "KES",
        "list_price": "3500",
        "rating": "4.7",
        "review_count": 89,
        "specialties": ["implantology", "endodontics"],
        "clinic": "Machakos Dental Care",
    },
    {
        "name": "Dr. Ada Okafor",
        "country_code": "NG",
        "subdivision_code": "LAGOS",
        "currency": "NGN",
        "list_price": "85000",
        "rating": "4.7",
        "review_count": 76,
        "specialties": ["oral-surgery", "implantology"],
        "clinic": "Lagos Dental Specialists",
    },
    {
        "name": "Dr. Maya Thompson",
        "country_code": "US",
        "subdivision_code": "CALIFORNIA",
        "currency": "USD",
        "list_price": "210",
        "rating": "4.9",
        "review_count": 203,
        "specialties": ["implantology", "periodontics"],
        "clinic": "Harborview Dental Studio",
    },
    {
        "name": "Dr. Thandi Ndlovu",
        "country_code": "ZA",
        "subdivision_code": "GAUTENG",
        "currency": "ZAR",
        "list_price": "850",
        "rating": "4.6",
        "review_count": 87,
        "specialties": ["periodontics", "general-dentistry"],
        "clinic": "Joburg Dental Care",
    },
    {
        "name": "Dr. Elif Yilmaz",
        "country_code": "TR",
        "subdivision_code": "ISTANBUL",
        "currency": "TRY",
        "list_price": "3500",
        "rating": "4.9",
        "review_count": 119,
        "specialties": ["orthodontics", "paediatric-dentistry"],
        "clinic": "Bosphorus Dental Studio",
    },
]


def _slugify(name: str) -> str:
    """The stable handle a profile URL carries: the name, minus its honorific."""
    without_title = name.removeprefix("Dr. ")
    return re.sub(r"[^a-z0-9]+", "-", without_title.lower()).strip("-")


def _optional_decimal(value: object) -> Decimal | None:
    return Decimal(str(value)) if value is not None else None


def _week(
    specs: list[tuple[str, str, str]],
) -> list[tuple[int, time | None, time | None, bool]]:
    """Expand ``(days, opens, closes)`` spans into one row per weekday."""
    week: dict[int, tuple[int, time | None, time | None, bool]] = {}

    for days, opens, closes in specs:
        start, _, end = days.partition("-")
        first, last = DAY_INDEX[start], DAY_INDEX[end]
        span = range(first, last + 1) if first <= last else [*range(first, 7), *range(0, last + 1)]
        for weekday in span:
            week[weekday] = (weekday, time.fromisoformat(opens), time.fromisoformat(closes), False)

    return [week[weekday] for weekday in sorted(week)]


async def seed(state: AppState) -> None:
    """Insert or update the demo listings."""
    async with state.db_session_maker() as session:
        specialties = {row.code: row for row in await SpecialtyRepository.list_all(session)}
        if not specialties:
            raise RuntimeError(
                "No specialties found; run `python -m app.scripts.seed_countries` first."
            )

        countries = {row.code for row in await CountryRepository.list_active(session)}
        needed = {str(row["country_code"]) for row in FACILITIES} | {
            str(row["country_code"]) for row in SPECIALISTS
        }
        missing = sorted(needed - countries)
        if missing:
            raise RuntimeError(
                f"Countries not seeded: {', '.join(missing)}; "
                "run `python -m app.scripts.seed_countries` first."
            )

        branches: dict[tuple[str, str], Branch] = {}

        for row in FACILITIES:
            name = str(row["name"])
            country_code = str(row["country_code"])
            values: dict[str, object] = {
                "name": name,
                "country_code": country_code,
                "subdivision_code": str(row["subdivision_code"]),
                "address": str(row["address"]),
                "phone": row["phone"],
                "email": None,
                "verification_tier": cast(VerificationTier, str(row["verification_tier"])),
                "currency": str(row["currency"]),
                "list_price": _optional_decimal(row["list_price"]),
                "rating": _optional_decimal(row["rating"]),
                "review_count": int(cast(int, row["review_count"])),
            }

            facility = await FacilityRepository.find(session, name=name, country_code=country_code)

            if facility is None:
                facility = await FacilityRepository.create(session, **values)
            else:
                facility = await FacilityRepository.update(facility, **values)

            branch_name = str(cast(str, row["branch_name"]))
            branch_address = str(cast(str, row["branch_address"]))
            branch_values: dict[str, object] = {
                "name": branch_name,
                "subdivision_code": str(row["subdivision_code"]),
                "address": branch_address,
                "phone": row["branch_phone"],
                "email": None,
            }

            branch = await BranchRepository.find(
                session, facility_id=facility.id, address=branch_address
            )

            if branch is None:
                branch = await BranchRepository.create(
                    session, facility_id=facility.id, **branch_values
                )
            else:
                branch = await BranchRepository.update(branch, **branch_values)

            await BranchRepository.replace_hours(
                session,
                branch.id,
                _week(cast(list[tuple[str, str, str]], row["hours"])),
            )
            branches[(name, country_code)] = branch

        for row in SPECIALISTS:
            name = str(row["name"])
            country_code = str(row["country_code"])
            slug = _slugify(name)
            values = {
                "name": name,
                "slug": slug,
                "country_code": country_code,
                "subdivision_code": str(row["subdivision_code"]),
                "currency": str(row["currency"]),
                "list_price": _optional_decimal(row["list_price"]),
                "rating": _optional_decimal(row["rating"]),
                "review_count": int(cast(int, row["review_count"])),
            }

            specialist = await SpecialistRepository.find_by_slug(session, slug)

            if specialist is None:
                specialist = await SpecialistRepository.create(session, **values)
            else:
                specialist = await SpecialistRepository.update(specialist, **values)

            branch = branches[(str(row["clinic"]), country_code)]
            await SpecialistRepository.attach_branch(session, specialist, branch)

            for code in cast(list[str], row["specialties"]):
                await SpecialistRepository.attach_specialty(session, specialist, specialties[code])

        await session.commit()

    state.logger.info(
        "seed.listings",
        facilities=len(FACILITIES),
        specialists=len(SPECIALISTS),
    )


async def seed_database(settings: Settings, logger: FilteringBoundLogger) -> None:
    """Insert or update the demo listings, from a running event loop."""
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
    logger.info("seed.listings.done", url=describe_url(settings.database_url))


if __name__ == "__main__":
    main()
