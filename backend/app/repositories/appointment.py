"""Appointments: a booked visit between a Patient and a Listing.

An Appointment belongs to exactly one Patient (``users.id``) and points at
exactly one Listing — a Facility or a Specialist (``CONTEXT.md``, *Appointment*;
*Listing*). The two are separate columns with a check constraint rather than one
polymorphic ``listing_id``, because a database that can hold "half a listing"
will eventually hold one: the constraint makes the invalid shape unrepresentable,
and it keeps a real foreign key so a Facility's appointments can be found
directly (``facility_id`` is indexed for the facility dashboard, #81).

``scheduled_at`` is the wall-clock time at the Listing's Country, not an instant
— the same rule ``CONTEXT.md`` gives Opening Hours, and the reason there is no
timezone conversion here: the time a patient picks is the time the clinic reads
off its own clock. ``country_code`` is denormalised from the Listing (a plain
column, matching ``job_postings``) so a future facility-scoped read does not
have to walk back through the listing table to find its market.

``status`` mirrors the documented lifecycle and defaults to ``PENDING``: a new
booking is a request, not a confirmed visit. The column type is built from the
``Literal`` below so the four states can never drift apart.
"""

from __future__ import annotations

import uuid
from datetime import date, datetime, time, timedelta
from typing import Any, Literal, get_args

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    String,
    Text,
    func,
    select,
)
from sqlalchemy import (
    Enum as SAEnum,
)
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql.expression import ColumnElement

from app.repositories.database import Base
from app.repositories.listing import Facility, Specialist

#: The four documented states, in the order they are reached (``CONTEXT.md``).
AppointmentStatus = Literal["PENDING", "CONFIRMED", "IN_PROGRESS", "COMPLETED"]
APPOINTMENT_STATUSES = get_args(AppointmentStatus)


