"""Seed the country reference data: markets, subdivisions, flags, specialties.

This is the vocabulary every other table is written against — a listing's
``country_code`` has to resolve to a row here, or the catalogue silently
disappears for that market. It is seeded before the product catalog.

Idempotent: re-running updates rows keyed by their natural keys, so it is safe
to call more than once. Run with:

    uv run python -m app.scripts.seed_countries
"""

from __future__ import annotations

import asyncio

from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from structlog.typing import FilteringBoundLogger

from app.config import Settings
from app.repositories.country import (
    Country,
    CountryFeature,
    InsuranceProvider,
    Specialty,
    Subdivision,
)
from app.utils.logger import configure_logging
from app.utils.state import AppState
from app.utils.urls import describe_url

#: Fields a country row carries, minus its children. ``timezone`` is the IANA
#: zone used to compute "open now" for a branch, so a market with several zones
#: takes the one its capital sits in.
COUNTRIES: list[dict[str, object]] = [
    {
        "code": "KE",
        "name": "Kenya",
        "brand_suffix": "Kenya",
        "currency": "KES",
        "currency_symbol": "KSh",
        "locale": "en-KE",
        "domain": "denthub.co.ke",
        "phone_prefix": "+254",
        "subdivision_label": "County",
        "subdivision_label_plural": "Counties",
        "city_label": "Town",
        "timezone": "Africa/Nairobi",
    },
    {
        "code": "NG",
        "name": "Nigeria",
        "brand_suffix": "Nigeria",
        "currency": "NGN",
        "currency_symbol": "₦",
        "locale": "en-NG",
        "domain": "denthub.ng",
        "phone_prefix": "+234",
        "subdivision_label": "State",
        "subdivision_label_plural": "States",
        "city_label": "City",
        "timezone": "Africa/Lagos",
    },
    {
        "code": "GB",
        "name": "United Kingdom",
        "brand_suffix": "UK",
        "currency": "GBP",
        "currency_symbol": "£",
        "locale": "en-GB",
        "domain": "denthub.co.uk",
        "phone_prefix": "+44",
        "subdivision_label": "County",
        "subdivision_label_plural": "Counties",
        "city_label": "Town",
        "timezone": "Europe/London",
    },
    {
        "code": "US",
        "name": "United States",
        "brand_suffix": "USA",
        "currency": "USD",
        "currency_symbol": "$",
        "locale": "en-US",
        "domain": "denthub.com",
        "phone_prefix": "+1",
        "subdivision_label": "State",
        "subdivision_label_plural": "States",
        "city_label": "City",
        "timezone": "America/New_York",
    },
    {
        "code": "AE",
        "name": "United Arab Emirates",
        "brand_suffix": "UAE",
        "currency": "AED",
        "currency_symbol": "AED",
        "locale": "en-AE",
        "domain": "denthub.ae",
        "phone_prefix": "+971",
        "subdivision_label": "Emirate",
        "subdivision_label_plural": "Emirates",
        "city_label": "City",
        "timezone": "Asia/Dubai",
    },
    {
        "code": "ZA",
        "name": "South Africa",
        "brand_suffix": "South Africa",
        "currency": "ZAR",
        "currency_symbol": "R",
        "locale": "en-ZA",
        "domain": "denthub.co.za",
        "phone_prefix": "+27",
        "subdivision_label": "Province",
        "subdivision_label_plural": "Provinces",
        "city_label": "City",
        "timezone": "Africa/Johannesburg",
    },
    {
        "code": "IN",
        "name": "India",
        "brand_suffix": "India",
        "currency": "INR",
        "currency_symbol": "₹",
        "locale": "en-IN",
        "domain": "denthub.in",
        "phone_prefix": "+91",
        "subdivision_label": "State",
        "subdivision_label_plural": "States",
        "city_label": "City",
        "timezone": "Asia/Kolkata",
    },
    {
        "code": "TR",
        "name": "Turkey",
        "brand_suffix": "Turkey",
        "currency": "TRY",
        "currency_symbol": "₺",
        "locale": "tr-TR",
        "domain": "denthub.com.tr",
        "phone_prefix": "+90",
        "subdivision_label": "Province",
        "subdivision_label_plural": "Provinces",
        "city_label": "City",
        "timezone": "Europe/Istanbul",
    },
]

