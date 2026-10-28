"""Authentication and authorization logic.

Handles password hashing, token generation/verification, and signup/login flows.
"""

from __future__ import annotations

import secrets
from collections.abc import Callable
from datetime import UTC, datetime, timedelta
from typing import Annotated, Any, Literal, cast

import bcrypt
import jwt
from pydantic import AfterValidator, BaseModel, EmailStr, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.exceptions import (
    ConflictError,
    ForbiddenException,
    InvalidRequestError,
    UnauthorizedException,
)
from app.repositories.profile import (
    PROFILE_FOR_ACCOUNT_TYPE,
    FacilityPermission,
    ProfileKind,
    ProfileRepository,
)
from app.repositories.user import User, UserRepository
from app.repositories.user_token import TokenPurpose, UserTokenRepository
from app.utils.mailer import OutgoingEmail
from app.utils.state import AppState

#: Account types public signup may create (PRD §2). Staff roles are granted by
#: staff and are deliberately absent: they are not expressible as input.
AccountType = Literal[
    "patient",
    "international_patient",
    "dentist",
    "specialist",
    "intern",
    "facility_owner",
    "supplier",
    "training_provider",
]

#: Whether a user record has been reviewed by staff. Professional accounts
#: (PRD §2) start life "pending"; a staff approval flips them to "active".
AccountStatus = Literal["active", "pending"]

#: Account types whose signup is held for staff review. Patient accounts are
#: active immediately: nothing about a patient profile is gated behind review.
PROFESSIONAL_ACCOUNT_TYPES: frozenset[str] = frozenset(
    {"dentist", "specialist", "intern", "facility_owner", "supplier", "training_provider"}
)

#: Roles a human granted, as opposed to roles a signup could ever ask for.
STAFF_ROLES: frozenset[str] = frozenset({"staff", "admin", "super_admin", "platform_operator"})

#: Roles that may sign in through the staff surface (``/staff/access``). A
#: subset of ``STAFF_ROLES``: the generic ``staff`` role signs in publicly, so
#: only platform staff — admins and operators — use the staff surface.
STAFF_SURFACE_ROLES: frozenset[str] = frozenset({"admin", "super_admin", "platform_operator"})

#: Tokens carry an issuer and a scope so a staff token is distinguishable from
#: a public one even though both are signed with the same secret. Issue #80,
#: decision: separate issuer + scope claim, one users table.
PUBLIC_TOKEN_ISSUER = "denthub-public"
STAFF_TOKEN_ISSUER = "denthub-staff"
PUBLIC_SCOPE = "public"
STAFF_SCOPE = "staff"

#: Roles that may perform a user-admin action such as approving an account.
ADMIN_ROLES: frozenset[str] = frozenset({"admin", "super_admin"})

#: Roles that are Patients (PRD §2): a person seeking care, including one
#: travelling across borders for it. Only they may book and read their own
#: Appointments; every other account type is a provider or a platform role.
PATIENT_ROLES: frozenset[str] = frozenset({"patient", "international_patient"})

#: Roles that own a Supplier storefront (root AGENTS.md, "Auth and security" —
#: the set is confirmed with the maintainer per route group, #78).
SUPPLIER_ROLES: frozenset[str] = frozenset({"supplier"})

#: Roles that own a Training Provider and its CPD programme (root AGENTS.md,
#: "Auth and security" — confirmed with the maintainer per route group, #79).
TRAINING_PROVIDER_ROLES: frozenset[str] = frozenset({"training_provider"})

#: How long an emailed link stays usable (#120, settled with the maintainer).
VERIFY_EMAIL_TTL = timedelta(hours=48)
RESET_PASSWORD_TTL = timedelta(hours=1)

#: bcrypt only reads the first 72 bytes; longer passwords are refused at the
#: boundary as a 422 rather than silently truncated (backend AGENTS.md, "Auth").
MIN_PASSWORD_LENGTH = 8
MAX_PASSWORD_BYTES = 72


def is_staff_role(role: str) -> bool:
    """Whether a stored role is a staff role rather than a public one."""
    return role in STAFF_ROLES


