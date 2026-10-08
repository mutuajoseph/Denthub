"""Listing logic: the shared clinic/dentist card, hours, and open-now.

Search returns two kinds of row - a Facility and a Specialist - and the UI
renders one card for both, so this module shapes them into a single
``DentistListing`` contract rather than two that drift apart. A detail response
nests that same summary, so a card and a profile page never disagree about what
a listing is.

Money is quantised and every market-specific value (currency, the timezone
"open now" is computed in) comes from the Country the request resolved to, per
``CONTEXT.md`` "Opening Hours".
"""

from __future__ import annotations

from collections.abc import Sequence
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from typing import Literal
from zoneinfo import ZoneInfo

from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.exceptions import NotFoundException
from app.logic.v1.country import (
    DEFAULT_COUNTRY_CODE,
    CountryConfigurationMissingException,
    SpecialtyResponse,
)
from app.repositories.country import Country, CountryRepository, Specialty
from app.repositories.listing import (
    Branch,
    Facility,
    FacilityFilters,
    FacilityRepository,
    OpeningHour,
    Specialist,
    SpecialistFilters,
    SpecialistRepository,
)
from app.repositories.listing import (
    VerificationTier as VerificationTier,  # re-exported for the routes' Query type
)
from app.utils.money import quantize_money
from app.utils.state import AppState

LISTING_PAGE_SIZE = 24
MAX_PAGE_SIZE = 100


class OpeningHourResponse(BaseModel):
    """One weekday's hours, as the card's schedule strip renders them.

    Times are wall-clock ``HH:MM`` strings in the Branch's Country - no
    seconds, and no offset: the opening hour is a local fact, not an instant.
    """

    weekday: int
    opens: str | None
    closes: str | None
    is_closed: bool


class BranchResponse(BaseModel):
    """One location of a listing, with its hours already resolved."""

    id: str
    facility_id: str
    facility_name: str
    name: str | None
    subdivision_code: str
    address: str
    phone: str | None
    email: str | None
    hours: list[OpeningHourResponse]
    open_now: bool


class DentistListing(BaseModel):
    """One search result: a clinic and a dentist, the same shape.

    ``listing_type`` tells the two apart for rendering; nothing else in the
    contract differs, which is the point of the shared model.
    """

    id: str
    listing_type: Literal["facility", "specialist"]
    name: str
    country_code: str
    subdivision_code: str
    specialty_codes: list[str]
    rating: Decimal | None
    review_count: int
    #: The "from" price a card shows, never computed client-side.
    list_price: Decimal | None
    #: One currency for the whole page; a listing's own currency is this value.
    currency: str
    open_now: bool
    #: A number a patient can dial: the Facility's own phone, or a phone from
    #: one of the Specialist's Branches. Null when no number is published.
    phone: str | None
    #: The tier a Facility is verified at (``CONTEXT.md`` "Verification tier").
    #: Always null for a Specialist: specialists do not carry a tier yet.
    verification_tier: VerificationTier | None
    #: For a Specialist, the Facility they work at as a card shows it; a
    #: Facility's own name is its ``name``, so this is null for a Facility.
    clinic_name: str | None


class ListingPage(BaseModel):
    """One page of listings plus the market it belongs to."""

    items: list[DentistListing]
    total: int
    limit: int
    offset: int
    country_code: str
    currency: str


class FacilityDetail(BaseModel):
    """A clinic profile: its card, its contact, and every Branch."""

    listing: DentistListing
    address: str
    phone: str | None
    email: str | None
    verification_tier: VerificationTier
    branches: list[BranchResponse]


class SpecialistDetail(BaseModel):
    """A professional profile: its card, specialisms, and where they work."""

    listing: DentistListing
    slug: str
    specialties: list[SpecialtyResponse]
    branches: list[BranchResponse]


def is_open_now(
    hours: Sequence[OpeningHour],
    *,
    timezone_name: str,
    now_utc: datetime | None = None,
) -> bool:
    """Whether a Branch is open at ``now_utc``, read on the local clock.

    A weekday row whose ``opens`` is after ``closes`` crosses midnight, so the
    shift that *starts* a weekday is still running in the small hours of the
    next one; both halves are checked, including yesterday's row still open
    after midnight. A day with no row, or a row marked ``is_closed``, is closed.
    """
    local = (now_utc or datetime.now(UTC)).astimezone(ZoneInfo(timezone_name))
    current = local.time()
    today = local.weekday()
    yesterday = (local.date() - timedelta(days=1)).weekday()

    for row in hours:
        if row.is_closed or row.opens is None or row.closes is None:
            continue

        if row.weekday == today:
            if row.opens <= row.closes:
                if row.opens <= current <= row.closes:
                    return True
            elif current >= row.opens:
                return True
        elif row.weekday == yesterday and row.opens > row.closes and current <= row.closes:
            return True

    return False


