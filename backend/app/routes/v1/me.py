"""The signed-in caller's own account: settings, export and erasure (#119, #128)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Response, status

from app.dependencies import current_user, get_app_state
from app.logic.v1.auth import UserResponse
from app.logic.v1.me import (
    AccountExportResponse,
    MeUpdate,
    ProfileCreate,
    add_profile,
    delete_account,
    export_account,
    get_me,
    update_me,
)
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


@router.get(
    "/export",
    response_model=AccountExportResponse,
    responses=standard_error_responses(401, 403),
)
async def export_my_account(
    actor: User = Depends(current_user),
    state: AppState = Depends(get_app_state),
) -> AccountExportResponse:
    """A JSON copy of the caller's own account data."""
    return await export_account(state, actor=actor)


@router.delete(
    "",
    status_code=status.HTTP_204_NO_CONTENT,
    response_model=None,
    responses=standard_error_responses(401, 403),
)
async def delete_my_account(
    actor: User = Depends(current_user),
    state: AppState = Depends(get_app_state),
) -> Response:
    """Erase the caller's identity now and stop their existing session."""
    await delete_account(state, actor=actor)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
