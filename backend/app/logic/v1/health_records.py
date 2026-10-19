"""Health Record logic: the Patient-owned clinical record (#84).

A Health Record belongs to one Patient and is a portability model, not a
per-facility file (``CONTEXT.md``, *Health Record*; PRD §3.3): the Patient reads
and writes their own, and a **Verified Medic treating them** may write as well.
Every entry snapshots its author's kind — patient vs clinician — so the badge and
the audit trail stay truthful even if that account's role later changes.

Because ``users`` links a clinician to a Facility but not yet to a Specialist
listing, "treating" is proven through a shared Facility Appointment for now: a
clinical account may write only to a Patient its Facility has an accepted
Appointment with. The portability the PRD describes is reached as far as the
schema currently allows (a user↔Specialist link is a follow-up).

Entries are append-only: a correction is a new entry, never an edit, so the rows
themselves are the audit log. At-rest encryption is deliberately out of scope for
this change and tracked separately (root ``AGENTS.md``, "Auth and security").
"""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.exceptions import ForbiddenException, NotFoundException
from app.logic.v1.auth import PATIENT_ROLES, get_user_from_token
from app.repositories.appointment import AppointmentRepository, AppointmentStatus
from app.repositories.health_record import (
    HealthRecordAuthorKind,
    HealthRecordEntry,
    HealthRecordEntryCategory,
    HealthRecordRepository,
    MaternalStatus,
    PatientHealthRecord,
)
from app.repositories.user import User, UserRepository
from app.utils.state import AppState

#: The clinical roles that may write to a Patient's record (#84). A Patient also
#: writes, but to their own record only, so they are handled by ``_authorize``.
CLINICAL_ROLES: frozenset[str] = frozenset({"dentist", "specialist", "intern", "facility_dentist"})

#: An Appointment counts as "treating" once the clinic has accepted it (PRD §3.3,
#: "under their care"); a still-``PENDING`` request is not yet care.
TREATING_STATUSES: tuple[AppointmentStatus, ...] = ("CONFIRMED", "IN_PROGRESS", "COMPLETED")

#: The entry body is free text and its column has no length, so the cap lives
#: only here: one place to keep in sync and a 422 at the boundary rather than a
#: row nobody meant to write.
ENTRY_BODY_MAX_LENGTH = 5000


class HealthRecordEntryRequest(BaseModel):
    """Input for appending one entry to a Health Record."""

    category: HealthRecordEntryCategory
    body: str = Field(min_length=1, max_length=ENTRY_BODY_MAX_LENGTH)


class HealthRecordUpdateRequest(BaseModel):
    """Input for updating the record-level facts the Patient owns."""

    maternal_status: MaternalStatus


class HealthRecordEntryResponse(BaseModel):
    """One authored entry, with its author badge."""

    id: str
    category: HealthRecordEntryCategory
    body: str
    author_id: str
    #: Whether the author is the Patient or a clinician — the badge (PRD §3.3).
    author_kind: HealthRecordAuthorKind
    #: The author's name; ``null`` when the account no longer exists.
    author_name: str | None
    created_at: datetime


class HealthRecordResponse(BaseModel):
    """A Patient's Health Record as the dashboard renders it."""

    id: str
    patient_id: str
    maternal_status: MaternalStatus
    entries: list[HealthRecordEntryResponse]
    created_at: datetime
    updated_at: datetime


async def _load_actor(state: AppState, token: str) -> User:
    """The signed-in user, rejecting a deactivated account."""
    actor = await get_user_from_token(state, token)

    if not actor.is_active:
        raise ForbiddenException(message="User account is deactivated")

    return actor


async def _is_treating_clinician(session: AsyncSession, actor: User, patient_id: str) -> bool:
    """Whether the actor is a clinical account treating this Patient (#84).

    Proven by a shared Facility Appointment today (see module docstring): the
    account must be a clinical role linked to the Facility the Patient has an
    accepted Appointment with.
    """
    if actor.role not in CLINICAL_ROLES or actor.facility_id is None:
        return False

    count = await AppointmentRepository.count_treating_for_facility(
        session,
        patient_id=patient_id,
        facility_id=actor.facility_id,
        statuses=TREATING_STATUSES,
    )
    return count > 0