def _validate_limit(limit: int) -> int:
    return max(1, min(limit, MAX_PAGE_SIZE))


async def _resolve_country(session: AsyncSession, wanted: str) -> Country:
    """The Country a page reports its currency and timezone from.

    Rows are filtered by exactly the market that was asked for: an unknown code
    yields an empty page rather than another market's clinics, the way the
    catalog endpoints behave. The resolution here supplies the values a page
    carries alongside those rows - the currency, and the clock ``open_now`` is
    read in - and falls back to the default market only when there is nothing
    to price, so the fallback path can never describe a row it did not select.
    """
    country = await CountryRepository.get(session, wanted.upper())

    if country is None:
        country = await CountryRepository.get(session, DEFAULT_COUNTRY_CODE)

    if country is None:
        raise CountryConfigurationMissingException()

    return country


def _serialize_hours(hours: Sequence[OpeningHour]) -> list[OpeningHourResponse]:
    return [
        OpeningHourResponse(
            weekday=row.weekday,
            opens=row.opens.strftime("%H:%M") if row.opens else None,
            closes=row.closes.strftime("%H:%M") if row.closes else None,
            is_closed=row.is_closed,
        )
        for row in hours
    ]


def _serialize_branch(
    branch: Branch,
    *,
    facility_name: str,
    timezone_name: str,
    now: datetime,
) -> BranchResponse:
    return BranchResponse(
        id=branch.id,
        facility_id=branch.facility_id,
        facility_name=facility_name,
        name=branch.name,
        subdivision_code=branch.subdivision_code,
        address=branch.address,
        phone=branch.phone,
        email=branch.email,
        hours=_serialize_hours(branch.opening_hours),
        open_now=is_open_now(branch.opening_hours, timezone_name=timezone_name, now_utc=now),
    )


def _serialize_specialties(specialties: Sequence[Specialty]) -> list[SpecialtyResponse]:
    return [
        SpecialtyResponse(
            id=row.id,
            code=row.code,
            name=row.name,
            description=row.description,
            display_order=row.display_order,
        )
        for row in sorted(specialties, key=lambda row: (row.display_order, row.name))
    ]


def _specialist_workplace(specialist: Specialist) -> tuple[str | None, str | None]:
    """Where a Specialist works, as a card renders it: ``(clinic_name, phone)``.

    Branches arrive in no guaranteed order, so the primary Branch is the first
    alphabetically by its Facility's name, then the Branch name - the same
    choice on every read. The phone is the first published number in that
    order: any Branch the Specialist works at reaches them.
    """
    if not specialist.branches:
        return None, None

    ordered = sorted(
        specialist.branches,
        key=lambda branch: (branch.facility.name, branch.name or ""),
    )
    phone = next((branch.phone for branch in ordered if branch.phone), None)
    return ordered[0].facility.name, phone


def _facility_listing(
    facility: Facility,
    *,
    specialty_codes: list[str],
    currency: str,
    timezone_name: str,
    now: datetime,
) -> DentistListing:
    return DentistListing(
        id=facility.id,
        listing_type="facility",
        name=facility.name,
        country_code=facility.country_code,
        subdivision_code=facility.subdivision_code,
        specialty_codes=specialty_codes,
        rating=facility.rating,
        review_count=facility.review_count,
        list_price=(
            None if facility.list_price is None else quantize_money(Decimal(facility.list_price))
        ),
        currency=currency,
        open_now=any(
            is_open_now(branch.opening_hours, timezone_name=timezone_name, now_utc=now)
            for branch in facility.branches
        ),
        phone=facility.phone,
        verification_tier=facility.verification_tier,
        clinic_name=None,
    )


def _specialist_listing(
    specialist: Specialist,
    *,
    currency: str,
    timezone_name: str,
    now: datetime,
) -> DentistListing:
    clinic_name, phone = _specialist_workplace(specialist)
    return DentistListing(
        id=specialist.id,
        listing_type="specialist",
        name=specialist.name,
        country_code=specialist.country_code,
        subdivision_code=specialist.subdivision_code,
        specialty_codes=[row.code for row in _serialize_specialties(specialist.specialties)],
        rating=specialist.rating,
        review_count=specialist.review_count,
        list_price=(
            None
            if specialist.list_price is None
            else quantize_money(Decimal(specialist.list_price))
        ),
        currency=currency,
        open_now=any(
            is_open_now(branch.opening_hours, timezone_name=timezone_name, now_utc=now)
            for branch in specialist.branches
        ),
        phone=phone,
        verification_tier=None,
        clinic_name=clinic_name,
    )


