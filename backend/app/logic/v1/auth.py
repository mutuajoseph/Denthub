"""Authentication and authorization logic.

Handles password hashing, token generation/verification, and signup/login flows.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Any, Literal, cast

import bcrypt
import jwt
from pydantic import BaseModel, EmailStr, model_validator
from sqlalchemy.ext.asyncio import AsyncSession

from app.exceptions import (
    ConflictError,
    ForbiddenException,
    InvalidRequestError,
    UnauthorizedException,
)
from app.repositories.country import Country, CountryRepository, SubdivisionRepository
from app.repositories.listing import BranchRepository, FacilityRepository
from app.repositories.profile import (
    PROFILE_FOR_ACCOUNT_TYPE,
    FacilityPermission,
    ProfileKind,
    ProfileRepository,
)
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
    "facility",
    "supplier",
    "training_provider",
]

#: Whether a user record has been reviewed by staff. Professional accounts
#: (PRD §2) start life "pending"; a staff approval flips them to "active".
AccountStatus = Literal["active", "pending"]

#: Account types whose signup is held for staff review. Patient accounts are
#: active immediately: nothing about a patient profile is gated behind review.
PROFESSIONAL_ACCOUNT_TYPES: frozenset[str] = frozenset(
    {"dentist", "specialist", "intern", "facility", "supplier", "training_provider"}
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
    #: Facility signup creates the Facility and its first Branch, so it needs
    #: the marketplace fields those rows require. Ignored for every other
    #: account type. "facility" is the account type per PRD §2 (not "facility_owner").
    facility_name: str | None = None
    country_code: str | None = None
    subdivision_code: str | None = None
    address: str | None = None

    @model_validator(mode="after")
    def _facility_details_are_required(self) -> UserSignup:
        """A Facility account cannot be created without where it practises."""
        if self.account_type != "facility":
            return self

        required = {
            "facility_name": self.facility_name,
            "country_code": self.country_code,
            "subdivision_code": self.subdivision_code,
            "address": self.address,
        }
        missing = [field for field, value in required.items() if value is None or not value.strip()]
        if missing:
            raise ValueError("A Facility signup requires " + ", ".join(missing) + ".")
        return self


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


@dataclass(frozen=True)
class _FacilitySignup:
    country: Country
    name: str
    subdivision_code: str
    address: str


def _required(value: str | None, field: str) -> str:
    if value is None or not value.strip():
        raise InvalidRequestError(message=f"{field} is required for a Facility signup.")
    return value.strip()


async def _resolve_facility_signup(
    session: AsyncSession,
    data: UserSignup,
) -> _FacilitySignup:
    country = await CountryRepository.get(
        session,
        _required(data.country_code, "country_code").upper(),
    )
    if country is None or not country.is_active:
        raise InvalidRequestError(message="Choose a supported country for the Facility.")

    subdivision_code = _required(data.subdivision_code, "subdivision_code").upper()
    subdivision = await SubdivisionRepository.get(
        session,
        country_code=country.code,
        code=subdivision_code,
    )
    if subdivision is None:
        raise InvalidRequestError(message="Choose a subdivision in the Facility's country.")

    return _FacilitySignup(
        country=country,
        name=_required(data.facility_name, "facility_name"),
        subdivision_code=subdivision.code,
        address=_required(data.address, "address"),
    )


async def _create_facility_for_signup(
    session: AsyncSession,
    *,
    user: User,
    data: UserSignup,
    details: _FacilitySignup,
) -> None:
    facility = await FacilityRepository.create(
        session,
        name=details.name,
        country_code=details.country.code,
        subdivision_code=details.subdivision_code,
        address=details.address,
        phone=data.phone,
        email=data.email,
        currency=details.country.currency,
    )
    await BranchRepository.create(
        session,
        facility_id=facility.id,
        subdivision_code=details.subdivision_code,
        address=details.address,
        phone=data.phone,
        email=data.email,
    )
    await ProfileRepository.add_facility_membership(
        session,
        user_id=user.id,
        facility_id=facility.id,
        owner=True,
    )
    # Existing facility-scoped routes still read this column until ADR-0006's
    # contract step removes it.
    user.facility_id = facility.id
    await session.flush()


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

        facility_signup = (
            await _resolve_facility_signup(session, data)
            if data.account_type == "facility"
            else None
        )

        # Hash password and save user. Professional accounts start life pending
        # (staff review); patient accounts are active immediately.
        account_status = "pending" if data.account_type in PROFESSIONAL_ACCOUNT_TYPES else "active"
        password_hash = hash_password(data.password)

        # Per ADR-0006: users.role narrows to nullable platform_role for Platform Staff only.
        # Non-staff users get their role via Profiles and Memberships, so role is null here.
        user_role: str | None = None

        user = await UserRepository.create(
            session,
            full_name=data.full_name,
            email=data.email,
            password_hash=password_hash,
            role=user_role,
            phone=data.phone,
            account_status=account_status,
        )

        # Write the new shape beside users.role from the expand release on
        # (ADR-0006), so no signup ever needs backfilling.
        kind = PROFILE_FOR_ACCOUNT_TYPE.get(data.account_type)
        if kind is not None:
            await ProfileRepository.add(session, user_id=user.id, kind=kind)

        if facility_signup is not None:
            await _create_facility_for_signup(
                session,
                user=user,
                data=data,
                details=facility_signup,
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
            user=await user_response(session, user),
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

    if scope == STAFF_SCOPE and not is_staff_surface_role(user.role):
        raise ForbiddenException(message="This account may not use the staff surface")

    return user


async def user_response(session: AsyncSession, user: User) -> UserResponse:
    """The public shape of a User, as ``/auth/me`` and the sign-in routes return it."""
    kinds = await ProfileRepository.kinds_for_user(session, user.id)
    memberships = await ProfileRepository.memberships_for_user(session, user.id)

    # Per ADR-0006: users.role is null for non-staff users; derive a role for
    # backward compatibility until the frontend migrates off it.
    # Platform Staff keep their role; non-staff get a derived role from profiles/memberships.
    if is_staff_role(user.role):
        derived_role = user.role
    elif kinds:
        # Map first profile kind to legacy role name
        profile_to_role = {
            "patient": "patient",
            "specialist": "specialist",
            "supplier": "supplier",
            "training_provider": "training_provider",
        }
        derived_role = profile_to_role.get(kinds[0], "patient")
    elif memberships:
        # Facility membership: owner -> facility_owner, clinical -> facility_dentist,
        # front_office -> front_office
        perms = memberships[0].permissions
        if "owner" in perms:
            derived_role = "facility_owner"
        elif "clinical" in perms:
            derived_role = "facility_dentist"
        elif "front_office" in perms:
            derived_role = "front_office"
        else:
            derived_role = "facility_owner"
    else:
        derived_role = "patient"

    return UserResponse(
        id=user.id,
        email=user.email,
        role=derived_role,
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
