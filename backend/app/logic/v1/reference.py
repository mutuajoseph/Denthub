"""Admin console logic for reference data (issue #127).

Reference lists are read by public catalogue endpoints, so an edit here has to
show up there immediately. Every write is audited in the same transaction as the
change, through the one ``audit`` helper.

Deletion is a soft delete: the row's ``is_active`` flag is turned off. A
Subdivision, Specialty, or Treatment that a listing already names must keep
resolving for that listing's history, and a retired Insurance Provider must
still be recognisable on a historic claim. Hard-deleting would either orphan
those references or need a cascade that loses data. Retired rows drop out of
every public list and can be restored through the same update endpoint.
"""

from __future__ import annotations

from pydantic import BaseModel, Field

from app.exceptions import ConflictError, NotFoundException
from app.logic.v1.audit import audit
from app.repositories.country import (
    CountryRepository,
    InsuranceProvider,
    InsuranceProviderRepository,
    Specialty,
    SpecialtyRepository,
    Subdivision,
    SubdivisionRepository,
)
from app.repositories.treatment import Treatment, TreatmentRepository
from app.repositories.user import User
from app.utils.slugs import slug_code
from app.utils.state import AppState

#: Codes are slugs a query string and a client cache key can carry. Hyphens
#: keep them readable while staying URL-safe and stable across edits.
_CODE_PATTERN = r"^[a-z0-9]+(?:-[a-z0-9]+)*$"


class AdminSpecialty(BaseModel):
    """A Specialty as the admin console edits it."""

    id: str
    code: str
    name: str
    description: str | None
    display_order: int
    is_active: bool


class AdminSpecialtyList(BaseModel):
    items: list[AdminSpecialty]


class CreateSpecialtyRequest(BaseModel):
    code: str = Field(min_length=1, max_length=50, pattern=_CODE_PATTERN)
    name: str = Field(min_length=1, max_length=100)
    description: str | None = None
    display_order: int = Field(default=100, ge=0)


class UpdateSpecialtyRequest(BaseModel):
    """Change the display fields. ``code`` is immutable: filters cache it."""

    name: str = Field(min_length=1, max_length=100)
    description: str | None = None
    display_order: int = Field(default=100, ge=0)
    is_active: bool | None = None


class AdminTreatment(BaseModel):
    """A platform-wide Treatment as the admin console edits it."""

    id: str
    code: str
    name: str
    description: str | None
    display_order: int
    is_active: bool


class AdminTreatmentList(BaseModel):
    items: list[AdminTreatment]


class CreateTreatmentRequest(BaseModel):
    code: str = Field(min_length=1, max_length=50, pattern=_CODE_PATTERN)
    name: str = Field(min_length=1, max_length=100)
    description: str | None = None
    display_order: int = Field(default=100, ge=0)


