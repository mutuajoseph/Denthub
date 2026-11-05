"""Authentication routes — thin HTTP adapters over authentication logic.

Provides endpoints for signup, login (public and staff), refresh, logout, the
current user, email verification, and the password lifecycle (forgot, reset,
change). The refresh token travels only in an httpOnly cookie; the JSON body
carries a short-lived access token (ADR-0003 follow-up, #121).

Refresh and logout are deliberately not role-gated: the httpOnly cookie is the
credential, and the scope in its JWT is what confines it to one surface (#121).
"""

from __future__ import annotations

from fastapi import APIRouter, BackgroundTasks, Depends, Request, Response, status

from app.dependencies import current_staff, current_user, get_app_state
from app.logic.v1.auth import (
    PUBLIC_SCOPE,
    STAFF_SCOPE,
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
    describe_user,
    forgot_password,
    login_staff,
    login_user,
    logout_session,
    refresh_cookie_scope,
    refresh_session,
    resend_verification_email,
    reset_password,
    signup_user,
    verify_email,
)
from app.repositories.user import User
from app.utils.cookies import clear_refresh_cookie, set_refresh_cookie
from app.utils.openapi_helpers import standard_error_responses
from app.utils.state import AppState

router = APIRouter(tags=["auth"])


@router.post("/register", response_model=AuthResponseModel, responses=standard_error_responses())
async def signup(
    data: UserSignup,
    response: Response,
    state: AppState = Depends(get_app_state),
) -> AuthResponseModel:
    """Create a new user profile, sign it in, and return an access token."""
    session = await signup_user(state, data)
    set_refresh_cookie(response, state, token=session.refresh_token, scope=PUBLIC_SCOPE)
    return session.response


@router.post("/login", response_model=AuthResponseModel, responses=standard_error_responses())
async def login(
    data: UserLogin,
    response: Response,
    state: AppState = Depends(get_app_state),
) -> AuthResponseModel:
    """Verify email/password, set the refresh cookie, and return an access token."""
    session = await login_user(state, data)
    set_refresh_cookie(response, state, token=session.refresh_token, scope=PUBLIC_SCOPE)
    return session.response


@router.post(
    "/refresh",
    response_model=AuthResponseModel,
    responses=standard_error_responses(401, 403),
)
async def refresh(
    request: Request,
    response: Response,
    state: AppState = Depends(get_app_state),
) -> AuthResponseModel:
    """Rotate the refresh cookie and return a fresh access token."""
    name, _path = refresh_cookie_scope(PUBLIC_SCOPE)
    session = await refresh_session(state, token=request.cookies.get(name), scope=PUBLIC_SCOPE)
    set_refresh_cookie(response, state, token=session.refresh_token, scope=PUBLIC_SCOPE)
    return session.response


@router.post("/logout", status_code=204, response_model=None, responses=standard_error_responses())
async def logout(
    request: Request,
    response: Response,
    state: AppState = Depends(get_app_state),
) -> None:
    """End the public session the refresh cookie names, and clear the cookie."""
    name, _path = refresh_cookie_scope(PUBLIC_SCOPE)
    await logout_session(state, token=request.cookies.get(name), scope=PUBLIC_SCOPE)
    clear_refresh_cookie(response, state, scope=PUBLIC_SCOPE)


@router.get("/me", response_model=UserResponse, responses=standard_error_responses(401, 403))
async def me(
    actor: User = Depends(current_user),
    state: AppState = Depends(get_app_state),
) -> UserResponse:
    """The signed-in User, with the Profiles and Facility Memberships they hold."""
    return await describe_user(state, actor)


@router.post(
    "/staff/login",
    response_model=AuthResponseModel,
    responses=standard_error_responses(),
)
async def staff_login(
    data: UserLogin,
    response: Response,
    state: AppState = Depends(get_app_state),
) -> AuthResponseModel:
    """Verify platform-staff credentials, set the staff cookie, and return a staff token."""
    session = await login_staff(state, data)
    set_refresh_cookie(response, state, token=session.refresh_token, scope=STAFF_SCOPE)
    return session.response


@router.post(
    "/staff/refresh",
    response_model=AuthResponseModel,
    responses=standard_error_responses(401, 403),
)
async def staff_refresh(
    request: Request,
    response: Response,
    state: AppState = Depends(get_app_state),
) -> AuthResponseModel:
    """Rotate the staff refresh cookie and return a fresh staff access token."""
    name, _path = refresh_cookie_scope(STAFF_SCOPE)
    session = await refresh_session(state, token=request.cookies.get(name), scope=STAFF_SCOPE)
    set_refresh_cookie(response, state, token=session.refresh_token, scope=STAFF_SCOPE)
    return session.response


@router.post(
    "/staff/logout",
    status_code=204,
    response_model=None,
    responses=standard_error_responses(),
)
async def staff_logout(
    request: Request,
    response: Response,
    state: AppState = Depends(get_app_state),
) -> None:
    """End the staff session the refresh cookie names, and clear the cookie."""
    name, _path = refresh_cookie_scope(STAFF_SCOPE)
    await logout_session(state, token=request.cookies.get(name), scope=STAFF_SCOPE)
    clear_refresh_cookie(response, state, scope=STAFF_SCOPE)


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
