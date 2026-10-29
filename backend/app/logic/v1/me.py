"""The caller's own account: data export and erasure (#128).

``GET /me/export`` builds the signed-in User's copy in the request: the User,
their Profiles and Facility Memberships, their Health Record and entries, their
Appointments, and the Messages they sent. Nothing belonging to another User is
included.

``DELETE /me`` erases the caller immediately. The User row itself stays because
appointments and retained clinician entries reference it with RESTRICT foreign
keys; instead every identity field is scrubbed and ``is_active`` is cleared,
which stops both login and existing tokens. The caller's Profiles, Memberships,
and own Health Record entries are deleted, and clinician-authored entries are
kept for the configured retention window. Business listings they owned keep
their public data but lose the identity link.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Literal, cast

from pydantic import BaseModel, Field

from app.exceptions import UnauthorizedException
from app.logic.v1.auth import (
    AccountStatus,
    MembershipSummary,
    ProfileSummary,
    is_staff_role,
)
from app.repositories.appointment import (
    Appointment,
    AppointmentRepository,
    AppointmentStatus,
)
from app.repositories.deletion import DeletionRepository
from app.repositories.health_record import (
    HealthRecordAuthorKind,
    HealthRecordEntryCategory,
    HealthRecordRepository,
    MaternalStatus,
)
from app.repositories.listing import SpecialistRepository
from app.repositories.message import MessageRepository
from app.repositories.product import SupplierRepository
from app.repositories.profile import ProfileRepository
from app.repositories.training import TrainingRepository
from app.repositories.user import User, UserRepository
from app.utils.state import AppState

#: A deleted account keeps no usable credential. bcrypt rejects this value, and
#: ``verify_password`` treats the exception as a failed sign-in.
UNUSABLE_PASSWORD_HASH = "!"
DELETED_USER_NAME = "Deleted user"
DELETED_EMAIL_DOMAIN = "deleted.invalid"


class ExportedUser(BaseModel):
    """The identity fields the export gives back, before erasure."""

    id: str
    full_name: str
    email: str
    phone: str | None
    role: str
    is_staff: bool
    account_status: AccountStatus
    facility_id: str | None
    created_at: datetime


class ExportedHealthEntry(BaseModel):
    """One authored Health Record entry, with its author badge."""

    id: str
    category: HealthRecordEntryCategory
    body: str
    author_id: str
    author_kind: HealthRecordAuthorKind
    author_name: str | None
    created_at: datetime


class ExportedHealthRecord(BaseModel):
    """The Patient's record-level facts and every entry on it."""

    id: str
    patient_id: str
    maternal_status: MaternalStatus
    entries: list[ExportedHealthEntry]
    created_at: datetime
    updated_at: datetime


class ExportedAppointment(BaseModel):
    """One Appointment, with the Listing name resolved at export time."""

    id: str
    listing_type: Literal["facility", "specialist"]
    listing_id: str
    listing_name: str | None
    country_code: str
    scheduled_at: datetime
    note: str | None
    status: AppointmentStatus
    created_at: datetime


class ExportedMessage(BaseModel):
    """One Message the caller sent. The other participant's Messages are not theirs."""

    id: str
    conversation_id: str
    body: str
    created_at: datetime


class AccountExportResponse(BaseModel):
    """A complete copy of the caller's own account data."""

    exported_at: datetime
    user: ExportedUser
    profiles: list[ProfileSummary] = Field(default_factory=list)
    memberships: list[MembershipSummary] = Field(default_factory=list)
    health_record: ExportedHealthRecord | None = None
    appointments: list[ExportedAppointment] = Field(default_factory=list)
    messages: list[ExportedMessage] = Field(default_factory=list)


def _exported_user(user: User) -> ExportedUser:
    return ExportedUser(
        id=user.id,
        full_name=user.full_name,
        email=user.email,
        phone=user.phone,
        role=user.role,
        is_staff=is_staff_role(user.role),
        account_status=cast(AccountStatus, user.account_status),
        facility_id=user.facility_id,
        created_at=user.created_at,
    )


