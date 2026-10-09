"""Home routes - thin HTTP adapters over the market's featured set and counts.

Country resolves the same way it does for listings: the ``country`` query names
the market being asked about and the ambient ``Accept-Country`` header is the
fallback, the more specific one winning.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Header, Query

from app.dependencies import get_app_state
from app.logic.v1.country import DEFAULT_COUNTRY_CODE
from app.logic.v1.home import (
    FEATURED_LIMIT,
    HomeFeatured,
    HomeStats,
    get_home_featured,
    get_home_stats,
)
from app.logic.v1.listing import MAX_PAGE_SIZE
from app.utils.openapi_helpers import standard_error_responses
from app.utils.state import AppState

router = APIRouter(prefix="/home", tags=["home"])


@router.get("/featured", response_model=HomeFeatured, responses=standard_error_responses())
async def read_home_featured(
    country: str | None = Query(default=None, description="Overrides Accept-Country"),
    accept_country: str = Header(default=DEFAULT_COUNTRY_CODE, alias="Accept-Country"),
    limit: int = Query(default=FEATURED_LIMIT, ge=1, le=MAX_PAGE_SIZE),
    state: AppState = Depends(get_app_state),
) -> HomeFeatured:
    """The market's top listings for the cards above the fold."""
    return await get_home_featured(state, country_code=country or accept_country, limit=limit)


@router.get("/stats", response_model=HomeStats, responses=standard_error_responses())
async def read_home_stats(
    country: str | None = Query(default=None, description="Overrides Accept-Country"),
    accept_country: str = Header(default=DEFAULT_COUNTRY_CODE, alias="Accept-Country"),
    state: AppState = Depends(get_app_state),
) -> HomeStats:
    """The market's headline counts, every one a real query result."""
    return await get_home_stats(state, country_code=country or accept_country)
