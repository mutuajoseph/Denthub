"""Account settings routes — the signed-in User's own details and Profiles (#119)."""

from __future__ import annotations

from fastapi import APIRouter, Depends

from app.dependencies import current_user, get_app_state
from app.logic.v1.auth import UserResponse
from app.logic.v1.me import MeUpdate, ProfileCreate, add_profile, get_me, update_me
from app.repositories.user import User
from app.utils.openapi_helpers import standard_error_responses
from app.utils.state import AppState

router = APIRouter(prefix="/me", tags=["me"])


@router.get("", response_model=UserResponse, responses=standard_error_responses(401, 403))
async def read_me(
    actor: User = Depends(current_user),
    state: AppState = Depends(get_app_state),
) -> UserResponse:
    """The caller's own account details, Profiles, and Facility Memberships."""
    return await get_me(state, actor=actor)


@router.patch("", response_model=UserResponse, responses=standard_error_responses(401, 403))
async def patch_me(
    data: MeUpdate,
    actor: User = Depends(current_user),
    state: AppState = Depends(get_app_state),
) -> UserResponse:
    """Change the caller's name, phone, or home Country."""
    return await update_me(state, actor=actor, data=data)


@router.post("/profiles", response_model=UserResponse, responses=standard_error_responses(401, 403))
async def create_profile(
    data: ProfileCreate,
    actor: User = Depends(current_user),
    state: AppState = Depends(get_app_state),
) -> UserResponse:
    """Add a Profile kind the caller does not already hold."""
    return await add_profile(state, actor=actor, data=data)
