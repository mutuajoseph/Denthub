"""User administration routes — thin HTTP adapters over user logic.

Provides staff-managed user actions such as approving a pending professional
account.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.dependencies import get_app_state
from app.logic.v1.auth import UserResponse
from app.logic.v1.users import approve_user
from app.utils.openapi_helpers import standard_error_responses
from app.utils.state import AppState

router = APIRouter(prefix="/users", tags=["users"])
security = HTTPBearer(auto_error=True)


@router.post(
    "/{user_id}/approve",
    response_model=UserResponse,
    responses=standard_error_responses(),
)
async def approve(
    user_id: str,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    state: AppState = Depends(get_app_state),
) -> UserResponse:
    """Set a pending user account to active (admins and super-admins only)."""
    return await approve_user(
        state,
        token=credentials.credentials,
        user_id=user_id,
    )
