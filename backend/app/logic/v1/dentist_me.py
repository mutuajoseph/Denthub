"""A Specialist's own listing: ``/dentists/me`` (#119).

The caller acts as the Specialist Profile they hold, never as a bare User, so
the route is gated on a Specialist Profile and every read and write is scoped
to ``specialists.user_id = caller.id``. The public detail route keeps its shape;
these models are the editing surface and are additive.
"""

from __future__ import annotations

import re
import uuid
from datetime import UTC, datetime

from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.exceptions import (
    ConflictError,
    ForbiddenException,
    InvalidRequestError,
    NotFoundException,
)
from app.logic.v1.country import (
    CountryConfigurationMissingException,
    SpecialtyResponse,
)
from app.logic.v1.listing import (
    BranchResponse,
    VerificationTier,
    serialize_branch,
    serialize_specialties,
)
from app.repositories.country import (
    Country,
    CountryRepository,
    Specialty,
    SpecialtyRepository,
    SubdivisionRepository,
)
from app.repositories.listing import (
    BranchRepository,
    Specialist,
    SpecialistRepository,
)
from app.repositories.profile import ProfileRepository
from app.repositories.user import User
from app.utils.state import AppState

_SLUG_MAX = 150
_SLUG_ATTEMPTS = 8


class MySpecialist(BaseModel):
    """The caller's own Specialist listing, as the account settings editor reads it."""

    id: str
    name: str
    slug: str
    bio: str | None
    avatar_key: str | None
    country_code: str
    subdivision_code: str
    currency: str
    verification_tier: VerificationTier
    specialties: list[SpecialtyResponse]
    branches: list[BranchResponse]


class MySpecialistCreate(BaseModel):
    """Create the listing behind an existing Specialist Profile."""

    name: str | None = Field(default=None, max_length=150)
    country_code: str = Field(min_length=2, max_length=2)
    subdivision_code: str = Field(min_length=1, max_length=30)
    bio: str | None = Field(default=None, max_length=4000)
    avatar_key: str | None = Field(default=None, max_length=255)
    specialty_codes: list[str] = Field(default_factory=list)
    branch_ids: list[str] = Field(default_factory=list)


class MySpecialistUpdate(BaseModel):
    """The listing fields a Specialist may change; omitted fields stay unchanged."""

    name: str | None = Field(default=None, max_length=150)
    country_code: str | None = Field(default=None, max_length=2)
    subdivision_code: str | None = Field(default=None, max_length=30)
    bio: str | None = Field(default=None, max_length=4000)
    avatar_key: str | None = Field(default=None, max_length=255)
    specialty_codes: list[str] | None = None
    branch_ids: list[str] | None = None


def _slugify(value: str) -> str:
    base = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return base or "specialist"


async def _unique_slug(session: AsyncSession, name: str) -> str:
    """Derive a free slug from the listing name, suffixing on collision."""
    base = _slugify(name)[:_SLUG_MAX]

    if await SpecialistRepository.find_by_slug(session, base) is None:
        return base

    for _ in range(_SLUG_ATTEMPTS):
        candidate = f"{base[: _SLUG_MAX - 7]}-{uuid.uuid4().hex[:6]}"
        if await SpecialistRepository.find_by_slug(session, candidate) is None:
            return candidate

    raise ConflictError(message="Could not derive a unique Specialist slug")


async def _require_specialist_profile(session: AsyncSession, actor: User) -> None:
    if not await ProfileRepository.has_kind(session, user_id=actor.id, kind="specialist"):
        raise ForbiddenException(message="A Specialist Profile is required for this route")


async def _active_country(session: AsyncSession, code: str) -> Country:
    country = await CountryRepository.get(session, code)

    if country is None or not country.is_active:
        raise InvalidRequestError(message="Unknown or inactive Country")

    return country


async def _listing_country(session: AsyncSession, code: str) -> Country:
    country = await CountryRepository.get(session, code)

    if country is None:
        raise CountryConfigurationMissingException()

    return country


async def _validate_subdivision(
    session: AsyncSession, *, country_code: str, subdivision_code: str
) -> None:
    subdivision = await SubdivisionRepository.get_by_code(
        session, country_code=country_code, code=subdivision_code
    )

    if subdivision is None:
        raise InvalidRequestError(message="Unknown Subdivision for that Country")


async def _specialty_rows(session: AsyncSession, codes: list[str]) -> list[Specialty]:
    rows = await SpecialtyRepository.get_by_codes(session, codes)
    found = {row.code for row in rows}
    missing = [code for code in dict.fromkeys(codes) if code not in found]

    if missing:
        raise InvalidRequestError(message=f"Unknown Specialty: {', '.join(missing)}")

    return rows


async def _validated_branch_ids(
    session: AsyncSession, branch_ids: list[str], *, country_code: str
) -> list[str]:
    rows = await BranchRepository.get_many(session, branch_ids)
    found = {row.id for row in rows}
    missing = [branch_id for branch_id in dict.fromkeys(branch_ids) if branch_id not in found]

    if missing:
        raise InvalidRequestError(message=f"Unknown Workplace: {', '.join(missing)}")

    if any(row.facility.country_code != country_code for row in rows):
        raise InvalidRequestError(message="Every Workplace must be in the listing's Country")

    return list(dict.fromkeys(branch_ids))


