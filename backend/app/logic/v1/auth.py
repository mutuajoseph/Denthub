"""Authentication and authorization logic.

Handles password hashing, token generation/verification, and signup/login flows.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Any, Literal, cast

import bcrypt
import jwt
from pydantic import BaseModel, EmailStr
from sqlalchemy.ext.asyncio import AsyncSession

from app.exceptions import ConflictError, ForbiddenException, UnauthorizedException
from app.repositories.profile import (
    PROFILE_FOR_ACCOUNT_TYPE,
    FacilityPermission,
    ProfileKind,
    ProfileRepository,
)
from app.repositories.refresh_token import RefreshTokenRepository
from app.repositories.user import User, UserRepository
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

#: How long an access token lives (ADR-0003 follow-up, #121). Short enough that
#: a leaked bearer token stops working quickly; the refresh cookie keeps the
#: session alive without re-entering a password.
ACCESS_TOKEN_TTL = timedelta(minutes=15)

#: How long a sign-in survives without re-authenticating. The cookie is rotated
#: on every refresh, so this slides forward for an active session.
REFRESH_TOKEN_TTL = timedelta(days=30)

#: Cookie names and paths, one pair per auth surface. Separate names and paths
#: mean a staff cookie can never refresh a public session, or the reverse.
PUBLIC_REFRESH_COOKIE = "denthub_refresh"
STAFF_REFRESH_COOKIE = "denthub_staff_refresh"
PUBLIC_REFRESH_PATH = "/api/v1/auth"
STAFF_REFRESH_PATH = "/api/v1/auth/staff"


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
    profiles: list[ProfileSummary] = []
    memberships: list[MembershipSummary] = []


class AuthResponseModel(BaseModel):
    """Response containing access token and user metadata."""

    access_token: str
    token_type: str
    user: UserResponse


@dataclass(frozen=True)
class Session:
    """One signed-in session.

    ``response`` is the JSON body the client sees. ``refresh_token`` is set by
    the route as an httpOnly cookie and is deliberately never in that body.
    """

    response: AuthResponseModel
    refresh_token: str


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


def refresh_cookie_scope(scope: str) -> tuple[str, str]:
    """The (cookie name, cookie path) pair for an auth surface."""
    if scope == STAFF_SCOPE:
        return STAFF_REFRESH_COOKIE, STAFF_REFRESH_PATH
    return PUBLIC_REFRESH_COOKIE, PUBLIC_REFRESH_PATH


def create_access_token(
    state: AppState,
    user_id: str,
    role: str,
    *,
    scope: str = PUBLIC_SCOPE,
) -> str:
    """Create a new JSON Web Token for authentication.

    ``scope`` selects the token kind: a public token (the default) or a staff
    token minted by the staff sign-in route. Both are signed with the same
    secret, so the issuer and scope claims are what a staff route checks.
    """

    settings = state.settings

    now = datetime.now(UTC)
    expire = now + ACCESS_TOKEN_TTL

    issuer = STAFF_TOKEN_ISSUER if scope == STAFF_SCOPE else PUBLIC_TOKEN_ISSUER

    payload = {
        "sub": user_id,
        "role": role,
        "scope": scope,
        "iss": issuer,
        "iat": int(now.timestamp()),
        "exp": int(expire.timestamp()),
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


def _utcnow() -> datetime:
    """Naive UTC, matching every ``DateTime`` column in this app."""
    return datetime.now(UTC).replace(tzinfo=None)


def _sign_refresh_token(
    state: AppState,
    *,
    user_id: str,
    scope: str,
    family_id: str,
    jti: str,
    expires_at: datetime,
) -> str:
    """Sign the refresh cookie's JWT; its ``jti`` is the revocable row key."""
    issuer = STAFF_TOKEN_ISSUER if scope == STAFF_SCOPE else PUBLIC_TOKEN_ISSUER
    now = datetime.now(UTC)
    payload = {
        "sub": user_id,
        "jti": jti,
        "fam": family_id,
        "scope": scope,
        "iss": issuer,
        "iat": int(now.timestamp()),
        "exp": int(expires_at.replace(tzinfo=UTC).timestamp()),
    }
    return jwt.encode(
        payload,
        state.settings.refresh_token_secret,
        algorithm=state.settings.jwt_algorithm,
    )


def decode_refresh_token(state: AppState, token: str) -> dict[str, Any]:
    """Decode a refresh token, mapping any failure to a 401."""
    try:
        return jwt.decode(
            token,
            state.settings.refresh_token_secret,
            algorithms=[state.settings.jwt_algorithm],
        )
    except jwt.PyJWTError as e:
        raise UnauthorizedException(
            message="This session has ended. Sign in again.",
            detail=str(e),
        ) from e