def _exported_appointment(
    appointment: Appointment,
    facility_names: dict[str, str],
    specialist_names: dict[str, str],
) -> ExportedAppointment:
    if appointment.facility_id is not None:
        listing_type: Literal["facility", "specialist"] = "facility"
        listing_id = appointment.facility_id
        listing_name = facility_names.get(listing_id)
    else:
        assert appointment.specialist_id is not None
        listing_type = "specialist"
        listing_id = appointment.specialist_id
        listing_name = specialist_names.get(listing_id)

    return ExportedAppointment(
        id=appointment.id,
        listing_type=listing_type,
        listing_id=listing_id,
        listing_name=listing_name,
        country_code=appointment.country_code,
        scheduled_at=appointment.scheduled_at,
        note=appointment.note,
        status=appointment.status,
        created_at=appointment.created_at,
    )


async def export_account(state: AppState, *, actor: User) -> AccountExportResponse:
    """Build a complete copy of the caller's own data, in the request."""

    async with state.db_session_maker() as session:
        kinds = await ProfileRepository.kinds_for_user(session, actor.id)
        memberships = await ProfileRepository.memberships_for_user(session, actor.id)

        record_response: ExportedHealthRecord | None = None
        record = await HealthRecordRepository.get_by_patient(session, actor.id)
        if record is not None:
            entries = await HealthRecordRepository.list_entries(session, record_id=record.id)
            author_names = await UserRepository.names_by_ids(
                session, [entry.author_id for entry in entries]
            )
            record_response = ExportedHealthRecord(
                id=record.id,
                patient_id=record.patient_id,
                maternal_status=record.maternal_status,
                entries=[
                    ExportedHealthEntry(
                        id=entry.id,
                        category=entry.category,
                        body=entry.body,
                        author_id=entry.author_id,
                        author_kind=entry.author_kind,
                        author_name=author_names.get(entry.author_id),
                        created_at=entry.created_at,
                    )
                    for entry in entries
                ],
                created_at=record.created_at,
                updated_at=record.updated_at,
            )

        appointments = await AppointmentRepository.list_all_for_patient(
            session, patient_id=actor.id
        )
        facility_names, specialist_names = await AppointmentRepository.listing_names(
            session,
            facility_ids=[a.facility_id for a in appointments if a.facility_id is not None],
            specialist_ids=[a.specialist_id for a in appointments if a.specialist_id is not None],
        )
        messages = await MessageRepository.list_sent_by_user(session, sender_id=actor.id)

        return AccountExportResponse(
            exported_at=datetime.now(UTC),
            user=_exported_user(actor),
            profiles=[ProfileSummary(kind=kind) for kind in kinds],
            memberships=[
                MembershipSummary(
                    facility_id=membership.facility_id,
                    facility_name=membership.facility_name,
                    permissions=membership.permissions,
                )
                for membership in memberships
            ],
            health_record=record_response,
            appointments=[
                _exported_appointment(appointment, facility_names, specialist_names)
                for appointment in appointments
            ],
            messages=[
                ExportedMessage(
                    id=message.id,
                    conversation_id=message.conversation_id,
                    body=message.body,
                    created_at=message.created_at,
                )
                for message in messages
            ],
        )


async def delete_account(state: AppState, *, actor: User) -> None:
    """Erase the caller's identity now, retaining only protected clinical rows."""

    async with state.db_session_maker() as session:
        stored = await UserRepository.get_by_id(session, actor.id)
        if stored is None:
            raise UnauthorizedException(message="User not found")

        now = datetime.now(UTC).replace(tzinfo=None)
        await DeletionRepository.create(
            session,
            user_id=stored.id,
            status="completed",
            requested_at=now,
            retention_until=now + timedelta(days=state.settings.clinical_retention_days),
            completed_at=now,
        )

        await ProfileRepository.delete_for_user(session, user_id=stored.id)

        record = await HealthRecordRepository.get_by_patient(session, stored.id)
        if record is not None:
            await HealthRecordRepository.delete_entries_by_author_kind(
                session,
                record_id=record.id,
                author_kind="patient",
            )
            await HealthRecordRepository.update(session, record, maternal_status="none")

        await SpecialistRepository.detach_user(session, user_id=stored.id)
        await SupplierRepository.detach_owner(session, owner_user_id=stored.id)
        await TrainingRepository.detach_owner(session, owner_user_id=stored.id)

        await UserRepository.anonymize(
            session,
            stored,
            email=f"deleted+{stored.id}@{DELETED_EMAIL_DOMAIN}",
            full_name=DELETED_USER_NAME,
            password_hash=UNUSABLE_PASSWORD_HASH,
        )

        await session.commit()
