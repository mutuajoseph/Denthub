"""User administration logic — business rules for staff-managed user actions
and user self-service (account settings, profiles, specialist listing)."""

from __future__ import annotations

from decimal import Decimal
from typing import Any

from pydantic import BaseModel, EmailStr
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.exceptions import ConflictError, NotFoundException
from app.logic.v1.auth import UserResponse, is_staff_role
from app.logic.v1.listing import (
    VerificationTier,
    get_specialist,
)
from app.repositories.admin import AdminAuditRepository
from app.repositories.country import CountryRepository, SpecialtyRepository
from app.repositories.listing import (
    Branch,
    DentistBranch,
    SpecialistRepository,
    SpecialistSpecialty,
)
from app.repositories.profile import (
    ProfileKind,
    ProfileRepository,
)
from app.repositories.user import User, UserRepository
from app.utils.state import AppState


async def _derive_user_role(session: AsyncSession, user: User) -> str:
    """Derive a user's role from their profiles and memberships.

    Per ADR-0006: users.role is null for non-staff users; derive a role for
    backward compatibility until all code migrates to profile-based checks.
    Falls back to user.role for legacy users who have a role but no profiles/memberships.
    """
    if is_staff_role(user.role):
        return user.role

    kinds = await ProfileRepository.kinds_for_user(session, user.id)
    if kinds:
        # Map first profile kind to legacy role name
        profile_to_role = {
            "patient": "patient",
            "specialist": "specialist",
            "supplier": "supplier",
            "training_provider": "training_provider",
        }
        return profile_to_role.get(kinds[0], "patient")

    memberships = await ProfileRepository.memberships_for_user(session, user.id)
    if memberships:
        # Facility membership: owner -> facility_owner, clinical -> facility_dentist,
        # front_office -> front_office
        perms = memberships[0].permissions
        if "owner" in perms:
            return "facility_owner"
        elif "clinical" in perms:
            return "facility_dentist"
        elif "front_office" in perms:
            return "front_office"
        else:
            return "facility_owner"

    # Fallback to user.role for legacy users who have a role but no profiles/memberships
    if user.role:
        return user.role

    return "patient"


async def approve_user(
    state: AppState,
    *,
    actor: User,
    user_id: str,
) -> UserResponse:
    """Set a pending user account to active.

    ``actor`` is an admin on the staff surface; the route's ``current_admin``
    dependency refuses everyone else, as on every ``/admin`` route (ADR-0004).
    The pending state is informational today — a pending professional can still browse
    public modules — but an approval is what future gated routes will check
    first, so the flip itself carries the authorisation check.
    """
    async with state.db_session_maker() as session:
        user = await UserRepository.get_by_id(
            session,
            user_id,
        )

        if not user:
            raise NotFoundException(message="User not found")

        before = user.account_status
        user.account_status = "active"
        await AdminAuditRepository.record(
            session,
            actor_id=actor.id,
            actor_email=actor.email,
            actor_role=actor.role,
            action="user.approve",
            entity_type="user",
            entity_id=user.id,
            before={"account_status": before},
            after={"account_status": "active"},
        )
        await session.commit()

        derived_role = await _derive_user_role(session, user)
        return UserResponse(
            id=user.id,
            email=user.email,
            role=derived_role,
            full_name=user.full_name,
            is_staff=is_staff_role(user.role),
            account_status="active",
        )


class UserMeResponse(BaseModel):
    """User details returned by GET /me and PATCH /me.

    Maintains backward compatibility with UserResponse for profiles and memberships.
    """

    id: str
    email: EmailStr
    full_name: str
    phone: str | None
    home_country_code: str | None
    account_status: str
    role: str
    is_staff: bool
    profiles: list[dict[str, str]]  # Each: {"kind": "patient"} - same as ProfileSummary
    memberships: list[
        dict[str, Any]
    ]  # Each: {"facility_id", "facility_name", "permissions"} - same as MembershipSummary


class UpdateMeRequest(BaseModel):
    """Fields a user may update on their own account."""

    full_name: str | None = None
    phone: str | None = None
    home_country_code: str | None = None


class AddProfileRequest(BaseModel):
    """Request to add a new Profile kind to the user."""

    profile_kind: ProfileKind


class AddProfileResponse(BaseModel):
    """Response after adding a profile."""

    profile_kind: ProfileKind
    message: str


