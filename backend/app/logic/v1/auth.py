"""Authentication and authorization logic.

Handles password hashing, token generation/verification, and signup/login flows.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any, Literal, cast

import bcrypt
import jwt
from pydantic import BaseModel, EmailStr

from app.exceptions import ConflictError, ForbiddenException, UnauthorizedException
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


def is_staff_role(role: str) -> bool:
    """Whether a stored role is a staff role rather than a public one."""
    return role in STAFF_ROLES


def is_staff_surface_role(role: str) -> bool:
    """Whether a stored role may use the staff surface (``/staff/access``)."""
    return role in STAFF_SURFACE_ROLES


class UserResponse(BaseModel):
    """Public view of a user."""

    id: str
    email: str
    role: str
    full_name: str
    is_staff: bool
    account_status: AccountStatus = "active"


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
    expire = now + timedelta(days=7)

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

        await session.commit()

        # Create token
        token = create_access_token(
            state,
            user.id,
            user.role,
        )

        return AuthResponseModel(
            access_token=token,
            token_type="bearer",
            user=UserResponse(
                id=user.id,
                email=user.email,
                role=user.role,
                full_name=user.full_name,
                is_staff=is_staff_role(user.role),
                account_status=cast(AccountStatus, user.account_status),
            ),
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
        )

        return AuthResponseModel(
            access_token=token,
            token_type="bearer",
            user=UserResponse(
                id=user.id,
                email=user.email,
                role=user.role,
                full_name=user.full_name,
                is_staff=is_staff_role(user.role),
                account_status=cast(AccountStatus, user.account_status),
            ),
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
        )

        return AuthResponseModel(
            access_token=token,
            token_type="bearer",
            user=UserResponse(
                id=user.id,
                email=user.email,
                role=user.role,
                full_name=user.full_name,
                is_staff=is_staff_role(user.role),
                account_status=cast(AccountStatus, user.account_status),
            ),
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


async def get_user_from_token(state: AppState, token: str) -> User:
    """Load the token's subject from the database, rejecting invalid tokens."""
    return await _load_user_from_payload(state, _decode_or_unauthorized(state, token))


async def get_current_user(
    state: AppState,
    token: str,
) -> UserResponse:
    """Verify authentication token and return current user details."""

    user = await get_user_from_token(state, token)

    if not user.is_active:
        raise ForbiddenException(message="User account is deactivated")

    return UserResponse(
        id=user.id,
        email=user.email,
        role=user.role,
        full_name=user.full_name,
        is_staff=is_staff_role(user.role),
        account_status=cast(AccountStatus, user.account_status),
    )


async def get_current_staff(
    state: AppState,
    token: str,
) -> UserResponse:
    """Return the current user, requiring a staff-surface token.

    A public token presented here is refused: the ``scope`` claim, not the
    stored role alone, decides whether a caller is on the staff surface.
    """

    payload = _decode_or_unauthorized(state, token)

    if payload.get("scope") != STAFF_SCOPE:
        raise ForbiddenException(message="A staff access token is required for this route")

    user = await _load_user_from_payload(state, payload)

    if not user.is_active:
        raise ForbiddenException(message="User account is deactivated")

    if not is_staff_surface_role(user.role):
        raise ForbiddenException(message="This account may not use the staff surface")

    return UserResponse(
        id=user.id,
        email=user.email,
        role=user.role,
        full_name=user.full_name,
        is_staff=is_staff_role(user.role),
        account_status=cast(AccountStatus, user.account_status),
    )