#: (country_code, [subdivision names]). Every country Kenya-first in the app
#: needs at least the divisions its listings and seed data actually use.
SUBDIVISIONS: dict[str, list[str]] = {
    "KE": [
        "Bomet",
        "Bungoma",
        "Eldoret",
        "Garissa",
        "Kakamega",
        "Kisumu",
        "Kitui",
        "Machakos",
        "Mombasa",
        "Nairobi",
        "Nakuru",
        "Nyeri",
        "Uasin Gishu",
    ],
    "NG": ["Abuja", "Enugu", "Ibadan", "Kano", "Lagos", "Port Harcourt"],
    "GB": ["England", "London", "Manchester", "Scotland", "Surrey", "Wales"],
    "US": [
        "California",
        "Florida",
        "Illinois",
        "Massachusetts",
        "New York",
        "Texas",
        "Washington",
    ],
    "AE": ["Abu Dhabi", "Dubai", "Sharjah"],
    "ZA": [
        "Cape Town",
        "Gauteng",
        "KwaZulu-Natal",
        "Western Cape",
    ],
    "IN": ["Delhi", "Karnataka", "Maharashtra", "Tamil Nadu", "Telangana"],
    "TR": ["Ankara", "Istanbul", "Izmir"],
}

#: Feature keys, matching the names the client already asks about
#: (``useCountryConfig`` reads DENTAL_INSURANCE, ORAL_CARE_SHOP, JOBS_BOARD).
#:
#: (country_code, feature, is_enabled, primary_scheme). A market that does not
#: offer a module has no row, and callers must treat a missing row as disabled.
COUNTRY_FEATURES: list[tuple[str, str, bool, str | None]] = [
    ("KE", "DENTAL_INSURANCE", True, "NHIF"),
    ("KE", "ORAL_CARE_SHOP", True, None),
    ("KE", "JOBS_BOARD", True, None),
    ("KE", "CPD_TRAINING", True, None),
    ("NG", "DENTAL_INSURANCE", True, "NHIS"),
    ("NG", "ORAL_CARE_SHOP", True, None),
    ("NG", "JOBS_BOARD", True, None),
    ("NG", "CPD_TRAINING", False, None),
    ("GB", "DENTAL_INSURANCE", True, "NHS"),
    ("GB", "ORAL_CARE_SHOP", True, None),
    ("GB", "JOBS_BOARD", True, None),
    ("GB", "CPD_TRAINING", True, None),
    ("US", "DENTAL_INSURANCE", True, None),
    ("US", "ORAL_CARE_SHOP", True, None),
    ("US", "JOBS_BOARD", True, None),
    ("US", "CPD_TRAINING", True, None),
    ("AE", "DENTAL_INSURANCE", True, "Dubai Health Insurance"),
    ("AE", "ORAL_CARE_SHOP", True, None),
    ("AE", "JOBS_BOARD", True, None),
    ("AE", "CPD_TRAINING", False, None),
    ("ZA", "DENTAL_INSURANCE", True, "Discovery Health"),
    ("ZA", "ORAL_CARE_SHOP", True, None),
    ("ZA", "JOBS_BOARD", True, None),
    ("ZA", "CPD_TRAINING", True, None),
    ("IN", "DENTAL_INSURANCE", True, "PM-JAY"),
    ("IN", "ORAL_CARE_SHOP", True, None),
    ("IN", "JOBS_BOARD", True, None),
    ("IN", "CPD_TRAINING", True, None),
    ("TR", "DENTAL_INSURANCE", True, "SGK"),
    ("TR", "ORAL_CARE_SHOP", True, None),
    ("TR", "JOBS_BOARD", True, None),
    ("TR", "CPD_TRAINING", True, None),
]

#: (country_code, name, is_national). The national scheme is listed too so the
#: UI can render "NHIF accepted" without a second lookup.
INSURANCE_PROVIDERS: list[tuple[str, str, bool]] = [
    ("KE", "NHIF", True),
    ("KE", "Britam", False),
    ("KE", "CIC", False),
    ("KE", "Jubilee", False),
    ("KE", "Madison", False),
    ("KE", "Sanlam", False),
    ("NG", "NHIS", True),
    ("NG", "Leadway", False),
    ("NG", "LIME", False),
    ("NG", "AXA", False),
    ("GB", "NHS", True),
    ("GB", "Bupa", False),
    ("GB", "Vitality", False),
    ("US", "Delta Dental", True),
    ("US", "Cigna", False),
    ("US", "Aetna", False),
    ("US", "MetLife", False),
    ("AE", "Dubai Health Insurance", True),
    ("AE", "Daman", False),
    ("AE", "Orient", False),
    ("ZA", "Discovery Health", True),
    ("ZA", "Old Mutual", False),
    ("ZA", "Stryker", False),
    ("IN", "PM-JAY", True),
    ("IN", "Star Health", False),
    ("IN", "Niva Bupa", False),
    ("TR", "SGK", True),
    ("TR", "Anadolu Sigorta", False),
    ("TR", "Mapfre", False),
]