async def list_facilities(
    state: AppState,
    *,
    country_code: str,
    subdivision_code: str | None = None,
    verification_tier: VerificationTier | None = None,
    limit: int = LISTING_PAGE_SIZE,
    offset: int = 0,
) -> ListingPage:
    """One page of clinic listings for a Country, with branches resolved."""
    page_size = _validate_limit(limit)
    start = max(0, offset)

    filters = FacilityFilters(
        country_code=country_code.upper(),
        subdivision_code=subdivision_code,
        verification_tier=verification_tier,
    )

    async with state.db_session_maker() as session:
        country = await _resolve_country(session, filters.country_code)
        rows = await FacilityRepository.search(session, filters, limit=page_size, offset=start)
        total = await FacilityRepository.count(session, filters)
        specialties = await FacilityRepository.specialty_codes_by_facility(
            session, [row.id for row in rows]
        )

    now = datetime.now(UTC)

    return ListingPage(
        items=[
            _facility_listing(
                row,
                specialty_codes=specialties.get(row.id, []),
                currency=country.currency,
                timezone_name=country.timezone,
                now=now,
            )
            for row in rows
        ],
        total=total,
        limit=page_size,
        offset=start,
        country_code=filters.country_code,
        currency=country.currency,
    )


async def get_facility(state: AppState, *, facility_id: str) -> FacilityDetail:
    """One clinic profile, with every Branch and its hours."""
    async with state.db_session_maker() as session:
        facility = await FacilityRepository.get(session, facility_id)

        if facility is None:
            raise NotFoundException(message="Facility not found")

        country = await _resolve_country(session, facility.country_code)
        specialties = await FacilityRepository.specialty_codes_by_facility(session, [facility.id])

    now = datetime.now(UTC)
    branches = [
        _serialize_branch(
            branch,
            facility_name=facility.name,
            timezone_name=country.timezone,
            now=now,
        )
        for branch in facility.branches
    ]

    return FacilityDetail(
        listing=_facility_listing(
            facility,
            specialty_codes=specialties.get(facility.id, []),
            currency=country.currency,
            timezone_name=country.timezone,
            now=now,
        ),
        address=facility.address,
        phone=facility.phone,
        email=facility.email,
        verification_tier=facility.verification_tier,
        branches=branches,
    )


async def list_specialists(
    state: AppState,
    *,
    country_code: str,
    subdivision_code: str | None = None,
    specialty_code: str | None = None,
    limit: int = LISTING_PAGE_SIZE,
    offset: int = 0,
) -> ListingPage:
    """One page of specialist listings for a Country, filtered by specialism."""
    page_size = _validate_limit(limit)
    start = max(0, offset)

    filters = SpecialistFilters(
        country_code=country_code.upper(),
        subdivision_code=subdivision_code,
        specialty_code=specialty_code,
    )

    async with state.db_session_maker() as session:
        country = await _resolve_country(session, filters.country_code)
        rows = await SpecialistRepository.search(session, filters, limit=page_size, offset=start)
        total = await SpecialistRepository.count(session, filters)

    now = datetime.now(UTC)

    return ListingPage(
        items=[
            _specialist_listing(
                row,
                currency=country.currency,
                timezone_name=country.timezone,
                now=now,
            )
            for row in rows
        ],
        total=total,
        limit=page_size,
        offset=start,
        country_code=filters.country_code,
        currency=country.currency,
    )


async def get_specialist(state: AppState, *, specialist_id: str) -> SpecialistDetail:
    """One specialist profile, with specialisms and every Branch they work at."""
    async with state.db_session_maker() as session:
        specialist = await SpecialistRepository.get(session, specialist_id)

        if specialist is None:
            raise NotFoundException(message="Specialist not found")

        country = await _resolve_country(session, specialist.country_code)
        specialties = _serialize_specialties(specialist.specialties)

    now = datetime.now(UTC)
    branches = [
        _serialize_branch(
            branch,
            facility_name=branch.facility.name,
            timezone_name=country.timezone,
            now=now,
        )
        for branch in specialist.branches
    ]

    return SpecialistDetail(
        listing=_specialist_listing(
            specialist,
            currency=country.currency,
            timezone_name=country.timezone,
            now=now,
        ),
        slug=specialist.slug,
        specialties=specialties,
        branches=branches,
    )
