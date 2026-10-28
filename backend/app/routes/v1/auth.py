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
    login_staff,
    login_user,
    signup_user,
    user_response,
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


@router.get("/me", response_model=UserResponse, responses=standard_error_responses())
async def me(actor: User = Depends(current_user)) -> UserResponse:
    """Retrieve details of the currently authenticated user."""
    return user_response(actor)


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
    responses=standard_error_responses(),
)
async def staff_me(actor: User = Depends(current_staff)) -> UserResponse:
    """Retrieve details of the current user, requiring a staff access token."""
    return user_response(actor)
