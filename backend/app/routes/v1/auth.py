"""Authentication routes — thin HTTP adapters over authentication logic.

Signup, login (public and staff), the current user, email verification, and the
password lifecycle (forgot, reset, change).
"""

from __future__ import annotations

from fastapi import APIRouter, BackgroundTasks, Depends, status

from app.dependencies import current_staff, current_user, get_app_state
from app.logic.v1.auth import (
    AuthResponseModel,
    ChangePasswordRequest,
    ForgotPasswordRequest,
    ForgotPasswordResponse,
    ResetPasswordRequest,
    UserLogin,
    UserResponse,
    UserSignup,
    VerifyEmailRequest,
    change_password,
    forgot_password,
    login_staff,
    login_user,
    resend_verification_email,
    reset_password,
    signup_user,
    user_response,
    verify_email,
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


@router.get("/me", response_model=UserResponse, responses=standard_error_responses(401, 403))
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
    responses=standard_error_responses(401, 403),
)
async def staff_me(actor: User = Depends(current_staff)) -> UserResponse:
    """Retrieve details of the current user, requiring a staff access token."""
    return user_response(actor)


@router.post(
    "/verify-email",
    status_code=status.HTTP_204_NO_CONTENT,
    responses=standard_error_responses(),
)
async def confirm_email(
    data: VerifyEmailRequest,
    state: AppState = Depends(get_app_state),
) -> None:
    """Spend an emailed verification token. Public (#120): the token is the credential."""
    await verify_email(state, data)


@router.post(
    "/verify-email/resend",
    status_code=status.HTTP_204_NO_CONTENT,
    responses=standard_error_responses(401, 403),
)
async def resend_email_verification(
    actor: User = Depends(current_user),
    state: AppState = Depends(get_app_state),
) -> None:
    """Email the signed-in User a fresh verification link."""
    await resend_verification_email(state, actor=actor)


@router.post(
    "/password/forgot",
    response_model=ForgotPasswordResponse,
    status_code=status.HTTP_202_ACCEPTED,
    responses=standard_error_responses(),
)
async def request_password_reset(
    data: ForgotPasswordRequest,
    background: BackgroundTasks,
    state: AppState = Depends(get_app_state),
) -> ForgotPasswordResponse:
    """Email a reset link if the account exists; the answer never says which.

    Public, as decided on #120: anyone may ask, and only the inbox owner can act.
    """
    return forgot_password(data, state=state, defer=background.add_task)


@router.post(
    "/password/reset",
    status_code=status.HTTP_204_NO_CONTENT,
    responses=standard_error_responses(),
)
async def complete_password_reset(
    data: ResetPasswordRequest,
    state: AppState = Depends(get_app_state),
) -> None:
    """Set a new password with an emailed reset token (public, #120: the token is the key)."""
    await reset_password(state, data)


@router.post(
    "/password/change",
    response_model=AuthResponseModel,
    responses=standard_error_responses(401, 403),
)
async def update_password(
    data: ChangePasswordRequest,
    actor: User = Depends(current_user),
    state: AppState = Depends(get_app_state),
) -> AuthResponseModel:
    """Change the signed-in User's password; returns a fresh session, ends the rest."""
    return await change_password(state, actor=actor, data=data)
