"""Authentication routes — thin HTTP adapters over authentication logic.

Provides endpoints for signup, login, and fetching the current authenticated user profile.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.dependencies import get_app_state
from app.logic.v1.auth import (
    AuthResponseModel,
    UserLogin,
    UserResponse,
    UserSignup,
    get_current_user,
    login_user,
    signup_user,
)
from app.utils.openapi_helpers import standard_error_responses
from app.utils.state import AppState

router = APIRouter(tags=["auth"])
security = HTTPBearer(auto_error=True)


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
async def me(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    state: AppState = Depends(get_app_state),
) -> UserResponse:
    """Retrieve details of the currently authenticated user."""
    return await get_current_user(state, credentials.credentials)
