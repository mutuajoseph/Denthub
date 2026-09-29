"""Country configuration routes - thin HTTP adapters over country logic.

These are the endpoints a client calls *before* it has any listing data, to learn
which market it is rendering. They therefore have to be public, cheap, and
cacheable (see ADR-0002).

The active country arrives two ways and the more specific one wins: the
``country`` query parameter names the market being asked about, while
``Accept-Country`` is the ambient market for the whole request. Listing a
country in the query string is how a region switcher asks "what does Nigeria
look like" without changing the request's ambient market.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Header, Query

from app.dependencies import get_app_state
from app.logic.v1.country import (
    DEFAULT_COUNTRY_CODE,
    CountryConfig,
    CountryList,
    SpecialtyList,
    SubdivisionList,
    get_country_config,
    list_countries,
    list_specialties,
    list_subdivisions,
)
from app.utils.openapi_helpers import standard_error_responses
from app.utils.state import AppState

router = APIRouter(prefix="/config", tags=["config"])


@router.get(
    "/country",
    response_model=CountryConfig,
    responses=standard_error_responses(),
)
async def read_country(
    country: str | None = Query(default=None, description="Overrides Accept-Country"),
    accept_country: str = Header(default=DEFAULT_COUNTRY_CODE, alias="Accept-Country"),
    state: AppState = Depends(get_app_state),
) -> CountryConfig:
    """Return the configuration for a market: currency, labels, flags, providers.

    The response embeds the market's subdivisions so a first paint needs one
    request. An unknown country falls back to the default market rather than
    404-ing, so a client holding a stale country degrades instead of erroring.
    """
    return await get_country_config(state, country_code=country or accept_country)


@router.get("/countries", response_model=CountryList, responses=standard_error_responses())
async def read_countries(state: AppState = Depends(get_app_state)) -> CountryList:
    """List every active country, for the region switcher."""
    return await list_countries(state)


@router.get(
    "/country/regions",
    response_model=SubdivisionList,
    responses=standard_error_responses(),
)
async def read_country_regions(
    country: str | None = Query(default=None),
    accept_country: str = Header(default=DEFAULT_COUNTRY_CODE, alias="Accept-Country"),
    state: AppState = Depends(get_app_state),
) -> SubdivisionList:
    """List a country's subdivisions. An unknown country yields an empty list."""
    return await list_subdivisions(state, country_code=country or accept_country)


@router.get(
    "/specialties",
    response_model=SpecialtyList,
    responses=standard_error_responses(),
)
async def read_specialties(state: AppState = Depends(get_app_state)) -> SpecialtyList:
    """List the canonical dental specialties, in filter-menu order."""
    return await list_specialties(state)
