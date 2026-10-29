"""Appointment logic: a Patient books a Listing, then manages it from their dashboard.

Booking is Patient-only and always for the caller: the Patient is taken from the
token, never from the body (root ``AGENTS.md``, "Auth and security"), so one
account cannot book on another's behalf. The Listing is validated before it is
stored — a Facility or a Specialist, whichever the request names — which is also
where the Listing's Country comes from, so the row is scoped to its market and
the time is checked against the clinic's own clock.

A Patient may also cancel or reschedule a booking they own (#88), but only while
the clinic has not started it. Ownership is checked the same way — from the
token — and a Patient asking for someone else's Appointment gets the same 404 as
a missing id, so the endpoint never confirms that another account's row exists.

``scheduled_at`` is a wall-clock time at the Listing's Country, not an instant
(see ``app.repositories.appointment``), so it is compared to the Country's local
"now" and stored unchanged: no timezone is applied and none is lost.
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Annotated, Any, Literal
from zoneinfo import ZoneInfo

from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.exceptions import (
    ConflictError,
    ForbiddenException,
    InvalidRequestError,
    NotFoundException,
)
from app.logic.v1.auth import PATIENT_ROLES
from app.logic.v1.country import CountryConfigurationMissingException
from app.repositories.appointment import (
    Appointment,
    AppointmentRepository,
    AppointmentStatus,
)
from app.repositories.country import CountryRepository
from app.repositories.listing import FacilityRepository, SpecialistRepository
from app.repositories.user import User
from app.utils.state import AppState

APPOINTMENTS_PAGE_SIZE = 20
MAX_PAGE_SIZE = 100

#: What a request may name as the thing being booked (``CONTEXT.md``, *Listing*).
ListingType = Literal["facility", "specialist"]

#: The states a Patient may still act on. Once the clinic starts work
#: (``IN_PROGRESS``) or finishes it, the Appointment is out of their hands —
#: provider-side actions live in #81.
PATIENT_ACTIONABLE_STATUSES: frozenset[AppointmentStatus] = frozenset({"PENDING", "CONFIRMED"})


class AppointmentRequest(BaseModel):
    """Input for booking a visit: which Listing, and when.

    ``scheduled_at`` is the wall-clock time the Patient picked, in the Listing's
    Country — the client sends a naive timestamp (an HTML ``datetime-local``
    value), so no offset is expected and none is invented.

    ``note`` is capped at 2000 characters. The column is ``Text`` and has no
    length of its own, so the cap lives only here: one place to keep in sync,
    and a 422 at the boundary rather than a row nobody meant to write.
    """

    listing_type: ListingType
    listing_id: str
    scheduled_at: datetime
    note: str | None = Field(default=None, max_length=2000)


class AppointmentResponse(BaseModel):
    """One Appointment as the Patient's dashboard renders it."""

    id: str
    listing_type: ListingType
    listing_id: str
    #: The Facility or Specialist name; ``null`` when the Listing no longer exists.
    listing_name: str | None
    status: AppointmentStatus
    scheduled_at: datetime
    note: str | None
    country_code: str
    created_at: datetime


class AppointmentPage(BaseModel):
    """One page of a Patient's Appointments."""

    items: list[AppointmentResponse]
    total: int
    limit: int
    offset: int


class CancelAppointmentRequest(BaseModel):
    """Withdraw a booking: the Patient's only status change (#88)."""

    action: Literal["cancel"]


class RescheduleAppointmentRequest(BaseModel):
    """Move a booking to a new slot, keeping the same Listing.

    ``scheduled_at`` is the new wall-clock time in the Listing's Country, the
    same shape ``AppointmentRequest`` takes. ``note`` is optional: when it is
    absent the existing note is kept, and sending ``null`` clears it — PATCH
    semantics, told apart with ``model_fields_set``.
    """

    action: Literal["reschedule"]
    scheduled_at: datetime
    note: str | None = Field(default=None, max_length=2000)


