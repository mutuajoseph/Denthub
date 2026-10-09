"""Home logic: the market's featured listings and its headline statistics.

The Home page is the marketplace's front door, so it must not state two
different versions of the market at once. The cards it shows are the same
``DentistListing`` rows the search pages return - a patient deep-links from a
Home card to the same profile a search result links to - and the numbers beside
them are counts the server reads for the active market, never marketing copy a
release would have to correct. A country the server knows nothing about comes
up empty and zeroed rather than another market's numbers or an error.
"""

from __future__ import annotations

from decimal import Decimal

from pydantic import BaseModel

from app.logic.v1.listing import (
    MAX_PAGE_SIZE,
    DentistListing,
    list_facilities,
    list_specialists,
)
from app.repositories.listing import (
    FacilityFilters,
    FacilityRepository,
    SpecialistFilters,
    SpecialistRepository,
)
from app.utils.state import AppState

FEATURED_LIMIT = 3


class HomeFeatured(BaseModel):
    """A short, ranked set of ``DentistListing`` cards for the market.

    One card shape the search pages already publish, so the Home page and the
    directory never disagree about what a listing is. The ``currency`` is the
    market's own, read the way a listing page reads it.
    """

    items: list[DentistListing]
    country_code: str
    currency: str


class HomeStats(BaseModel):
    """Counts and coverage figures for one market, all of them real queries.

    ``verified_clinics`` counts a clinic only beyond the default
    ``unverified`` tier (``CONTEXT.md`` "Verification tier"). A figure that is
    not one of these queries has no business on the page.
    """

    country_code: str
    clinics_listed: int
    verified_clinics: int
    specialists: int
    counties_covered: int


def _rating_key(listing: DentistListing) -> tuple[int, Decimal, str]:
    """Rank a listing for "featured": rating desc, then name.

    ``None`` ratings sort after every number (``1`` marks "has a rating") so an
    unrated row never outranks a rated one, and the name is the tie-break that
    keeps the set deterministic across reads.
    """
    return (
        1 if listing.rating is None else 0,
        Decimal(0) if listing.rating is None else -listing.rating,
        listing.name,
    )


async def get_home_featured(
    state: AppState,
    *,
    country_code: str,
    limit: int = FEATURED_LIMIT,
) -> HomeFeatured:
    """The active market's top listings: clinics and dentists, by rating.

    Both kinds are fetched through the public listing logic - the same rows and
    the same exact-money and ``open_now`` resolution search pages serve - then
    merged and ranked into one short set, facilities and specialists together,
    so a 4.9 specialist leads a 4.8 clinic.
    """
    wanted = country_code.upper()
    facilities = await list_facilities(state, country_code=wanted, limit=MAX_PAGE_SIZE, offset=0)
    specialists = await list_specialists(state, country_code=wanted, limit=MAX_PAGE_SIZE, offset=0)

    ranked = sorted(facilities.items + specialists.items, key=_rating_key)

    return HomeFeatured(
        items=ranked[:limit],
        country_code=wanted,
        currency=facilities.currency,
    )


async def get_home_stats(state: AppState, *, country_code: str) -> HomeStats:
    """Count a market's clinics, verified clinics, specialists, and counties."""
    wanted = country_code.upper()

    async with state.db_session_maker() as session:
        clinics_listed = await FacilityRepository.count(
            session, FacilityFilters(country_code=wanted)
        )
        verified_clinics = await FacilityRepository.count_verified(session, country_code=wanted)
        specialists = await SpecialistRepository.count(
            session, SpecialistFilters(country_code=wanted)
        )
        counties_covered = await FacilityRepository.count_subdivisions(session, country_code=wanted)

    return HomeStats(
        country_code=wanted,
        clinics_listed=clinics_listed,
        verified_clinics=verified_clinics,
        specialists=specialists,
        counties_covered=counties_covered,
    )