def is_staff_surface_role(role: str) -> bool:
    """Whether a stored role may use the staff surface (``/staff/access``)."""
    return role in STAFF_SURFACE_ROLES


class ProfileSummary(BaseModel):
    """One Profile a User holds (``CONTEXT.md`` "Profile")."""

    kind: ProfileKind


class MembershipSummary(BaseModel):
    """One Facility Membership, with the Facility's name so a client can say
    who the User is acting for without a second lookup."""

    facility_id: str
    facility_name: str
    permissions: list[FacilityPermission]


class UserResponse(BaseModel):
    """Public view of a user.

    ``role`` is unchanged while clients migrate off it (ADR-0006); ``profiles``
    and ``memberships`` are what the User actually acts as.
    """

    id: str
    email: str
    role: str
    full_name: str
    is_staff: bool
    account_status: AccountStatus = "active"
    email_verified: bool = False
    profiles: list[ProfileSummary] = []
    memberships: list[MembershipSummary] = []


class AuthResponseModel(BaseModel):
    """Response containing access token and user metadata."""

    access_token: str
    token_type: str
    user: UserResponse


class UserSignup(BaseModel):
    """Input parameters for signing up.

    The account type is the only thing a caller may choose; a `role` field in
    the body is ignored rather than trusted, because a role is granted, never
    requested (root AGENTS.md, "Auth and security").
    """

    full_name: str
    email: EmailStr
    password: str
    account_type: AccountType = "patient"
    phone: str | None = None


class UserLogin(BaseModel):
    """Input parameters for logging in."""

    email: EmailStr
    password: str


def _check_new_password(value: str) -> str:
    if len(value) < MIN_PASSWORD_LENGTH:
        raise ValueError(f"Password must be at least {MIN_PASSWORD_LENGTH} characters")
    if len(value.encode("utf-8")) > MAX_PASSWORD_BYTES:
        raise ValueError(f"Password must be at most {MAX_PASSWORD_BYTES} bytes")
    return value


NewPassword = Annotated[str, AfterValidator(_check_new_password)]


#: Emailed tokens are 43 characters (``secrets.token_urlsafe(32)``); anything
#: far longer is not one of ours.
EmailedToken = Annotated[str, Field(max_length=128)]


class VerifyEmailRequest(BaseModel):
    token: EmailedToken


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ForgotPasswordResponse(BaseModel):
    """The same answer whether or not the email has an account."""

    message: str


class ResetPasswordRequest(BaseModel):
    token: EmailedToken
    new_password: NewPassword


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(max_length=256)
    new_password: NewPassword


def hash_password(password: str) -> str:
    """Hash a password using bcrypt."""
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password.encode("utf-8"), salt)
    return hashed.decode("utf-8")


def verify_password(password: str, hashed: str) -> bool:
    """Verify a hashed password."""
    try:
        return bcrypt.checkpw(
            password.encode("utf-8"),
            hashed.encode("utf-8"),
        )
    except Exception:
        return False


def _utcnow() -> datetime:
    """Naive UTC, matching how every ``DateTime`` column here is stored."""
    return datetime.now(UTC).replace(tzinfo=None)


def _password_stamp(changed_at: datetime | None) -> str | None:
    return changed_at.isoformat() if changed_at else None


def create_access_token(
    state: AppState,
    user_id: str,
    role: str,
    *,
    scope: str = PUBLIC_SCOPE,
    password_changed_at: datetime | None = None,
) -> str:
    """Create a new JSON Web Token for authentication.

    ``scope`` selects the token kind: a public token (the default) or a staff
    token minted by the staff sign-in route. Both are signed with the same
    secret, so the issuer and scope claims are what a staff route checks.

    The ``pwd`` claim stamps the User's ``password_changed_at``; ``authenticate``
    refuses a token whose stamp is stale, so a password change ends every older
    session exactly (``iat`` has only one-second resolution).
    """

    settings = state.settings

    now = datetime.now(UTC)
    expire = now + timedelta(days=7)

    issuer = STAFF_TOKEN_ISSUER if scope == STAFF_SCOPE else PUBLIC_TOKEN_ISSUER

    payload = {
        "sub": user_id,
        "role": role,
        "scope": scope,
        "iss": issuer,
        "iat": int(now.timestamp()),
        "exp": int(expire.timestamp()),
        "pwd": _password_stamp(password_changed_at),
    }

    return jwt.encode(
        payload,
        settings.jwt_secret_key,
        algorithm=settings.jwt_algorithm,
    )


