"""User administration routes — thin HTTP adapters over user logic.

Provides staff-managed user actions such as approving a pending professional
account.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends

from app.dependencies import current_admin, get_app_state
from app.logic.v1.auth import UserResponse
from app.logic.v1.users import approve_user
from app.repositories.user import User
from app.utils.openapi_helpers import standard_error_responses
from app.utils.state import AppState

router = APIRouter(prefix="/users", tags=["users"])


@router.post(
    "/{user_id}/approve",
    response_model=UserResponse,
    responses=standard_error_responses(),
)
async def approve(
    user_id: str,
    actor: User = Depends(current_admin),
    state: AppState = Depends(get_app_state),
) -> UserResponse:
    """Set a pending user account to active (admins and super-admins only)."""
    return await approve_user(
        state,
        actor=actor,
        user_id=user_id,
    )
