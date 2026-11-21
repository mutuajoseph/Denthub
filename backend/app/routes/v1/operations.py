"""Operations console routes — thin HTTP adapters over operations logic.

Every route requires a staff-surface token for a ``platform_operator`` account
that has a Division assigned (roles confirmed with the maintainer for #83).
Admins use ``/admin``; an Admin's staff token is refused here. The Division and
tier come from the user row, never from the request, so scope is a server-side
constraint.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends

from app.dependencies import current_staff, get_app_state
from app.logic.v1.operations import (
    DivisionJob,
    DivisionJobList,
    OperationsOverview,
    UpdateJobStatusRequest,
    get_overview,
    list_division_jobs,
    set_job_status,
)
from app.logic.v1.verification import (
    DecisionRequest,
    VerificationApplicationList,
    VerificationApplicationView,
    decide_verification_as_operator,
    operations_verification_queue,
)
from app.repositories.user import User
from app.utils.openapi_helpers import standard_error_responses
from app.utils.state import AppState

router = APIRouter(prefix="/operations", tags=["operations"])


@router.get(
    "/overview",
    response_model=OperationsOverview,
    responses=standard_error_responses(401, 403),
)
async def read_overview(
    actor: User = Depends(current_staff),
    state: AppState = Depends(get_app_state),
) -> OperationsOverview:
    """The caller's Division, tier, and whether they may write."""
    return await get_overview(state, actor=actor)


@router.get(
    "/jobs",
    response_model=DivisionJobList,
    responses=standard_error_responses(401, 403),
)
async def read_division_jobs(
    actor: User = Depends(current_staff),
    state: AppState = Depends(get_app_state),
) -> DivisionJobList:
    """Job postings in the caller's Division, whatever their status."""
    return await list_division_jobs(state, actor=actor)


@router.get(
    "/verifications",
    response_model=VerificationApplicationList,
    responses=standard_error_responses(401, 403),
)
async def read_division_verifications(
    actor: User = Depends(current_staff),
    state: AppState = Depends(get_app_state),
) -> VerificationApplicationList:
    """Applications in the Operator's own Division; Assistants may read."""
    return await operations_verification_queue(state, actor=actor)


@router.post(
    "/verifications/{application_id}/approve",
    response_model=VerificationApplicationView,
    responses=standard_error_responses(401, 403),
)
async def approve_division_verification(
    application_id: str,
    request: DecisionRequest,
    actor: User = Depends(current_staff),
    state: AppState = Depends(get_app_state),
) -> VerificationApplicationView:
    """Approve a pending application in the Operator's Division; Lead only."""
    return await decide_verification_as_operator(
        state,
        actor=actor,
        application_id=application_id,
        decision="approve",
        reason=request.reason,
    )


@router.post(
    "/verifications/{application_id}/reject",
    response_model=VerificationApplicationView,
    responses=standard_error_responses(401, 403),
)
async def reject_division_verification(
    application_id: str,
    request: DecisionRequest,
    actor: User = Depends(current_staff),
    state: AppState = Depends(get_app_state),
) -> VerificationApplicationView:
    """Reject a pending application in the Operator's Division; Lead only."""
    return await decide_verification_as_operator(
        state,
        actor=actor,
        application_id=application_id,
        decision="reject",
        reason=request.reason,
    )


@router.post(
    "/verifications/{application_id}/revoke",
    response_model=VerificationApplicationView,
    responses=standard_error_responses(401, 403),
)
async def revoke_division_verification(
    application_id: str,
    request: DecisionRequest,
    actor: User = Depends(current_staff),
    state: AppState = Depends(get_app_state),
) -> VerificationApplicationView:
    """Revoke a verified application in the Operator's Division; Lead only."""
    return await decide_verification_as_operator(
        state,
        actor=actor,
        application_id=application_id,
        decision="revoke",
        reason=request.reason,
    )


@router.patch(
    "/jobs/{posting_id}",
    response_model=DivisionJob,
    responses=standard_error_responses(401, 403),
)
async def patch_job_status(
    posting_id: str,
    request: UpdateJobStatusRequest,
    actor: User = Depends(current_staff),
    state: AppState = Depends(get_app_state),
) -> DivisionJob:
    """Publish or hide a Job posting. A Lead-only action."""
    return await set_job_status(
        state,
        actor=actor,
        posting_id=posting_id,
        request=request,
    )