def decode_access_token(
    state: AppState,
    token: str,
) -> dict[str, Any]:
    """Decode and validate an access token."""

    settings = state.settings

    return jwt.decode(
        token,
        settings.jwt_secret_key,
        algorithms=[settings.jwt_algorithm],
    )


async def signup_user(
    state: AppState,
    data: UserSignup,
) -> AuthResponseModel:
    """Create a new user, persist to database, and return auth token."""

    async with state.db_session_maker() as session:
        # Check if email is already registered
        existing = await UserRepository.get_by_email(
            session,
            data.email,
        )

        if existing:
            raise ConflictError(message="A user with this email already exists")

        # Hash password and save user. Professional accounts start life pending
        # (staff review); patient accounts are active immediately.
        account_status = "pending" if data.account_type in PROFESSIONAL_ACCOUNT_TYPES else "active"
        password_hash = hash_password(data.password)

        user = await UserRepository.create(
            session,
            full_name=data.full_name,
            email=data.email,
            password_hash=password_hash,
            role=data.account_type,
            phone=data.phone,
            account_status=account_status,
        )

        # Write the new shape beside users.role from the expand release on
        # (ADR-0006), so no signup ever needs backfilling.
        kind = PROFILE_FOR_ACCOUNT_TYPE.get(data.account_type)
        if kind is not None:
            await ProfileRepository.add(session, user_id=user.id, kind=kind)

        verify_token = await _issue_token(session, user, "verify_email", VERIFY_EMAIL_TTL)
        await session.commit()

    await _send_verification_email(state, user, verify_token)

    token = create_access_token(
        state,
        user.id,
        user.role,
    )

    return AuthResponseModel(
        access_token=token,
        token_type="bearer",
        user=await describe_user(state, user),
    )


async def login_user(
    state: AppState,
    data: UserLogin,
) -> AuthResponseModel:
    """Verify email/password and return auth token."""

    async with state.db_session_maker() as session:
        user = await UserRepository.get_by_email(
            session,
            data.email,
        )

        if not user or not verify_password(
            data.password,
            user.password_hash,
        ):
            raise UnauthorizedException(message="Incorrect email or password")

        if not user.is_active:
            raise ForbiddenException(message="User account is deactivated")

        token = create_access_token(
            state,
            user.id,
            user.role,
            password_changed_at=user.password_changed_at,
        )

        return AuthResponseModel(
            access_token=token,
            token_type="bearer",
            user=await user_response(session, user),
        )


async def login_staff(
    state: AppState,
    data: UserLogin,
) -> AuthResponseModel:
    """Verify credentials for the staff surface and mint a staff token.

    The same users table backs both surfaces; a staff token is marked by its
    issuer and ``scope`` claim (issue #80). An account that is not platform
    staff is refused even with correct credentials — it simply has no staff
    surface to sign in to.
    """

    async with state.db_session_maker() as session:
        user = await UserRepository.get_by_email(
            session,
            data.email,
        )

        if not user or not verify_password(
            data.password,
            user.password_hash,
        ):
            raise UnauthorizedException(message="Incorrect email or password")

        if not user.is_active:
            raise ForbiddenException(message="User account is deactivated")

        if not is_staff_surface_role(user.role):
            raise ForbiddenException(message="This account may not sign in at the staff surface")

        token = create_access_token(
            state,
            user.id,
            user.role,
            scope=STAFF_SCOPE,
            password_changed_at=user.password_changed_at,
        )

        return AuthResponseModel(
            access_token=token,
            token_type="bearer",
            user=await user_response(session, user),
        )


def _decode_or_unauthorized(state: AppState, token: str) -> dict[str, Any]:
    """Decode a token, mapping any JWT failure to a 401."""
    try:
        return decode_access_token(
            state,
            token,
        )

    except jwt.PyJWTError as e:
        raise UnauthorizedException(
            message="Invalid or expired access token",
            detail=str(e),
        ) from e