#: What ``PATCH /appointments/{id}`` accepts. ``action`` discriminates the two,
#: so a body naming both a cancel and a new slot is a 422 rather than a guess.
AppointmentUpdateRequest = Annotated[
    CancelAppointmentRequest | RescheduleAppointmentRequest,
    Field(discriminator="action"),
]


def _require_patient(actor: User) -> str:
    """Return the signed-in Patient's id, rejecting anyone who is not one."""
    if actor.role not in PATIENT_ROLES:
        raise ForbiddenException(message="Only patients may book appointments")

    return actor.id


async def _resolve_listing(
    session: AsyncSession,
    listing_type: ListingType,
    listing_id: str,
) -> tuple[str | None, str | None, str, str] | None:
    """The stored columns for a Listing, or ``None`` when it does not exist.

    Returns ``(facility_id, specialist_id, country_code, name)``. The id is
    validated against the table the type names, so a Facility id sent with
    ``listing_type="specialist"`` is a not-found rather than a stored mismatch.
    """
    if listing_type == "facility":
        facility = await FacilityRepository.get(session, listing_id)

        # An unlisted Facility is not bookable: it has not passed staff review.
        if facility is None or not facility.listed:
            return None

        return facility.id, None, facility.country_code, facility.name

    specialist = await SpecialistRepository.get(session, listing_id)

    if specialist is None:
        return None

    return None, specialist.id, specialist.country_code, specialist.name


def _serialize(
    appointment: Appointment,
    *,
    listing_name: str | None,
) -> AppointmentResponse:
    facility_id = appointment.facility_id

    return AppointmentResponse(
        id=appointment.id,
        listing_type="facility" if facility_id is not None else "specialist",
        listing_id=facility_id if facility_id is not None else appointment.specialist_id or "",
        listing_name=listing_name,
        status=appointment.status,
        scheduled_at=appointment.scheduled_at,
        note=appointment.note,
        country_code=appointment.country_code,
        created_at=appointment.created_at,
    )


async def _listing_name(session: AsyncSession, appointment: Appointment) -> str | None:
    """The Facility or Specialist name for one Appointment, or ``None`` if gone."""
    facility_names, specialist_names = await AppointmentRepository.listing_names(
        session,
        facility_ids=[appointment.facility_id] if appointment.facility_id is not None else [],
        specialist_ids=(
            [appointment.specialist_id] if appointment.specialist_id is not None else []
        ),
    )

    if appointment.facility_id is not None:
        return facility_names.get(appointment.facility_id)

    return specialist_names.get(appointment.specialist_id or "")


async def book_appointment(
    state: AppState,
    *,
    actor: User,
    request: AppointmentRequest,
) -> AppointmentResponse:
    """Book a Listing for the signed-in Patient as a ``PENDING`` Appointment.

    Rejects a Listing that does not exist (404), a slot that is already booked
    for the same Patient and Listing (409), and a time that has already passed on
    the clinic's clock (400).
    """
    patient_id = _require_patient(actor)

    async with state.db_session_maker() as session:
        resolved = await _resolve_listing(session, request.listing_type, request.listing_id)

        if resolved is None:
            raise NotFoundException(message="Listing not found")

        facility_id, specialist_id, country_code, listing_name = resolved

        country = await CountryRepository.get(session, country_code)

        if country is None:
            raise CountryConfigurationMissingException()

        local_now = datetime.now(UTC).astimezone(ZoneInfo(country.timezone)).replace(tzinfo=None)

        if request.scheduled_at < local_now:
            raise InvalidRequestError(message="Appointment time must be in the future")

        duplicate = await AppointmentRepository.find_duplicate(
            session,
            patient_id=patient_id,
            scheduled_at=request.scheduled_at,
            facility_id=facility_id,
            specialist_id=specialist_id,
        )

        if duplicate is not None:
            raise ConflictError(message="An appointment at this time is already booked")

        appointment = await AppointmentRepository.create(
            session,
            patient_id=patient_id,
            facility_id=facility_id,
            specialist_id=specialist_id,
            country_code=country_code,
            scheduled_at=request.scheduled_at,
            note=request.note,
        )

        await session.commit()

        return _serialize(appointment, listing_name=listing_name)


