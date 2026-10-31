"""Patient Health Record: the Patient-owned clinical record.

A Health Record is owned by one Patient (``CONTEXT.md``, *Health Record*; PRD
§3.3) and is a **portability** model, not a per-facility file: the record follows
the Patient. It is modelled as one ``PatientHealthRecord`` per Patient — the
record-level facts such as maternal status — plus a list of append-only
``HealthRecordEntry`` rows, because the badge requirement ("who entered each
entry", issue #84) is per entry, not per record.

Every entry snapshots its author's **kind** (patient vs clinician) alongside the
author's id. The snapshot is deliberate: the badge and the audit trail must keep
saying "a clinician wrote this" even if that account's role later changes, which a
live join could not promise. Entries are never edited or deleted in place — a
correction is a new entry — so the rows themselves are the audit log.

The Patient owns the record and may add entries to it; a verified treating
clinician may too (#84, confirmed with the maintainer). Because ``users`` links a
clinician to a Facility but not yet to a Specialist listing, "treating" is proven
through a shared Facility Appointment for now — the portability model the PRD
describes is reached as far as the schema currently allows.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Literal, get_args

from sqlalchemy import DateTime, ForeignKey, String, Text, delete, func, select
from sqlalchemy import (
    Enum as SAEnum,
)
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.repositories.database import Base

#: Maternal status (PRD §8.3, the whiteboard-only field #84 adds). "none" is the
#: explicit default, so an unset record still answers a truthful value.
MaternalStatus = Literal["none", "pregnant", "lactating", "deleted"]
MATERNAL_STATUSES = get_args(MaternalStatus)

#: What an entry holds. Prescriptions are free text for now (#84): structured
#: prescribing needs its own design and validation.
HealthRecordEntryCategory = Literal[
    "medical_history",
    "dental_history",
    "prescription",
    "allergy",
]
HEALTH_RECORD_ENTRY_CATEGORIES = get_args(HealthRecordEntryCategory)

#: Who wrote an entry. Snapshotted on the row (see module docstring).
HealthRecordAuthorKind = Literal["patient", "clinician"]
HEALTH_RECORD_AUTHOR_KINDS = get_args(HealthRecordAuthorKind)


class PatientHealthRecord(Base):
    """The Patient-owned record: record-level facts, one row per Patient."""

    __tablename__ = "patient_health_records"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )
    #: The owning Patient. Unique: a Patient has exactly one record. CASCADE:
    #: deleting a user takes their record with them.
    patient_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )

    maternal_status: Mapped[MaternalStatus] = mapped_column(
        SAEnum(
            *MATERNAL_STATUSES,
            name="maternal_status",
            native_enum=False,
            length=12,
        ),
        default="none",
        nullable=False,
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

    #: Convenience relationship for fixtures and future reads. The repository
    #: queries entries explicitly, so async request code never lazy-loads this.
    entries: Mapped[list[HealthRecordEntry]] = relationship(
        back_populates="record",
        cascade="all, delete-orphan",
    )


class HealthRecordEntry(Base):
    """One authored entry on a Patient's Health Record (append-only)."""

    __tablename__ = "health_record_entries"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )
    record_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("patient_health_records.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    category: Mapped[HealthRecordEntryCategory] = mapped_column(
        SAEnum(
            *HEALTH_RECORD_ENTRY_CATEGORIES,
            name="health_record_entry_category",
            native_enum=False,
            length=20,
        ),
        nullable=False,
        index=True,
    )
    body: Mapped[str] = mapped_column(Text, nullable=False)

    #: Who wrote it. RESTRICT: an author with entries is not silently deleted.
    author_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    author_kind: Mapped[HealthRecordAuthorKind] = mapped_column(
        SAEnum(
            *HEALTH_RECORD_AUTHOR_KINDS,
            name="health_record_author_kind",
            native_enum=False,
            length=10,
        ),
        nullable=False,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), nullable=False
    )

    record: Mapped[PatientHealthRecord] = relationship(back_populates="entries")


class HealthRecordRepository:
    """Reads and writes for Health Records and their entries."""

    @staticmethod
    async def get_by_patient(session: AsyncSession, patient_id: str) -> PatientHealthRecord | None:
        """A Patient's record, or ``None`` if they have not opened one yet."""
        stmt = select(PatientHealthRecord).where(PatientHealthRecord.patient_id == patient_id)
        result = await session.execute(stmt)
        return result.scalar_one_or_none()

    @staticmethod
    async def get_or_create(session: AsyncSession, *, patient_id: str) -> PatientHealthRecord:
        """The Patient's record, creating an empty one on first read."""
        record = await HealthRecordRepository.get_by_patient(session, patient_id)

        if record is not None:
            return record

        record = PatientHealthRecord(patient_id=patient_id, maternal_status="none")
        session.add(record)
        await session.flush()
        return record

    @staticmethod
    async def update(
        session: AsyncSession,
        record: PatientHealthRecord,
        **changes: Any,
    ) -> PatientHealthRecord:
        """Apply the given field changes to a record and flush them."""
        for field, value in changes.items():
            setattr(record, field, value)
        await session.flush()
        return record

    @staticmethod
    async def create_entry(
        session: AsyncSession,
        *,
        record_id: str,
        category: HealthRecordEntryCategory,
        body: str,
        author_id: str,
        author_kind: HealthRecordAuthorKind,
    ) -> HealthRecordEntry:
        """Append one authored entry to a record."""
        entry = HealthRecordEntry(
            record_id=record_id,
            category=category,
            body=body,
            author_id=author_id,
            author_kind=author_kind,
        )
        session.add(entry)
        await session.flush()
        return entry

    @staticmethod
    async def delete_entries_by_author_kind(
        session: AsyncSession,
        *,
        record_id: str,
        author_kind: HealthRecordAuthorKind,
    ) -> None:
        """Delete the entries of one author kind on a record (#128).

        Account deletion removes the Patient's own entries but keeps the
        clinician-authored ones the retention window protects.
        """
        await session.execute(
            delete(HealthRecordEntry).where(
                HealthRecordEntry.record_id == record_id,
                HealthRecordEntry.author_kind == author_kind,
            )
        )

    @staticmethod
    async def list_entries(
        session: AsyncSession,
        *,
        record_id: str,
    ) -> list[HealthRecordEntry]:
        """A record's entries, oldest first (a clinical record reads forward)."""
        stmt = (
            select(HealthRecordEntry)
            .where(HealthRecordEntry.record_id == record_id)
            .order_by(HealthRecordEntry.created_at.asc(), HealthRecordEntry.id.asc())
        )
        result = await session.execute(stmt)
        return list(result.scalars().all())