async def _load_user_from_payload(state: AppState, payload: dict[str, Any]) -> User:
    """Load the payload's subject from the database, or raise a 401."""
    user_id = payload.get("sub")

    if not user_id:
        raise UnauthorizedException(message="Token payload invalid: subject missing")

    async with state.db_session_maker() as session:
        user = await UserRepository.get_by_id(
            session,
            user_id,
        )

        if not user:
            raise UnauthorizedException(message="User not found")

        return user


async def authenticate(state: AppState, token: str, *, scope: str) -> User:
    """The active User behind a token minted for ``scope``, or a 401/403.

    The one gate every authenticated route goes through (via the dependencies in
    ``app/dependencies.py``). A token for the other surface is refused (403), so
    a staff token never reaches a public route and a public token never reaches
    a staff one (ADR-0004). The issuer must match the scope too: a token whose
    claims disagree was not minted by ``create_access_token`` and is a 401.
    """
    payload = _decode_or_unauthorized(state, token)

    if payload.get("scope") != scope:
        raise ForbiddenException(message=f"A {scope} access token is required for this route")

    expected_issuer = STAFF_TOKEN_ISSUER if scope == STAFF_SCOPE else PUBLIC_TOKEN_ISSUER
    if payload.get("iss") != expected_issuer:
        raise UnauthorizedException(message="Invalid or expired access token")

    user = await _load_user_from_payload(state, payload)

    if not user.is_active:
        raise ForbiddenException(message="User account is deactivated")

    if payload.get("pwd") != _password_stamp(user.password_changed_at):
        raise UnauthorizedException(message="Session ended by a password change")

    if scope == STAFF_SCOPE and not is_staff_surface_role(user.role):
        raise ForbiddenException(message="This account may not use the staff surface")

    return user


async def user_response(session: AsyncSession, user: User) -> UserResponse:
    """The public shape of a User, as ``/auth/me`` and the sign-in routes return it."""
    kinds = await ProfileRepository.kinds_for_user(session, user.id)
    memberships = await ProfileRepository.memberships_for_user(session, user.id)
    return UserResponse(
        id=user.id,
        email=user.email,
        role=user.role,
        full_name=user.full_name,
        is_staff=is_staff_role(user.role),
        account_status=cast(AccountStatus, user.account_status),
        email_verified=user.email_verified_at is not None,
        profiles=[ProfileSummary(kind=kind) for kind in kinds],
        memberships=[
            MembershipSummary(
                facility_id=m.facility_id,
                facility_name=m.facility_name,
                permissions=m.permissions,
            )
            for m in memberships
        ],
    )


async def describe_user(state: AppState, user: User) -> UserResponse:
    """``user_response`` in its own session, for ``/auth/me`` and ``/auth/staff/me``."""
    async with state.db_session_maker() as session:
        return await user_response(session, user)


# --- Emailed tokens: email verification and password reset (#120) -----------


async def _issue_token(
    session: AsyncSession, user: User, purpose: TokenPurpose, ttl: timedelta
) -> str:
    """A fresh single-use token for ``user``; only its hash is stored."""
    token = secrets.token_urlsafe(32)
    now = _utcnow()
    await UserTokenRepository.issue(
        session,
        user_id=user.id,
        purpose=purpose,
        token=token,
        expires_at=now + ttl,
        now=now,
    )
    return token


async def _send_verification_email(state: AppState, user: User, token: str) -> None:
    link = f"{state.settings.frontend_url}/verify-email?token={token}"
    await state.mailer.send(
        OutgoingEmail(
            to=user.email,
            subject="Confirm your DentHub email",
            text=(
                f"Hi {user.full_name},\n\n"
                f"Confirm this is your email address by opening the link below. "
                f"It works once and expires in {_hours(VERIFY_EMAIL_TTL)}.\n\n{link}\n\n"
                "If you didn't create a DentHub account, you can ignore this email."
            ),
        )
    )