#: (code, name, display_order). One canonical row per specialty: the fixtures
#: spelled the same specialty both "Pediatric" and "Paediatric", which broke
#: exact-match filtering, and "Oral & Maxillofacial Surgery" against "Oral
#: Surgery". Codes are what query strings and cache keys use.
SPECIALTIES: list[tuple[str, str, int]] = [
    ("general-dentistry", "General Dentistry", 10),
    ("orthodontics", "Orthodontics", 20),
    ("endodontics", "Endodontics", 30),
    ("periodontics", "Periodontics", 40),
    ("oral-surgery", "Oral & Maxillofacial Surgery", 50),
    ("prosthodontics", "Prosthodontics", 60),
    ("paediatric-dentistry", "Paediatric Dentistry", 70),
    ("oral-pathology", "Oral Pathology", 80),
    ("dental-hygiene", "Dental Hygiene", 90),
    ("implantology", "Implantology", 100),
    ("cosmetic-dentistry", "Cosmetic Dentistry", 110),
    ("digital-dentistry", "Digital Dentistry", 120),
]


async def seed(state: AppState) -> None:
    """Insert or update the country reference data."""
    async with state.db_session_maker() as session:
        for row in COUNTRIES:
            code = str(row["code"])
            country_result = await session.execute(select(Country).where(Country.code == code))
            country = country_result.scalar_one_or_none()

            if country is None:
                session.add(Country(**row))
            else:
                for key, value in row.items():
                    setattr(country, key, value)

        await session.flush()

        for country_code, names in SUBDIVISIONS.items():
            for name in names:
                subdivision_result = await session.execute(
                    select(Subdivision).where(
                        Subdivision.country_code == country_code,
                        Subdivision.name == name,
                    )
                )
                subdivision = subdivision_result.scalar_one_or_none()
                code = _subdivision_code(name)

                if subdivision is None:
                    session.add(Subdivision(country_code=country_code, name=name, code=code))
                else:
                    subdivision.code = code

        for country_code, feature, is_enabled, primary_scheme in COUNTRY_FEATURES:
            feature_result = await session.execute(
                select(CountryFeature).where(
                    CountryFeature.country_code == country_code,
                    CountryFeature.feature == feature,
                )
            )
            feature_row = feature_result.scalar_one_or_none()

            if feature_row is None:
                session.add(
                    CountryFeature(
                        country_code=country_code,
                        feature=feature,
                        is_enabled=is_enabled,
                        primary_scheme=primary_scheme,
                    )
                )
            else:
                feature_row.is_enabled = is_enabled
                feature_row.primary_scheme = primary_scheme

        for country_code, name, is_national in INSURANCE_PROVIDERS:
            provider_result = await session.execute(
                select(InsuranceProvider).where(
                    InsuranceProvider.country_code == country_code,
                    InsuranceProvider.name == name,
                )
            )
            provider_row = provider_result.scalar_one_or_none()

            if provider_row is None:
                session.add(
                    InsuranceProvider(country_code=country_code, name=name, is_national=is_national)
                )
            else:
                provider_row.is_national = is_national

        for code, name, display_order in SPECIALTIES:
            specialty_result = await session.execute(
                select(Specialty).where(Specialty.code == code)
            )
            specialty_row = specialty_result.scalar_one_or_none()

            if specialty_row is None:
                session.add(Specialty(code=code, name=name, display_order=display_order))
            else:
                specialty_row.name = name
                specialty_row.display_order = display_order

        await session.commit()

    state.logger.info(
        "seed.countries",
        countries=len(COUNTRIES),
        subdivisions=sum(len(names) for names in SUBDIVISIONS.values()),
        features=len(COUNTRY_FEATURES),
        insurance_providers=len(INSURANCE_PROVIDERS),
        specialties=len(SPECIALTIES),
    )


def _subdivision_code(name: str) -> str:
    """Derive a stable code from a subdivision name.

    Matches the client's historical ``slug`` so a subdivision selected before
    this table existed resolves to the same row: uppercase, accents stripped,
    every other run of characters collapsed to an underscore.
    """
    import re
    import unicodedata

    normalized = unicodedata.normalize("NFD", name)
    stripped = "".join(char for char in normalized if not unicodedata.combining(char))
    return re.sub(r"[^A-Za-z0-9]+", "_", stripped).strip("_").upper()


async def seed_database(settings: Settings, logger: FilteringBoundLogger) -> None:
    """Insert or update the country reference data, from a running event loop."""
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
    logger.info("seed.countries.done", url=describe_url(settings.database_url))


if __name__ == "__main__":
    main()