async def get_me(state: AppState, *, user: User) -> UserMeResponse:
    """Return the authenticated user's details including profiles and memberships."""
    async with state.db_session_maker() as session:
        db_user = await UserRepository.get_by_id(session, user.id)
        if not db_user:
            raise NotFoundException(message="User not found")
        kinds = await ProfileRepository.kinds_for_user(session, db_user.id)
        memberships = await ProfileRepository.memberships_for_user(session, db_user.id)
        derived_role = await _derive_user_role(session, db_user)
        return UserMeResponse(
            id=db_user.id,
            email=db_user.email,
            full_name=db_user.full_name,
            phone=db_user.phone,
            home_country_code=db_user.home_country_code,
            account_status=db_user.account_status,
            role=derived_role,
            is_staff=is_staff_role(db_user.role),
            profiles=[{"kind": k} for k in kinds],
            memberships=[
                {
                    "facility_id": m.facility_id,
                    "facility_name": m.facility_name,
                    "permissions": m.permissions,
                }
                for m in memberships
            ],
        )


async def update_me(
    state: AppState,
    *,
    user: User,
    data: UpdateMeRequest,
) -> UserMeResponse:
    """Update the authenticated user's details (name, phone, home country)."""
    async with state.db_session_maker() as session:
        db_user = await UserRepository.get_by_id(session, user.id)
        if not db_user:
            raise NotFoundException(message="User not found")

        if data.full_name is not None:
            db_user.full_name = data.full_name.strip()
        if data.phone is not None:
            db_user.phone = data.phone.strip() if data.phone.strip() else None
        if data.home_country_code is not None:
            # Validate the country exists and is active
            country = await CountryRepository.get(session, data.home_country_code.upper())
            if not country or not country.is_active:
                raise ConflictError(message="Invalid or inactive country")
            db_user.home_country_code = data.home_country_code.upper()

        await session.commit()

        # Reload with profiles and memberships
        kinds = await ProfileRepository.kinds_for_user(session, db_user.id)
        memberships = await ProfileRepository.memberships_for_user(session, db_user.id)
        derived_role = await _derive_user_role(session, db_user)
        return UserMeResponse(
            id=db_user.id,
            email=db_user.email,
            full_name=db_user.full_name,
            phone=db_user.phone,
            home_country_code=db_user.home_country_code,
            account_status=db_user.account_status,
            role=derived_role,
            is_staff=is_staff_role(db_user.role),
            profiles=[{"kind": k} for k in kinds],
            memberships=[
                {
                    "facility_id": m.facility_id,
                    "facility_name": m.facility_name,
                    "permissions": m.permissions,
                }
                for m in memberships
            ],
        )


async def add_profile(
    state: AppState,
    *,
    user: User,
    data: AddProfileRequest,
) -> AddProfileResponse:
    """Add a new Profile kind to the authenticated user."""
    async with state.db_session_maker() as session:
        existing_kinds = await ProfileRepository.kinds_for_user(session, user.id)
        if data.profile_kind in existing_kinds:
            raise ConflictError(message=f"User already has a {data.profile_kind} profile")

        await ProfileRepository.add(session, user_id=user.id, kind=data.profile_kind)
        await session.commit()

        return AddProfileResponse(
            profile_kind=data.profile_kind,
            message=f"{data.profile_kind.capitalize()} profile added successfully",
        )


class SpecialistMeResponse(BaseModel):
    """The authenticated user's specialist listing (if they have one)."""

    id: str
    name: str
    slug: str
    specialties: list[str]  # Specialty codes
    branches: list[dict[str, Any]]  # Branch summaries
    verification_tier: VerificationTier
    list_price: Decimal | None
    currency: str
    rating: Decimal | None
    review_count: int


class UpdateSpecialistMeRequest(BaseModel):
    """Fields a specialist may update on their own listing."""

    name: str | None = None
    specialty_codes: list[str] | None = None
    branch_ids: list[str] | None = None
    list_price: Decimal | None = None


async def get_dentist_me(state: AppState, *, user: User) -> SpecialistMeResponse | None:
    """Return the authenticated user's specialist listing if they have one."""
    async with state.db_session_maker() as session:
        # Find the specialist linked to this user
        specialist = await SpecialistRepository.get_by_user_id(session, user.id)
        if not specialist:
            return None

        detail = await get_specialist(state, specialist_id=specialist.id)
        return SpecialistMeResponse(
            id=detail.listing.id,
            name=detail.listing.name,
            slug=detail.slug,
            specialties=[s.code for s in detail.specialties],
            branches=[
                {
                    "id": b.id,
                    "facility_name": b.facility_name,
                    "subdivision_code": b.subdivision_code,
                    "address": b.address,
                    "phone": b.phone,
                    "email": b.email,
                    "open_now": b.open_now,
                }
                for b in detail.branches
            ],
            verification_tier=detail.listing.verification_tier or "unverified",
            list_price=detail.listing.list_price,
            currency=detail.listing.currency,
            rating=detail.listing.rating,
            review_count=detail.listing.review_count,
        )


