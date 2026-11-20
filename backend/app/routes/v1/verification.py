"""Verification application routes: submit and read one's own status (#124)."""

from __future__ import annotations

from fastapi import APIRouter, Depends

from app.dependencies import current_user, get_app_state
from app.logic.v1.verification import (
    CreateVerificationRequest,
    VerificationApplicationList,
    VerificationApplicationView,
    my_verifications,
    submit_verification,
)
from app.repositories.user import User
from app.utils.openapi_helpers import standard_error_responses
from app.utils.state import AppState

router = APIRouter(tags=["verification"])


@router.post(
    "/verifications",
    response_model=VerificationApplicationView,
    status_code=201,
    responses=standard_error_responses(401, 403),
)
async def create_verification(
    data: CreateVerificationRequest,
    actor: User = Depends(current_user),
    state: AppState = Depends(get_app_state),
) -> VerificationApplicationView:
    """Apply to verify the Specialist, Facility, Supplier or Training Provider I act for."""
    return await submit_verification(state, actor=actor, data=data)


@router.get(
    "/me/verifications",
    response_model=VerificationApplicationList,
    responses=standard_error_responses(401, 403),
)
async def read_my_verifications(
    actor: User = Depends(current_user),
    state: AppState = Depends(get_app_state),
) -> VerificationApplicationList:
    """My latest application, with any rejection or revocation reason."""
    return await my_verifications(state, actor=actor)