class UpdateTreatmentRequest(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    description: str | None = None
    display_order: int = Field(default=100, ge=0)
    is_active: bool | None = None


class AdminInsuranceProvider(BaseModel):
    """A per-Country insurer as the admin console edits it."""

    id: str
    country_code: str
    name: str
    is_national: bool
    is_active: bool


class AdminInsuranceProviderList(BaseModel):
    country_code: str
    items: list[AdminInsuranceProvider]


class CreateInsuranceProviderRequest(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    is_national: bool = False


class UpdateInsuranceProviderRequest(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    is_national: bool = False
    is_active: bool | None = None


class AdminSubdivision(BaseModel):
    """A Subdivision as the admin console edits it."""

    id: str
    country_code: str
    name: str
    code: str
    is_active: bool


class AdminSubdivisionList(BaseModel):
    country_code: str
    items: list[AdminSubdivision]


class CreateSubdivisionRequest(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    #: Optional: when omitted the server derives the same upper-snake code the
    #: seed script uses. A client that already knows the code may send it.
    code: str | None = Field(default=None, max_length=30)


class UpdateSubdivisionRequest(BaseModel):
    """Change the display name. ``code`` is immutable: listings store it."""

    name: str = Field(min_length=1, max_length=100)
    is_active: bool | None = None


def _serialize_specialty(row: Specialty) -> AdminSpecialty:
    return AdminSpecialty(
        id=row.id,
        code=row.code,
        name=row.name,
        description=row.description,
        display_order=row.display_order,
        is_active=row.is_active,
    )


def _specialty_snapshot(row: Specialty) -> dict[str, object]:
    return {
        "code": row.code,
        "name": row.name,
        "description": row.description,
        "display_order": row.display_order,
        "is_active": row.is_active,
    }


def _serialize_treatment(row: Treatment) -> AdminTreatment:
    return AdminTreatment(
        id=row.id,
        code=row.code,
        name=row.name,
        description=row.description,
        display_order=row.display_order,
        is_active=row.is_active,
    )


def _treatment_snapshot(row: Treatment) -> dict[str, object]:
    return {
        "code": row.code,
        "name": row.name,
        "description": row.description,
        "display_order": row.display_order,
        "is_active": row.is_active,
    }


def _serialize_insurance_provider(row: InsuranceProvider) -> AdminInsuranceProvider:
    return AdminInsuranceProvider(
        id=row.id,
        country_code=row.country_code,
        name=row.name,
        is_national=row.is_national,
        is_active=row.is_active,
    )


def _insurance_provider_snapshot(row: InsuranceProvider) -> dict[str, object]:
    return {
        "name": row.name,
        "is_national": row.is_national,
        "is_active": row.is_active,
    }


def _serialize_subdivision(row: Subdivision) -> AdminSubdivision:
    return AdminSubdivision(
        id=row.id,
        country_code=row.country_code,
        name=row.name,
        code=row.code,
        is_active=row.is_active,
    )


def _subdivision_snapshot(row: Subdivision) -> dict[str, object]:
    return {
        "name": row.name,
        "code": row.code,
        "is_active": row.is_active,
    }


async def _require_country(state: AppState, country_code: str) -> str:
    """Return the canonical Country code, or 404 when the market is unknown."""
    async with state.db_session_maker() as session:
        country = await CountryRepository.get(session, country_code)

    if country is None:
        raise NotFoundException(message="Country not found")
    return country.code


async def list_specialties(state: AppState, *, actor: User) -> AdminSpecialtyList:
    """Every Specialty, retired ones included, in filter-menu order."""
    async with state.db_session_maker() as session:
        rows = await SpecialtyRepository.list_all(session, include_inactive=True)

    return AdminSpecialtyList(items=[_serialize_specialty(row) for row in rows])


async def create_specialty(
    state: AppState,
    *,
    actor: User,
    request: CreateSpecialtyRequest,
) -> AdminSpecialty:
    """Add a Specialty to the reference list."""
    async with state.db_session_maker() as session:
        if await SpecialtyRepository.get_by_code(session, request.code) is not None:
            raise ConflictError(message="A specialty with this code already exists")

        row = await SpecialtyRepository.create(
            session,
            code=request.code,
            name=request.name,
            description=request.description,
            display_order=request.display_order,
        )
        await audit(
            session,
            actor=actor,
            action="specialty.create",
            entity_type="specialty",
            entity_id=row.id,
            before=None,
            after=_specialty_snapshot(row),
        )
        await session.commit()

        return _serialize_specialty(row)


async def update_specialty(
    state: AppState,
    *,
    actor: User,
    specialty_id: str,
    request: UpdateSpecialtyRequest,
) -> AdminSpecialty:
    """Change a Specialty's display fields, or restore a retired one."""
    async with state.db_session_maker() as session:
        row = await SpecialtyRepository.get(session, specialty_id)
        if row is None:
            raise NotFoundException(message="Specialty not found")

        before = _specialty_snapshot(row)
        row.name = request.name
        row.description = request.description
        row.display_order = request.display_order
        if request.is_active is not None:
            row.is_active = request.is_active

        await audit(
            session,
            actor=actor,
            action="specialty.update",
            entity_type="specialty",
            entity_id=row.id,
            before=before,
            after=_specialty_snapshot(row),
        )
        await session.commit()

        return _serialize_specialty(row)


async def delete_specialty(state: AppState, *, actor: User, specialty_id: str) -> None:
    """Retire a Specialty: hide it from filters, keep it on existing rows."""
    async with state.db_session_maker() as session:
        row = await SpecialtyRepository.get(session, specialty_id)
        if row is None:
            raise NotFoundException(message="Specialty not found")

        before = _specialty_snapshot(row)
        row.is_active = False
        await audit(
            session,
            actor=actor,
            action="specialty.delete",
            entity_type="specialty",
            entity_id=row.id,
            before=before,
            after=_specialty_snapshot(row),
        )
        await session.commit()


async def list_treatments(state: AppState, *, actor: User) -> AdminTreatmentList:
    """Every Treatment, retired ones included, in picker order."""
    async with state.db_session_maker() as session:
        rows = await TreatmentRepository.list_all(session, include_inactive=True)

    return AdminTreatmentList(items=[_serialize_treatment(row) for row in rows])


async def create_treatment(
    state: AppState,
    *,
    actor: User,
    request: CreateTreatmentRequest,
) -> AdminTreatment:
    """Add a Treatment to the platform-wide list."""
    async with state.db_session_maker() as session:
        if await TreatmentRepository.get_by_code(session, request.code) is not None:
            raise ConflictError(message="A treatment with this code already exists")

        row = await TreatmentRepository.create(
            session,
            code=request.code,
            name=request.name,
            description=request.description,
            display_order=request.display_order,
        )
        await audit(
            session,
            actor=actor,
            action="treatment.create",
            entity_type="treatment",
            entity_id=row.id,
            before=None,
            after=_treatment_snapshot(row),
        )
        await session.commit()

        return _serialize_treatment(row)


async def update_treatment(
    state: AppState,
    *,
    actor: User,
    treatment_id: str,
    request: UpdateTreatmentRequest,
) -> AdminTreatment:
    """Change a Treatment's display fields, or restore a retired one."""
    async with state.db_session_maker() as session:
        row = await TreatmentRepository.get(session, treatment_id)
        if row is None:
            raise NotFoundException(message="Treatment not found")

        before = _treatment_snapshot(row)
        row.name = request.name
        row.description = request.description
        row.display_order = request.display_order
        if request.is_active is not None:
            row.is_active = request.is_active

        await audit(
            session,
            actor=actor,
            action="treatment.update",
            entity_type="treatment",
            entity_id=row.id,
            before=before,
            after=_treatment_snapshot(row),
        )
        await session.commit()

        return _serialize_treatment(row)


async def delete_treatment(state: AppState, *, actor: User, treatment_id: str) -> None:
    """Retire a Treatment: hide it from the picker, keep it on existing Services."""
    async with state.db_session_maker() as session:
        row = await TreatmentRepository.get(session, treatment_id)
        if row is None:
            raise NotFoundException(message="Treatment not found")

        before = _treatment_snapshot(row)
        row.is_active = False
        await audit(
            session,
            actor=actor,
            action="treatment.delete",
            entity_type="treatment",
            entity_id=row.id,
            before=before,
            after=_treatment_snapshot(row),
        )
        await session.commit()


async def list_insurance_providers(
    state: AppState,
    *,
    actor: User,
    country_code: str,
) -> AdminInsuranceProviderList:
    """Every insurer in a Country, retired ones included."""
    code = await _require_country(state, country_code)

    async with state.db_session_maker() as session:
        rows = await InsuranceProviderRepository.list_all(
            session, country_code=code, include_inactive=True
        )

    return AdminInsuranceProviderList(
        country_code=code,
        items=[_serialize_insurance_provider(row) for row in rows],
    )


async def create_insurance_provider(
    state: AppState,
    *,
    actor: User,
    country_code: str,
    request: CreateInsuranceProviderRequest,
) -> AdminInsuranceProvider:
    """Add an insurer to one Country's list."""
    code = await _require_country(state, country_code)

    async with state.db_session_maker() as session:
        if (
            await InsuranceProviderRepository.get_by_name(
                session, country_code=code, name=request.name
            )
            is not None
        ):
            raise ConflictError(message="An insurance provider with this name already exists")

        row = await InsuranceProviderRepository.create(
            session,
            country_code=code,
            name=request.name,
            is_national=request.is_national,
        )
        await audit(
            session,
            actor=actor,
            action="insurance_provider.create",
            entity_type="insurance_provider",
            entity_id=row.id,
            before=None,
            after=_insurance_provider_snapshot(row),
        )
        await session.commit()

        return _serialize_insurance_provider(row)


async def update_insurance_provider(
    state: AppState,
    *,
    actor: User,
    country_code: str,
    provider_id: str,
    request: UpdateInsuranceProviderRequest,
) -> AdminInsuranceProvider:
    """Change an insurer's name or national flag, or restore a retired one."""
    code = await _require_country(state, country_code)

    async with state.db_session_maker() as session:
        row = await InsuranceProviderRepository.get(session, provider_id)
        if row is None or row.country_code != code:
            raise NotFoundException(message="Insurance provider not found")

        if request.name != row.name:
            clash = await InsuranceProviderRepository.get_by_name(
                session, country_code=code, name=request.name
            )
            if clash is not None and clash.id != row.id:
                raise ConflictError(message="An insurance provider with this name already exists")

        before = _insurance_provider_snapshot(row)
        row.name = request.name
        row.is_national = request.is_national
        if request.is_active is not None:
            row.is_active = request.is_active

        await audit(
            session,
            actor=actor,
            action="insurance_provider.update",
            entity_type="insurance_provider",
            entity_id=row.id,
            before=before,
            after=_insurance_provider_snapshot(row),
        )
        await session.commit()

        return _serialize_insurance_provider(row)


async def delete_insurance_provider(
    state: AppState,
    *,
    actor: User,
    country_code: str,
    provider_id: str,
) -> None:
    """Retire an insurer: drop it from public filters, keep historic references."""
    code = await _require_country(state, country_code)

    async with state.db_session_maker() as session:
        row = await InsuranceProviderRepository.get(session, provider_id)
        if row is None or row.country_code != code:
            raise NotFoundException(message="Insurance provider not found")

        before = _insurance_provider_snapshot(row)
        row.is_active = False
        await audit(
            session,
            actor=actor,
            action="insurance_provider.delete",
            entity_type="insurance_provider",
            entity_id=row.id,
            before=before,
            after=_insurance_provider_snapshot(row),
        )
        await session.commit()


async def list_subdivisions(
    state: AppState,
    *,
    actor: User,
    country_code: str,
) -> AdminSubdivisionList:
    """Every Subdivision in a Country, retired ones included."""
    code = await _require_country(state, country_code)

    async with state.db_session_maker() as session:
        rows = await SubdivisionRepository.list_all(
            session, country_code=code, include_inactive=True
        )

    return AdminSubdivisionList(
        country_code=code,
        items=[_serialize_subdivision(row) for row in rows],
    )


async def create_subdivision(
    state: AppState,
    *,
    actor: User,
    country_code: str,
    request: CreateSubdivisionRequest,
) -> AdminSubdivision:
    """Add a Subdivision to one Country's geography."""
    code = await _require_country(state, country_code)
    subdivision_code = slug_code(request.code or request.name)

    async with state.db_session_maker() as session:
        if (
            await SubdivisionRepository.get_by_code(
                session, country_code=code, code=subdivision_code
            )
            is not None
        ):
            raise ConflictError(message="A subdivision with this code already exists")

        row = await SubdivisionRepository.create(
            session,
            country_code=code,
            name=request.name,
            code=subdivision_code,
        )
        await audit(
            session,
            actor=actor,
            action="subdivision.create",
            entity_type="subdivision",
            entity_id=row.id,
            before=None,
            after=_subdivision_snapshot(row),
        )
        await session.commit()

        return _serialize_subdivision(row)


async def update_subdivision(
    state: AppState,
    *,
    actor: User,
    country_code: str,
    subdivision_id: str,
    request: UpdateSubdivisionRequest,
) -> AdminSubdivision:
    """Rename a Subdivision, or restore a retired one."""
    code = await _require_country(state, country_code)

    async with state.db_session_maker() as session:
        row = await SubdivisionRepository.get(session, subdivision_id)
        if row is None or row.country_code != code:
            raise NotFoundException(message="Subdivision not found")

        before = _subdivision_snapshot(row)
        row.name = request.name
        if request.is_active is not None:
            row.is_active = request.is_active

        await audit(
            session,
            actor=actor,
            action="subdivision.update",
            entity_type="subdivision",
            entity_id=row.id,
            before=before,
            after=_subdivision_snapshot(row),
        )
        await session.commit()

        return _serialize_subdivision(row)


async def delete_subdivision(
    state: AppState,
    *,
    actor: User,
    country_code: str,
    subdivision_id: str,
) -> None:
    """Retire a Subdivision: hide it from region filters, keep listing history."""
    code = await _require_country(state, country_code)

    async with state.db_session_maker() as session:
        row = await SubdivisionRepository.get(session, subdivision_id)
        if row is None or row.country_code != code:
            raise NotFoundException(message="Subdivision not found")

        before = _subdivision_snapshot(row)
        row.is_active = False
        await audit(
            session,
            actor=actor,
            action="subdivision.delete",
            entity_type="subdivision",
            entity_id=row.id,
            before=before,
            after=_subdivision_snapshot(row),
        )
        await session.commit()