async def _issue_refresh_token(
    session: AsyncSession,
    state: AppState,
    user: User,
    *,
    scope: str,
    family_id: str | None = None,
) -> str:
    """Record a fresh token in one family (a new one on sign-in) and sign it."""
    now = _utcnow()
    family = family_id or RefreshTokenRepository.new_family_id()
    jti = RefreshTokenRepository.new_jti()
    expires_at = now + REFRESH_TOKEN_TTL
    await RefreshTokenRepository.issue(
        session,
        jti=jti,
        user_id=user.id,
        family_id=family,
        scope=scope,
        expires_at=expires_at,
    )
    return _sign_refresh_token(
        state,
        user_id=user.id,
        scope=scope,
        family_id=family,
        jti=jti,
        expires_at=expires_at,
    )


async def _authenticate_session(state: AppState, user: User, *, scope: str) -> Session:
    """The body a sign-in returns, plus a fresh refresh token for its cookie."""
    async with state.db_session_maker() as session:
        refresh_token = await _issue_refresh_token(session, state, user, scope=scope)
        await session.commit()
        response = AuthResponseModel(
            access_token=create_access_token(state, user.id, user.role, scope=scope),
            token_type="bearer",
            user=await user_response(session, user),
        )
    return Session(response=response, refresh_token=refresh_token)


async def signup_user(
    state: AppState,
    data: UserSignup,
) -> Session:
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

        await session.commit()

    return await _authenticate_session(state, user, scope=PUBLIC_SCOPE)


async def login_user(
    state: AppState,
    data: UserLogin,
) -> Session:
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

    return await _authenticate_session(state, user, scope=PUBLIC_SCOPE)


async def login_staff(
    state: AppState,
    data: UserLogin,
) -> Session:
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

    return await _authenticate_session(state, user, scope=STAFF_SCOPE)


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


async def refresh_session(state: AppState, *, token: str | None, scope: str) -> Session:
    """Rotate the refresh cookie and mint a fresh access token.

    Reuse of an already-rotated token is treated as theft: the whole family is
    revoked, so both the attacker's copy and the real session stop working
    (ADR-0003 follow-up, #121).
    """
    if not token:
        raise UnauthorizedException(message="No refresh token was presented")

    payload = decode_refresh_token(state, token)

    if payload.get("scope") != scope:
        raise ForbiddenException(message=f"A {scope} refresh token is required for this route")

    expected_issuer = STAFF_TOKEN_ISSUER if scope == STAFF_SCOPE else PUBLIC_TOKEN_ISSUER
    if payload.get("iss") != expected_issuer:
        raise UnauthorizedException(message="This session has ended. Sign in again.")

    jti = payload.get("jti")
    family_id = payload.get("fam")
    user_id = payload.get("sub")
    if not jti or not family_id or not user_id:
        raise UnauthorizedException(message="This session has ended. Sign in again.")

    now = _utcnow()
    async with state.db_session_maker() as session:
        row = await RefreshTokenRepository.get(session, jti)
        if row is None:
            raise UnauthorizedException(message="This session has ended. Sign in again.")

        if row.revoked_at is not None:
            # A rotated token came back: assume it leaked and end the family.
            await RefreshTokenRepository.revoke_family(session, family_id=row.family_id, now=now)
            await session.commit()
            raise UnauthorizedException(message="This session has ended. Sign in again.")

        if row.expires_at <= now:
            await RefreshTokenRepository.revoke(session, row, now=now)
            await session.commit()
            raise UnauthorizedException(message="This session has ended. Sign in again.")

        user = await UserRepository.get_by_id(session, user_id)
        if user is None or not user.is_active:
            raise UnauthorizedException(message="This session has ended. Sign in again.")

        if scope == STAFF_SCOPE and not is_staff_surface_role(user.role):
            await RefreshTokenRepository.revoke_family(session, family_id=row.family_id, now=now)
            await session.commit()
            raise ForbiddenException(message="This account may not use the staff surface")

        await RefreshTokenRepository.revoke(session, row, now=now)
        new_token = await _issue_refresh_token(
            session, state, user, scope=scope, family_id=row.family_id
        )
        await session.commit()

        response = AuthResponseModel(
            access_token=create_access_token(state, user.id, user.role, scope=scope),
            token_type="bearer",
            user=await user_response(session, user),
        )

    return Session(response=response, refresh_token=new_token)


async def logout_session(state: AppState, *, token: str | None, scope: str) -> None:
    """End the session the refresh cookie names; a no-op when it is already gone."""
    if not token:
        return

    try:
        payload = decode_refresh_token(state, token)
    except UnauthorizedException:
        return

    if payload.get("scope") != scope:
        # The other surface's cookie: leave it alone.
        return

    family_id = payload.get("fam")
    if not family_id:
        return

    async with state.db_session_maker() as session:
        await RefreshTokenRepository.revoke_family(session, family_id=family_id, now=_utcnow())
        await session.commit()
