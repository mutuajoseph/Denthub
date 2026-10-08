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

#: Roles that may perform a user-admin action such as approving an account.
ADMIN_ROLES: frozenset[str] = frozenset({"admin", "super_admin"})


def is_staff_role(role: str) -> bool:
    """Whether a stored role is a staff role rather than a public one."""
    return role in STAFF_ROLES


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
) -> str:
    """Create a new JSON Web Token for authentication."""

    settings = state.settings

    now = datetime.now(UTC)
    expire = now + timedelta(days=7)

    payload = {
        "sub": user_id,
        "role": role,
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


async def get_user_from_token(state: AppState, token: str) -> User:
    """Load the token's subject from the database, rejecting invalid tokens."""
    try:
        payload = decode_access_token(
            state,
            token,
        )

    except jwt.PyJWTError as e:
        raise UnauthorizedException(
            message="Invalid or expired access token",
            detail=str(e),
        ) from e

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
