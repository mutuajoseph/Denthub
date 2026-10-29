"""Authentication routes — thin HTTP adapters over authentication logic.

Provides endpoints for signup, login, and fetching the current authenticated user profile.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends

from app.dependencies import current_staff, current_user, get_app_state
from app.logic.v1.auth import (
    AuthResponseModel,
    UserLogin,
    UserResponse,
    UserSignup,
    describe_user,
    login_staff,
    login_user,
    signup_user,
)
from app.logic.v1.users import (
    AddProfileRequest,
    AddProfileResponse,
    UpdateMeRequest,
    UserMeResponse,
    add_profile,
    get_me,
    update_me,
)
from app.repositories.user import User
from app.utils.openapi_helpers import standard_error_responses
from app.utils.state import AppState

router = APIRouter(tags=["auth"])


@router.post("/register", response_model=AuthResponseModel, responses=standard_error_responses())
async def signup(
    data: UserSignup,
    state: AppState = Depends(get_app_state),
) -> AuthResponseModel:
    """Create a new user profile and return access token."""
    return await signup_user(state, data)


@router.post("/login", response_model=AuthResponseModel, responses=standard_error_responses())
async def login(
    data: UserLogin,
    state: AppState = Depends(get_app_state),
) -> AuthResponseModel:
    """Verify email/password and return access token."""
    return await login_user(state, data)


@router.get("/me", response_model=UserMeResponse, responses=standard_error_responses(401, 403))
async def me(
    actor: User = Depends(current_user),
    state: AppState = Depends(get_app_state),
) -> UserMeResponse:
    """The signed-in User with detailed profile and membership info."""
    return await get_me(state, user=actor)


@router.patch("/me", response_model=UserMeResponse, responses=standard_error_responses(401, 403))
async def patch_me(
    data: UpdateMeRequest,
    actor: User = Depends(current_user),
    state: AppState = Depends(get_app_state),
) -> UserMeResponse:
    """Update the signed-in User's details (name, phone, home country)."""
    return await update_me(state, user=actor, data=data)


@router.post(
    "/me/profiles",
    response_model=AddProfileResponse,
    responses=standard_error_responses(401, 403),
)
async def add_profile_endpoint(
    data: AddProfileRequest,
    actor: User = Depends(current_user),
    state: AppState = Depends(get_app_state),
) -> AddProfileResponse:
    """Add a new Profile kind to the signed-in User."""
    return await add_profile(state, user=actor, data=data)


@router.post(
    "/staff/login",
    response_model=AuthResponseModel,
    responses=standard_error_responses(),
)
async def staff_login(
    data: UserLogin,
    state: AppState = Depends(get_app_state),
) -> AuthResponseModel:
    """Verify platform-staff credentials and return a staff access token."""
    return await login_staff(state, data)


@router.get(
    "/staff/me",
    response_model=UserResponse,
    responses=standard_error_responses(401, 403),
)
async def staff_me(
    actor: User = Depends(current_staff),
    state: AppState = Depends(get_app_state),
) -> UserResponse:
    """Retrieve details of the current user, requiring a staff access token."""
    return await describe_user(state, actor)