class Appointment(Base):
    """A booked visit between a Patient and a Facility or Specialist."""

    __tablename__ = "appointments"
    __table_args__ = (
        #: Exactly one target: a Facility or a Specialist, never both, never
        #: neither. ``<>`` on the two ``IS NOT NULL`` booleans is an XOR.
        CheckConstraint(
            "(facility_id IS NOT NULL) <> (specialist_id IS NOT NULL)",
            name="ck_appointments_single_listing",
        ),
    )

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )
    #: The Patient who booked. RESTRICT: a user with appointments is not
    #: silently deleted out from under them.
    patient_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    facility_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey("facilities.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    specialist_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey("specialists.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )

    #: The Listing's market, copied at booking time (matching ``job_postings``).
    country_code: Mapped[str] = mapped_column(String(2), default="KE", index=True, nullable=False)

    #: Wall-clock time at the Listing's Country, never an instant (see module docstring).
    scheduled_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, index=True)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)

    status: Mapped[AppointmentStatus] = mapped_column(
        SAEnum(
            *APPOINTMENT_STATUSES,
            name="appointment_status",
            native_enum=False,
            length=12,
        ),
        default="PENDING",
        nullable=False,
        index=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


class AppointmentRepository:
    """Reads and writes for Appointments."""

    @staticmethod
    async def create(session: AsyncSession, **kwargs: Any) -> Appointment:
        """Create and persist an Appointment."""
        appointment = Appointment(**kwargs)
        session.add(appointment)
        await session.flush()
        return appointment

    @staticmethod
    async def get(session: AsyncSession, appointment_id: str) -> Appointment | None:
        """One Appointment by id."""
        stmt = select(Appointment).where(Appointment.id == appointment_id)
        result = await session.execute(stmt)
        return result.scalar_one_or_none()

    @staticmethod
    async def update(
        session: AsyncSession, appointment: Appointment, **changes: Any
    ) -> Appointment:
        """Apply the given field changes to an Appointment and flush them."""
        for field, value in changes.items():
            setattr(appointment, field, value)
        await session.flush()
        return appointment

    @staticmethod
    async def list_for_patient(
        session: AsyncSession,
        *,
        patient_id: str,
        limit: int,
        offset: int,
    ) -> list[Appointment]:
        """One page of a Patient's Appointments, soonest slot first.

        ``created_at`` is the tiebreak so two bookings at the same time still
        come back in a stable order.
        """
        stmt = (
            select(Appointment)
            .where(Appointment.patient_id == patient_id)
            .order_by(Appointment.scheduled_at.asc(), Appointment.created_at.asc())
            .limit(limit)
            .offset(offset)
        )
        result = await session.execute(stmt)
        return list(result.scalars().all())

    @staticmethod
    async def count_for_patient(session: AsyncSession, *, patient_id: str) -> int:
        """Count a Patient's Appointments."""
        stmt = (
            select(func.count())
            .select_from(Appointment)
            .where(Appointment.patient_id == patient_id)
        )
        result = await session.execute(stmt)
        return int(result.scalar_one())

    @staticmethod
    async def list_for_facility_day(
        session: AsyncSession,
        *,
        facility_id: str,
        day: date,
        limit: int,
    ) -> list[Appointment]:
        """A Facility's Appointments on one wall-clock day, soonest first.

        The day is a half-open range on the stored wall-clock time, not a
        ``date()`` cast: it is portable and it keeps the comparison on the
        clinic's own clock (``CONTEXT.md``, *Appointment*).
        """
        start = datetime.combine(day, time.min)
        end = datetime.combine(day + timedelta(days=1), time.min)

        stmt = (
            select(Appointment)
            .where(
                Appointment.facility_id == facility_id,
                Appointment.scheduled_at >= start,
                Appointment.scheduled_at < end,
            )
            .order_by(Appointment.scheduled_at.asc(), Appointment.created_at.asc())
            .limit(limit)
        )
        result = await session.execute(stmt)
        return list(result.scalars().all())

    @staticmethod
    async def count_for_facility_status(
        session: AsyncSession,
        *,
        facility_id: str,
        status: AppointmentStatus,
    ) -> int:
        """Count a Facility's Appointments in one status (its pending queue)."""
        stmt = (
            select(func.count())
            .select_from(Appointment)
            .where(Appointment.facility_id == facility_id, Appointment.status == status)
        )
        result = await session.execute(stmt)
        return int(result.scalar_one())

    @staticmethod
    async def find_duplicate(
        session: AsyncSession,
        *,
        patient_id: str,
        scheduled_at: datetime,
        facility_id: str | None,
        specialist_id: str | None,
    ) -> Appointment | None:
        """An existing booking for the same Patient, same slot, same Listing."""
        clauses: list[ColumnElement[bool]] = [
            Appointment.patient_id == patient_id,
            Appointment.scheduled_at == scheduled_at,
        ]

        if facility_id is not None:
            clauses.append(Appointment.facility_id == facility_id)
        else:
            clauses.append(Appointment.specialist_id == specialist_id)

        result = await session.execute(select(Appointment).where(*clauses))
        return result.scalars().first()

    @staticmethod
    async def listing_names(
        session: AsyncSession,
        *,
        facility_ids: list[str],
        specialist_ids: list[str],
    ) -> tuple[dict[str, str], dict[str, str]]:
        """Resolve Listing names for a page of Appointments.

        Two lookups rather than a polymorphic join: a page can hold both kinds of
        Listing, and each id set is resolved in one query. Returns
        ``(facility_names, specialist_names)`` keyed by id; an id with no row is
        absent, which the caller renders as a deleted listing.
        """
        facility_names: dict[str, str] = {}
        specialist_names: dict[str, str] = {}

        if facility_ids:
            rows = await session.execute(
                select(Facility.id, Facility.name).where(Facility.id.in_(facility_ids))
            )
            facility_names = {row.id: row.name for row in rows.all()}

        if specialist_ids:
            rows = await session.execute(
                select(Specialist.id, Specialist.name).where(Specialist.id.in_(specialist_ids))
            )
            specialist_names = {row.id: row.name for row in rows.all()}

        return facility_names, specialist_names
