"""Facility dashboard logic: a clinic runs its day from one screen (#81).

A facility-scoped account — an owner, front-office, or facility-dentist role —
is bound to a single Facility through ``users.facility_id``. Every read and write
here is scoped to that one Facility: a clinic never sees another's Appointments
or staff, and an Appointment belonging to a different clinic is a 404 rather than
a 403, so the endpoint never confirms that another clinic's booking exists.

``scheduled_at`` is a wall-clock time at the Facility's Country, so "today" is the
clinic's own day, not the server's UTC day (``CONTEXT.md``, *Appointment*).
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Literal
from zoneinfo import ZoneInfo

from pydantic import BaseModel

from app.exceptions import ForbiddenException, InvalidRequestError, NotFoundException
from app.logic.v1.appointments import AppointmentResponse, _serialize
from app.logic.v1.country import CountryConfigurationMissingException
from app.repositories.appointment import AppointmentRepository, AppointmentStatus
from app.repositories.country import CountryRepository
from app.repositories.listing import FacilityRepository
from app.repositories.user import User, UserRepository
from app.utils.state import AppState

FACILITY_DASHBOARD_LIMIT = 50

#: The roles that may reach the facility dashboard and its appointment workflow
#: (#81, confirmed with the maintainer). Front Office is limited to appointments
#: and check-in; clinical chart access stays with the clinical roles (PRD §2),
#: and no chart exists yet.
FACILITY_ROLES: frozenset[str] = frozenset({"facility_owner", "front_office", "facility_dentist"})

#: The provider-side workflow as a forward map: each state to the one the clinic
#: moves it to next (PRD §3.2). A Patient may only ever withdraw (#88); these
#: steps belong to the clinic.
FACILITY_TRANSITIONS: dict[AppointmentStatus, AppointmentStatus] = {
    "PENDING": "CONFIRMED",
    "CONFIRMED": "IN_PROGRESS",
    "IN_PROGRESS": "COMPLETED",
}

#: The steps a facility account may drive — the values of the map above.
FacilityAppointmentStatus = Literal["CONFIRMED", "IN_PROGRESS", "COMPLETED"]


class FacilityAppointmentUpdateRequest(BaseModel):
    """Move one of the clinic's Appointments forward along the workflow."""

    status: FacilityAppointmentStatus


class FacilityStaffResponse(BaseModel):
    """One member of a Facility's staff."""

    id: str
    full_name: str
    role: str


class FacilityDashboardResponse(BaseModel):
    """One clinic's day: today's bookings, the pending queue, and its staff."""

    facility_id: str
    facility_name: str | None
    country_code: str
    today: list[AppointmentResponse]
    pending_count: int
    staff: list[FacilityStaffResponse]


def _require_facility(actor: User) -> tuple[str, str]:
    """The signed-in Facility account's ``(user_id, facility_id)``.

    Rejects a non-facility role (403) and a facility-scoped account that is not
    yet linked to a Facility (403) — the dashboard needs a clinic to scope to.
    """
    if actor.role not in FACILITY_ROLES:
        raise ForbiddenException(message="Only facility accounts may manage a facility")

    if actor.facility_id is None:
        raise ForbiddenException(message="This account is not linked to a facility")

    return actor.id, actor.facility_id


async def get_facility_dashboard(
    state: AppState,
    *,
    actor: User,
    limit: int = FACILITY_DASHBOARD_LIMIT,
) -> FacilityDashboardResponse:
    """One clinic's day: its upcoming Appointments today, pending queue, and staff.

    Scoped to the Facility the caller is linked to; a clinic with no Facility is
    a 403 (see ``_require_facility``).
    """
    _user_id, facility_id = _require_facility(actor)

    async with state.db_session_maker() as session:
        facility = await FacilityRepository.get(session, facility_id)

        if facility is None:
            raise NotFoundException(message="Facility not found")

        country = await CountryRepository.get(session, facility.country_code)

        if country is None:
            raise CountryConfigurationMissingException()

        # "Today" is the clinic's own day, read off its own clock.
        today = datetime.now(UTC).astimezone(ZoneInfo(country.timezone)).date()

        page_size = max(1, min(limit, 100))
        rows = await AppointmentRepository.list_for_facility_day(
            session,
            facility_id=facility_id,
            day=today,
            limit=page_size,
        )
        pending_count = await AppointmentRepository.count_for_facility_status(
            session,
            facility_id=facility_id,
            status="PENDING",
        )
        staff_rows = await UserRepository.list_for_facility(session, facility_id=facility_id)

    # Every appointment on this list is booked against this clinic, so they all
    # share the Facility's name.
    items = [_serialize(row, listing_name=facility.name) for row in rows]

    return FacilityDashboardResponse(
        facility_id=facility.id,
        facility_name=facility.name,
        country_code=facility.country_code,
        today=items,
        pending_count=pending_count,
        staff=[
            FacilityStaffResponse(id=member.id, full_name=member.full_name, role=member.role)
            for member in staff_rows
        ],
    )


async def update_facility_appointment(
    state: AppState,
    *,
    actor: User,
    appointment_id: str,
    request: FacilityAppointmentUpdateRequest,
) -> AppointmentResponse:
    """Move one of the clinic's Appointments forward along the workflow.

    Scoped to the caller's Facility: an Appointment that is missing or belongs to
    another clinic is a 404. A step that is not the next one in the workflow —
    skipping, going backwards, or touching a terminal state — is a 400.
    """
    _user_id, facility_id = _require_facility(actor)

    async with state.db_session_maker() as session:
        appointment = await AppointmentRepository.get(session, appointment_id)

        # Missing, or another clinic's, is the same 404.
        if appointment is None or appointment.facility_id != facility_id:
            raise NotFoundException(message="Appointment not found")

        expected_next = FACILITY_TRANSITIONS.get(appointment.status)

        if expected_next is None or expected_next != request.status:
            raise InvalidRequestError(message="That transition is not allowed from this status")

        await AppointmentRepository.update(session, appointment, status=request.status)

        facility = await FacilityRepository.get(session, facility_id)
        listing_name = facility.name if facility is not None else None

        await session.commit()

        return _serialize(appointment, listing_name=listing_name)