async def _authorize(
    session: AsyncSession,
    actor: User,
    patient_id: str,
) -> HealthRecordAuthorKind:
    """Authorize access to a Patient's record and return the actor's author kind.

    Allows the Patient themselves and a verified treating clinician. A missing
    patient id — or one that is not a Patient — is a 404, so the endpoints never
    confirm that a non-patient account exists; anyone else is a 403.
    """
    patient = await UserRepository.get_by_id(session, patient_id)

    if patient is None or patient.role not in PATIENT_ROLES:
        raise NotFoundException(message="Patient not found")

    if actor.role in PATIENT_ROLES and actor.id == patient_id:
        return "patient"

    if await _is_treating_clinician(session, actor, patient_id):
        return "clinician"

    raise ForbiddenException(message="You may not access this patient's health record")


def _serialize_entry(
    entry: HealthRecordEntry,
    author_names: dict[str, str],
) -> HealthRecordEntryResponse:
    return HealthRecordEntryResponse(
        id=entry.id,
        category=entry.category,
        body=entry.body,
        author_id=entry.author_id,
        author_kind=entry.author_kind,
        author_name=author_names.get(entry.author_id),
        created_at=entry.created_at,
    )


def _serialize(
    record: PatientHealthRecord,
    entries: list[HealthRecordEntry],
    author_names: dict[str, str],
) -> HealthRecordResponse:
    return HealthRecordResponse(
        id=record.id,
        patient_id=record.patient_id,
        maternal_status=record.maternal_status,
        entries=[_serialize_entry(entry, author_names) for entry in entries],
        created_at=record.created_at,
        updated_at=record.updated_at,
    )


async def get_health_record(
    state: AppState,
    *,
    token: str,
    patient_id: str,
) -> HealthRecordResponse:
    """The Patient's Health Record, oldest entry first.

    Readable by the Patient and by a Verified Medic treating them. The record is
    created empty on first read, so a Patient who has never had an entry still
    gets a truthful, empty record rather than a 404.
    """
    actor = await _load_actor(state, token)

    async with state.db_session_maker() as session:
        await _authorize(session, actor, patient_id)

        record = await HealthRecordRepository.get_or_create(session, patient_id=patient_id)
        entries = await HealthRecordRepository.list_entries(session, record_id=record.id)
        author_names = await UserRepository.names_by_ids(
            session, [entry.author_id for entry in entries]
        )

        await session.commit()

        return _serialize(record, entries, author_names)


async def add_health_record_entry(
    state: AppState,
    *,
    token: str,
    patient_id: str,
    request: HealthRecordEntryRequest,
) -> HealthRecordEntryResponse:
    """Append one entry to a Patient's record.

    Written by the Patient themselves or by a Verified Medic treating them; the
    author kind is taken from the caller, never from the body (root ``AGENTS.md``,
    "Auth and security"), so an entry cannot claim to be someone it is not.
    """
    actor = await _load_actor(state, token)

    async with state.db_session_maker() as session:
        author_kind = await _authorize(session, actor, patient_id)

        record = await HealthRecordRepository.get_or_create(session, patient_id=patient_id)
        entry = await HealthRecordRepository.create_entry(
            session,
            record_id=record.id,
            category=request.category,
            body=request.body,
            author_id=actor.id,
            author_kind=author_kind,
        )

        await session.commit()

        return _serialize_entry(entry, {actor.id: actor.full_name})


async def update_health_record(
    state: AppState,
    *,
    token: str,
    patient_id: str,
    request: HealthRecordUpdateRequest,
) -> HealthRecordResponse:
    """Update the record-level facts — the Patient's maternal status.

    Only the Patient may change their own record-level facts. A treating Medic
    records clinical detail as an entry (which is badged and audited); a
    record-level field has no per-entry author, so it stays with the Patient.
    """
    actor = await _load_actor(state, token)

    async with state.db_session_maker() as session:
        author_kind = await _authorize(session, actor, patient_id)

        if author_kind != "patient":
            raise ForbiddenException(message="Only the patient may change their maternal status")

        record = await HealthRecordRepository.get_or_create(session, patient_id=patient_id)
        await HealthRecordRepository.update(
            session, record, maternal_status=request.maternal_status
        )
        # ``updated_at`` is a server-side ``onupdate``: the flush expires it and
        # reading it would lazy-load outside the greenlet. Refresh to read it back.
        await session.refresh(record)

        entries = await HealthRecordRepository.list_entries(session, record_id=record.id)
        author_names = await UserRepository.names_by_ids(
            session, [entry.author_id for entry in entries]
        )

        await session.commit()

        return _serialize(record, entries, author_names)
