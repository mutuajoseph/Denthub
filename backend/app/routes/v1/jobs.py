"""Jobs board routes - thin HTTP adapters over jobs logic.

Public read-only module per PRD §2, so no role gate. Country resolves like the
listing routes do: ``country`` names the market being asked about and the
ambient ``Accept-Country`` header is the fallback, the more specific one
winning.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Header, Query

from app.dependencies import get_app_state
from app.logic.v1.country import DEFAULT_COUNTRY_CODE
from app.logic.v1.jobs import (
    JOBS_PAGE_SIZE,
    JobPage,
    JobPostingResponse,
    get_job,
    list_jobs,
)
from app.utils.openapi_helpers import standard_error_responses
from app.utils.state import AppState

router = APIRouter(prefix="/jobs", tags=["jobs"])


@router.get("", response_model=JobPage, responses=standard_error_responses())
async def read_jobs(
    country: str | None = Query(default=None, description="Overrides Accept-Country"),
    accept_country: str = Header(default=DEFAULT_COUNTRY_CODE, alias="Accept-Country"),
    subdivision_code: str | None = Query(default=None, description="Filter to one subdivision"),
    specialty_code: str | None = Query(default=None, description="Filter to one specialism"),
    limit: int = Query(default=JOBS_PAGE_SIZE, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    state: AppState = Depends(get_app_state),
) -> JobPage:
    """One page of published job postings for a market."""
    return await list_jobs(
        state,
        country_code=country or accept_country,
        subdivision_code=subdivision_code,
        specialty_code=specialty_code,
        limit=limit,
        offset=offset,
    )


@router.get(
    "/{posting_id}",
    response_model=JobPostingResponse,
    responses=standard_error_responses(),
)
async def read_job(
    posting_id: str,
    country: str | None = Query(default=None, description="Overrides Accept-Country"),
    accept_country: str = Header(default=DEFAULT_COUNTRY_CODE, alias="Accept-Country"),
    state: AppState = Depends(get_app_state),
) -> JobPostingResponse:
    """One published posting with its salary range and Workplace.

    ``country`` is accepted for parity with the list route; the posting's own
    Country governs the response, so a deep link reads the same from any market.
    """
    return await get_job(state, posting_id=posting_id)