async def update_dentist_me(
    state: AppState,
    *,
    user: User,
    data: UpdateSpecialistMeRequest,
) -> SpecialistMeResponse:
    """Update the authenticated user's specialist listing."""
    async with state.db_session_maker() as session:
        specialist = await SpecialistRepository.get_by_user_id(session, user.id)
        if not specialist:
            raise NotFoundException(message="Specialist listing not found for this user")

        if data.name is not None:
            specialist.name = data.name.strip()
        if data.specialty_codes is not None:
            # Detach all existing specialties and attach new ones
            await session.execute(
                delete(SpecialistSpecialty).where(
                    SpecialistSpecialty.specialist_id == specialist.id
                )
            )
            for code in data.specialty_codes:
                spec = await SpecialtyRepository.get_by_code(session, code.upper())
                if spec:
                    await SpecialistRepository.attach_specialty(session, specialist, spec)
        if data.branch_ids is not None:
            # Detach all existing branches and attach new ones
            await session.execute(
                delete(DentistBranch).where(DentistBranch.specialist_id == specialist.id)
            )
            for branch_id in data.branch_ids:
                stmt = select(Branch).where(Branch.id == branch_id)
                result = await session.execute(stmt)
                branch = result.scalar_one_or_none()
                if branch:
                    await SpecialistRepository.attach_branch(session, specialist, branch)
        if data.list_price is not None:
            specialist.list_price = data.list_price

        await session.commit()

        # Return updated
        detail = await get_specialist(state, specialist_id=specialist.id)
        return SpecialistMeResponse(
            id=detail.listing.id,
            name=detail.listing.name,
            slug=detail.slug,
            specialties=[s.code for s in detail.specialties],
            branches=[
                {
                    "id": b.id,
                    "facility_name": b.facility_name,
                    "subdivision_code": b.subdivision_code,
                    "address": b.address,
                    "phone": b.phone,
                    "email": b.email,
                    "open_now": b.open_now,
                }
                for b in detail.branches
            ],
            verification_tier=detail.listing.verification_tier or "unverified",
            list_price=detail.listing.list_price,
            currency=detail.listing.currency,
            rating=detail.listing.rating,
            review_count=detail.listing.review_count,
        )


class CreateSpecialistMeRequest(BaseModel):
    """Request to create a specialist listing for the authenticated user."""

    name: str
    slug: str
    specialty_codes: list[str] = []
    branch_ids: list[str] = []
    list_price: Decimal | None = None


async def create_dentist_me(
    state: AppState,
    *,
    user: User,
    data: CreateSpecialistMeRequest,
) -> SpecialistMeResponse:
    """Create a specialist listing for the authenticated user if they have a specialist profile."""
    async with state.db_session_maker() as session:
        # Check if user has a specialist profile
        kinds = await ProfileRepository.kinds_for_user(session, user.id)
        if "specialist" not in kinds:
            raise ConflictError(message="User must have a specialist profile to create a listing")

        # Check if listing already exists
        existing = await SpecialistRepository.get_by_user_id(session, user.id)
        if existing:
            raise ConflictError(message="Specialist listing already exists for this user")

        # Validate slug is unique
        if await SpecialistRepository.find_by_slug(session, data.slug.lower()):
            raise ConflictError(message="Slug already taken")

        # Create the specialist listing
        specialist = await SpecialistRepository.create(
            session,
            name=data.name.strip(),
            slug=data.slug.lower(),
            user_id=user.id,
            country_code=user.home_country_code or "KE",
            subdivision_code="NAIROBI",  # Default, user can update later
            currency="KES",  # Default, will be overridden by country
            verification_tier="unverified",
        )

        # Attach specialties
        for code in data.specialty_codes:
            spec = await SpecialtyRepository.get_by_code(session, code.upper())
            if spec:
                await SpecialistRepository.attach_specialty(session, specialist, spec)

        # Attach branches
        for branch_id in data.branch_ids:
            stmt = select(Branch).where(Branch.id == branch_id)
            result = await session.execute(stmt)
            branch = result.scalar_one_or_none()
            if branch:
                await SpecialistRepository.attach_branch(session, specialist, branch)

        if data.list_price is not None:
            specialist.list_price = data.list_price

        await session.commit()

        # Return the created listing
        detail = await get_specialist(state, specialist_id=specialist.id)
        return SpecialistMeResponse(
            id=detail.listing.id,
            name=detail.listing.name,
            slug=detail.slug,
            specialties=[s.code for s in detail.specialties],
            branches=[
                {
                    "id": b.id,
                    "facility_name": b.facility_name,
                    "subdivision_code": b.subdivision_code,
                    "address": b.address,
                    "phone": b.phone,
                    "email": b.email,
                    "open_now": b.open_now,
                }
                for b in detail.branches
            ],
            verification_tier=detail.listing.verification_tier or "unverified",
            list_price=detail.listing.list_price,
            currency=detail.listing.currency,
            rating=detail.listing.rating,
            review_count=detail.listing.review_count,
        )