async def list_my_appointments(
    state: AppState,
    *,
    actor: User,
    limit: int = APPOINTMENTS_PAGE_SIZE,
    offset: int = 0,
) -> AppointmentPage:
    """One page of the signed-in Patient's Appointments, soonest slot first."""
    patient_id = _require_patient(actor)

    page_size = max(1, min(limit, MAX_PAGE_SIZE))
    start = max(0, offset)

    async with state.db_session_maker() as session:
        rows = await AppointmentRepository.list_for_patient(
            session,
            patient_id=patient_id,
            limit=page_size,
            offset=start,
        )
        total = await AppointmentRepository.count_for_patient(session, patient_id=patient_id)

        facility_names, specialist_names = await AppointmentRepository.listing_names(
            session,
            facility_ids=[row.facility_id for row in rows if row.facility_id is not None],
            specialist_ids=[row.specialist_id for row in rows if row.specialist_id is not None],
        )

    items = [
        _serialize(
            row,
            listing_name=(
                facility_names.get(row.facility_id or "")
                if row.facility_id is not None
                else specialist_names.get(row.specialist_id or "")
            ),
        )
        for row in rows
    ]

    return AppointmentPage(items=items, total=total, limit=page_size, offset=start)


async def _apply_reschedule(
    session: AsyncSession,
    appointment: Appointment,
    *,
    patient_id: str,
    request: RescheduleAppointmentRequest,
) -> None:
    """Validate a new slot against the clinic's clock and its duplicates, then set it.

    The same checks a booking runs, against the Appointment's own Country: a past
    slot is a 400, a slot the Patient already holds for this Listing is a 409.
    The Appointment's own slot is excluded from the duplicate scan, so a no-op
    reschedule is not a conflict with itself.
    """
    country = await CountryRepository.get(session, appointment.country_code)

    if country is None:
        raise CountryConfigurationMissingException()

    local_now = datetime.now(UTC).astimezone(ZoneInfo(country.timezone)).replace(tzinfo=None)

    if request.scheduled_at < local_now:
        raise InvalidRequestError(message="Appointment time must be in the future")

    duplicate = await AppointmentRepository.find_duplicate(
        session,
        patient_id=patient_id,
        scheduled_at=request.scheduled_at,
        facility_id=appointment.facility_id,
        specialist_id=appointment.specialist_id,
        exclude_id=appointment.id,
    )

    if duplicate is not None:
        raise ConflictError(message="An appointment at this time is already booked")

    changes: dict[str, Any] = {"scheduled_at": request.scheduled_at}

    # PATCH semantics: an omitted note is left as it was; an explicit ``null``
    # clears it. ``model_fields_set`` is how the two are told apart.
    if "note" in request.model_fields_set:
        changes["note"] = request.note

    await AppointmentRepository.update(session, appointment, **changes)


async def update_my_appointment(
    state: AppState,
    *,
    actor: User,
    appointment_id: str,
    request: AppointmentUpdateRequest,
) -> AppointmentResponse:
    """Cancel or reschedule the signed-in Patient's own Appointment.

    The Patient comes from the token; an Appointment that is missing *or* owned
    by another account is a 404, so the endpoint never reveals that someone
    else's booking exists. Only a ``PENDING`` or ``CONFIRMED`` Appointment may be
    changed — anything the clinic has started or finished is a 400.
    """
    patient_id = _require_patient(actor)

    async with state.db_session_maker() as session:
        appointment = await AppointmentRepository.get(session, appointment_id)

        if appointment is None or appointment.patient_id != patient_id:
            raise NotFoundException(message="Appointment not found")

        if appointment.status not in PATIENT_ACTIONABLE_STATUSES:
            raise InvalidRequestError(
                message="Only pending or confirmed appointments can be changed"
            )

        if request.action == "cancel":
            await AppointmentRepository.update(session, appointment, status="CANCELLED")
        else:
            await _apply_reschedule(
                session,
                appointment,
                patient_id=patient_id,
                request=request,
            )

        listing_name = await _listing_name(session, appointment)

        await session.commit()

        return _serialize(appointment, listing_name=listing_name)
