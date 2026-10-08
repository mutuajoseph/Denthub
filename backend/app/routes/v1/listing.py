"""Listing routes - thin HTTP adapters over listing logic.

A clinic and a specialist are one search surface for the client - one card, one
set of filters - so they share a module even though the rows come from two
tables. Country resolves the same way country config does: ``country`` names
the market being asked about and the ambient ``Accept-Country`` header is the
fallback, the more specific one winning.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Header, Query

from app.dependencies import get_app_state
from app.logic.v1.country import DEFAULT_COUNTRY_CODE
from app.logic.v1.listing import (
    LISTING_PAGE_SIZE,
    FacilityDetail,
    ListingPage,
    SpecialistDetail,
    VerificationTier,
    get_facility,
    get_specialist,
    list_facilities,
    list_specialists,
)
from app.utils.openapi_helpers import standard_error_responses
from app.utils.state import AppState

router = APIRouter(tags=["listings"])


@router.get("/facilities", response_model=ListingPage, responses=standard_error_responses())
async def read_facilities(
    country: str | None = Query(default=None, description="Overrides Accept-Country"),
    accept_country: str = Header(default=DEFAULT_COUNTRY_CODE, alias="Accept-Country"),
    subdivision_code: str | None = Query(default=None, description="Filter to one subdivision"),
    verification_tier: VerificationTier | None = Query(
        default=None, description="Filter to one verification tier"
    ),
    limit: int = Query(default=LISTING_PAGE_SIZE, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    state: AppState = Depends(get_app_state),
) -> ListingPage:
    """Search clinic listings for a market.

    Branches come back resolved, so ``open_now`` and the full weekly hours are
    rendered from one response rather than a second request per card.
    """
    return await list_facilities(
        state,
        country_code=country or accept_country,
        subdivision_code=subdivision_code,
        verification_tier=verification_tier,
        limit=limit,
        offset=offset,
    )


@router.get(
    "/facilities/{facility_id}",
    response_model=FacilityDetail,
    responses=standard_error_responses(),
)
async def read_facility(
    facility_id: str,
    country: str | None = Query(default=None, description="Overrides Accept-Country"),
    accept_country: str = Header(default=DEFAULT_COUNTRY_CODE, alias="Accept-Country"),
    state: AppState = Depends(get_app_state),
) -> FacilityDetail:
    """One clinic profile with every Branch and its hours.

    The market parameters are accepted for parity with the list routes; the
    clinic's own Country governs its currency and its ``open_now``, so a deep
    link always reads the same whatever market it arrived from.
    """
    return await get_facility(state, facility_id=facility_id)


@router.get("/dentists", response_model=ListingPage, responses=standard_error_responses())
async def read_specialists(
    country: str | None = Query(default=None, description="Overrides Accept-Country"),
    accept_country: str = Header(default=DEFAULT_COUNTRY_CODE, alias="Accept-Country"),
    subdivision_code: str | None = Query(default=None, description="Filter to one subdivision"),
    specialty_code: str | None = Query(default=None, description="Filter to one specialism"),
    limit: int = Query(default=LISTING_PAGE_SIZE, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    state: AppState = Depends(get_app_state),
) -> ListingPage:
    """Search specialist listings for a market, optionally by specialism."""
    return await list_specialists(
        state,
        country_code=country or accept_country,
        subdivision_code=subdivision_code,
        specialty_code=specialty_code,
        limit=limit,
        offset=offset,
    )


@router.get(
    "/dentists/{specialist_id}",
    response_model=SpecialistDetail,
    responses=standard_error_responses(),
)
async def read_specialist(
    specialist_id: str,
    country: str | None = Query(default=None, description="Overrides Accept-Country"),
    accept_country: str = Header(default=DEFAULT_COUNTRY_CODE, alias="Accept-Country"),
    state: AppState = Depends(get_app_state),
) -> SpecialistDetail:
    """One specialist profile with their specialisms and every Branch they work at.

    As with a clinic, the market parameters are accepted for parity and the
    specialist's own Country governs the response.
    """
    return await get_specialist(state, specialist_id=specialist_id)