def _serialize_my_specialist(specialist: Specialist, country: Country) -> MySpecialist:
    now = datetime.now(UTC)
    branches = sorted(
        specialist.branches,
        key=lambda branch: (branch.facility.name, branch.name or ""),
    )

    return MySpecialist(
        id=specialist.id,
        name=specialist.name,
        slug=specialist.slug,
        bio=specialist.bio,
        avatar_key=specialist.avatar_key,
        country_code=specialist.country_code,
        subdivision_code=specialist.subdivision_code,
        currency=specialist.currency,
        verification_tier=specialist.verification_tier,
        specialties=serialize_specialties(specialist.specialties),
        branches=[
            serialize_branch(
                branch,
                facility_name=branch.facility.name,
                timezone_name=country.timezone,
                now=now,
            )
            for branch in branches
        ],
    )


async def get_my_specialist(state: AppState, *, actor: User) -> MySpecialist:
    """The caller's listing, or a 404 until they create one."""
    async with state.db_session_maker() as session:
        await _require_specialist_profile(session, actor)
        specialist = await SpecialistRepository.get_by_user(session, actor.id)

        if specialist is None:
            raise NotFoundException(message="Specialist listing not found")

        country = await _listing_country(session, specialist.country_code)
        return _serialize_my_specialist(specialist, country)


async def create_my_specialist(
    state: AppState, *, actor: User, data: MySpecialistCreate
) -> MySpecialist:
    """Create the one listing a Specialist Profile may own."""
    async with state.db_session_maker() as session:
        await _require_specialist_profile(session, actor)

        if await SpecialistRepository.get_by_user(session, actor.id) is not None:
            raise ConflictError(message="This account already has a Specialist listing")

        country = await _active_country(session, data.country_code)
        await _validate_subdivision(
            session,
            country_code=country.code,
            subdivision_code=data.subdivision_code,
        )
        specialties = await _specialty_rows(session, data.specialty_codes)
        branch_ids = await _validated_branch_ids(
            session, data.branch_ids, country_code=country.code
        )

        name = (data.name or actor.full_name).strip()
        if not name:
            raise InvalidRequestError(message="Name cannot be empty")

        specialist = await SpecialistRepository.create(
            session,
            user_id=actor.id,
            name=name,
            slug=await _unique_slug(session, name),
            bio=data.bio,
            avatar_key=data.avatar_key,
            country_code=country.code,
            subdivision_code=data.subdivision_code,
            currency=country.currency,
            verification_tier="unverified",
        )
        await SpecialistRepository.replace_specialties(
            session,
            specialist_id=specialist.id,
            specialty_ids=[row.id for row in specialties],
        )
        await SpecialistRepository.replace_branches(
            session,
            specialist_id=specialist.id,
            branch_ids=branch_ids,
        )
        await session.commit()
        session.expunge_all()

        created = await SpecialistRepository.get_by_user(session, actor.id)
        if created is None:
            raise NotFoundException(message="Specialist listing not found")

        return _serialize_my_specialist(created, country)


async def update_my_specialist(
    state: AppState, *, actor: User, data: MySpecialistUpdate
) -> MySpecialist:
    """Apply a partial update to the caller's own listing."""
    fields = data.model_dump(exclude_unset=True)

    async with state.db_session_maker() as session:
        await _require_specialist_profile(session, actor)
        specialist = await SpecialistRepository.get_by_user(session, actor.id)

        if specialist is None:
            raise NotFoundException(message="Specialist listing not found")

        previous_country_code = specialist.country_code

        if "name" in fields:
            name = (fields["name"] or "").strip()
            if not name:
                raise InvalidRequestError(message="Name cannot be empty")
            specialist.name = name

        if "country_code" in fields:
            code = fields["country_code"]
            if code is None:
                raise InvalidRequestError(message="Country cannot be cleared")
            country = await _active_country(session, code)
            specialist.country_code = country.code
            specialist.currency = country.currency
        else:
            country = await _listing_country(session, specialist.country_code)

        if "subdivision_code" in fields:
            subdivision_code = fields["subdivision_code"]
            if subdivision_code is None:
                raise InvalidRequestError(message="Subdivision cannot be cleared")
            await _validate_subdivision(
                session,
                country_code=specialist.country_code,
                subdivision_code=subdivision_code,
            )
            specialist.subdivision_code = subdivision_code
        elif "country_code" in fields:
            await _validate_subdivision(
                session,
                country_code=specialist.country_code,
                subdivision_code=specialist.subdivision_code,
            )

        if "bio" in fields:
            specialist.bio = fields["bio"]

        if "avatar_key" in fields:
            specialist.avatar_key = fields["avatar_key"]

        if "specialty_codes" in fields:
            codes = fields["specialty_codes"]
            if codes is None:
                raise InvalidRequestError(message="Specialties cannot be null")
            specialties = await _specialty_rows(session, codes)
            await SpecialistRepository.replace_specialties(
                session,
                specialist_id=specialist.id,
                specialty_ids=[row.id for row in specialties],
            )

        if "branch_ids" in fields:
            branch_ids = fields["branch_ids"]
            if branch_ids is None:
                raise InvalidRequestError(message="Workplaces cannot be null")
            await SpecialistRepository.replace_branches(
                session,
                specialist_id=specialist.id,
                branch_ids=await _validated_branch_ids(
                    session, branch_ids, country_code=country.code
                ),
            )
        elif (
            "country_code" in fields
            and previous_country_code != country.code
            and any(branch.facility.country_code != country.code for branch in specialist.branches)
        ):
            raise InvalidRequestError(message="Every Workplace must be in the listing's Country")

        await session.commit()
        session.expunge_all()

        updated = await SpecialistRepository.get_by_user(session, actor.id)
        if updated is None:
            raise NotFoundException(message="Specialist listing not found")

        return _serialize_my_specialist(updated, country)