def _hours(ttl: timedelta) -> str:
    hours = int(ttl.total_seconds() // 3600)
    return "an hour" if hours == 1 else f"{hours} hours"


async def _spend_token(
    session: AsyncSession, token: str, purpose: TokenPurpose, now: datetime
) -> User:
    """The active User a live token belongs to, spending the token; else a 400."""
    user_id = await UserTokenRepository.spend(session, token=token, purpose=purpose, now=now)
    user = await UserRepository.get_by_id(session, user_id) if user_id else None
    if user is None or not user.is_active:
        raise InvalidRequestError(message="This link is invalid or has expired")
    return user


async def verify_email(state: AppState, data: VerifyEmailRequest) -> None:
    """Spend a verification token and mark its User's email verified."""
    now = _utcnow()
    async with state.db_session_maker() as session:
        user = await _spend_token(session, data.token, "verify_email", now)
        user.email_verified_at = user.email_verified_at or now
        await session.commit()


async def resend_verification_email(state: AppState, *, actor: User) -> None:
    """Email the signed-in User a fresh link; earlier links stop working."""
    if actor.email_verified_at is not None:
        raise ConflictError(message="This email is already verified")

    async with state.db_session_maker() as session:
        token = await _issue_token(session, actor, "verify_email", VERIFY_EMAIL_TTL)
        await session.commit()

    await _send_verification_email(state, actor, token)


FORGOT_PASSWORD_MESSAGE = "If that email has a DentHub account, we've sent a reset link to it."


#: Runs work after the response is sent (the route passes FastAPI's
#: ``BackgroundTasks.add_task``), so logic stays free of the request.
Defer = Callable[..., Any]


def forgot_password(
    data: ForgotPasswordRequest, *, state: AppState, defer: Defer
) -> ForgotPasswordResponse:
    """Answer at once, the same way for every email; the reset work runs afterwards.

    Looking the account up, issuing the token, and sending through the provider
    all happen after the response, so neither the body, the status, nor the
    response time says whether the email has an account.
    """
    defer(_send_password_reset, state, data.email)
    return ForgotPasswordResponse(message=FORGOT_PASSWORD_MESSAGE)


async def _send_password_reset(state: AppState, email: str) -> None:
    async with state.db_session_maker() as session:
        user = await UserRepository.get_by_email(session, email)
        if user is None or not user.is_active:
            return
        token = await _issue_token(session, user, "reset_password", RESET_PASSWORD_TTL)
        await session.commit()

    link = f"{state.settings.frontend_url}/reset-password?token={token}"
    await state.mailer.send(
        OutgoingEmail(
            to=user.email,
            subject="Reset your DentHub password",
            text=(
                f"Hi {user.full_name},\n\n"
                "Open the link below to choose a new password. It works once and "
                f"expires in {_hours(RESET_PASSWORD_TTL)}.\n\n{link}\n\n"
                "If you didn't ask for this, you can ignore this email; your "
                "password hasn't changed."
            ),
        )
    )


def _set_password(user: User, new_password: str, now: datetime) -> None:
    """Change the hash and stamp the change, which ends every older session."""
    user.password_hash = hash_password(new_password)
    user.password_changed_at = now


async def reset_password(state: AppState, data: ResetPasswordRequest) -> None:
    """Spend a reset token and set its User's new password."""
    now = _utcnow()
    async with state.db_session_maker() as session:
        user = await _spend_token(session, data.token, "reset_password", now)
        _set_password(user, data.new_password, now)
        await session.commit()


async def change_password(
    state: AppState, *, actor: User, data: ChangePasswordRequest
) -> AuthResponseModel:
    """Change the signed-in User's password and return a fresh session.

    Every other session, including the token that made this call, stops working.
    """
    if not verify_password(data.current_password, actor.password_hash):
        raise InvalidRequestError(message="Current password is incorrect")

    async with state.db_session_maker() as session:
        user = await UserRepository.get_by_id(session, actor.id)
        if user is None:
            raise UnauthorizedException(message="User not found")

        _set_password(user, data.new_password, _utcnow())
        await session.commit()

    token = create_access_token(
        state,
        user.id,
        user.role,
        password_changed_at=user.password_changed_at,
    )
    return AuthResponseModel(
        access_token=token, token_type="bearer", user=await describe_user(state, user)
    )
