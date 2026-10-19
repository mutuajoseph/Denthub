"""Operations console routes — thin HTTP adapters over operations logic.

Every route requires a staff-surface token for a ``platform_operator`` account
that has a Division assigned (roles confirmed with the maintainer for #83).
Admins use ``/admin``; an Admin's staff token is refused here. The Division and
tier come from the user row, never from the request, so scope is a server-side
constraint.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.dependencies import get_app_state
from app.logic.v1.operations import (
    DivisionJob,
    DivisionJobList,
    OperationsOverview,
    UpdateJobStatusRequest,
    get_overview,
    list_division_jobs,
    set_job_status,
)
from app.utils.openapi_helpers import standard_error_responses
from app.utils.state import AppState

router = APIRouter(prefix="/operations", tags=["operations"])
security = HTTPBearer(auto_error=True)


@router.get(
    "/overview",
    response_model=OperationsOverview,
    responses=standard_error_responses(401, 403),
)
async def read_overview(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    state: AppState = Depends(get_app_state),
) -> OperationsOverview:
    """The caller's Division, tier, and whether they may write."""
    return await get_overview(state, token=credentials.credentials)


@router.get(
    "/jobs",
    response_model=DivisionJobList,
    responses=standard_error_responses(401, 403),
)
async def read_division_jobs(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    state: AppState = Depends(get_app_state),
) -> DivisionJobList:
    """Job postings in the caller's Division, whatever their status."""
    return await list_division_jobs(state, token=credentials.credentials)


@router.patch(
    "/jobs/{posting_id}",
    response_model=DivisionJob,
    responses=standard_error_responses(401, 403),
)
async def patch_job_status(
    posting_id: str,
    request: UpdateJobStatusRequest,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    state: AppState = Depends(get_app_state),
) -> DivisionJob:
    """Publish or hide a Job posting. A Lead-only action."""
    return await set_job_status(
        state,
        token=credentials.credentials,
        posting_id=posting_id,
        request=request,
    )
