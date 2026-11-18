"""The caller's own account: data export, erasure, and settings (#119, #128).

``GET /me/export`` builds the signed-in User's copy in the request; ``DELETE /me``
erases the caller immediately. ``GET``/``PATCH /me`` and ``POST /me/profiles`` are
the User-level account settings surface (``docs/api-map.md``, "Acting as"). A User
may hold several Profiles at once (ADR-0006), so adding one never changes
``users.role`` or the account status while clients still route on ``role``.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Literal, cast

from pydantic import BaseModel, Field

from app.exceptions import ConflictError, InvalidRequestError, UnauthorizedException
from app.logic.v1.auth import (
    AccountStatus,
    MembershipSummary,
    ProfileSummary,
    UserResponse,
    is_staff_role,
    user_response,
)
from app.repositories.appointment import (
    Appointment,
    AppointmentRepository,
    AppointmentStatus,
)
from app.repositories.country import CountryRepository
from app.repositories.deletion import DeletionRepository
from app.repositories.health_record import (
    HealthRecordAuthorKind,
    HealthRecordEntryCategory,
    HealthRecordRepository,
    MaternalStatus,
)
from app.repositories.listing import SpecialistRepository
from app.repositories.message import MessageRepository
from app.repositories.product import ProductRepository, SupplierRepository
from app.repositories.profile import ProfileKind, ProfileRepository
from app.repositories.training import TrainingRepository
from app.repositories.user import User, UserRepository
from app.utils.state import AppState

#: A deleted account keeps no usable credential. bcrypt rejects this value, and
#: ``verify_password`` treats the exception as a failed sign-in.
UNUSABLE_PASSWORD_HASH = "!"
DELETED_USER_NAME = "Deleted user"
DELETED_EMAIL_DOMAIN = "deleted.invalid"
#: What a deleted User's Message body becomes. The row and its timestamp stay
#: so the other participant's thread keeps its shape without the text.
DELETED_MESSAGE_BODY = "[deleted]"
#: A Specialist listing is an individual, so its display name and name-derived
#: slug are erased with the owner; the id keeps the slug unique.
DELETED_SPECIALIST_NAME = "Deleted specialist"
DELETED_SPECIALIST_SLUG_PREFIX = "deleted-specialist-"


class MeUpdate(BaseModel):
    """The account fields a User may change; omitted fields stay unchanged."""

    full_name: str | None = Field(default=None, max_length=100)
    phone: str | None = Field(default=None, max_length=50)
    home_country_code: str | None = Field(default=None, max_length=2)


class ProfileCreate(BaseModel):
    """A Profile kind the User wants to add."""

    kind: ProfileKind


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
    """One Message in the caller's thread, with the sender so both sides read clearly."""

    id: str
    conversation_id: str
    sender_id: str
    body: str
    created_at: datetime


class ExportedProduct(BaseModel):
    """One product in a Supplier's catalog."""

    id: str
    name: str
    brand: str | None
    category: str
    description: str | None
    image_url: str | None
    currency: str
    retail_price: str
    wholesale_price: str | None
    wholesale_min_qty: int
    in_stock: bool
    country_code: str
    created_at: datetime


class ExportedSupplier(BaseModel):
    """A Supplier storefront the caller owns, with its products."""

    id: str
    name: str
    slug: str
    description: str | None
    country_code: str
    scope: str
    is_verified: bool
    created_at: datetime
    products: list[ExportedProduct] = Field(default_factory=list)


class ExportedTrainingCourse(BaseModel):
    """One course in a Training Provider's catalog."""

    id: str
    title: str
    description: str
    country_code: str
    subdivision_code: str
    delivery_mode: str
    price: str | None
    currency: str | None
    cpd_points: int
    created_at: datetime
    updated_at: datetime


class ExportedTrainingWebinar(BaseModel):
    """One webinar in a Training Provider's catalog."""

    id: str
    title: str
    description: str
    country_code: str
    join_url: str
    scheduled_start: datetime
    cpd_points: int


class ExportedTrainingProvider(BaseModel):
    """A Training Provider the caller owns, with its courses and webinars."""

    id: str
    name: str
    country_code: str
    is_verified: bool
    created_at: datetime
    courses: list[ExportedTrainingCourse] = Field(default_factory=list)
    webinars: list[ExportedTrainingWebinar] = Field(default_factory=list)


class ExportedBranch(BaseModel):
    """One branch in a Specialist's listing."""

    id: str
    name: str | None
    subdivision_code: str
    address: str | None
    phone: str | None
    email: str | None
    open_now: bool | None = None


class ExportedSpecialist(BaseModel):
    """The caller's full Specialist listing."""

    id: str
    name: str
    slug: str
    bio: str | None
    avatar_key: str | None
    country_code: str
    subdivision_code: str
    verification_tier: str
    currency: str
    list_price: str | None
    rating: str | None
    review_count: int
    specialties: list[str] = Field(default_factory=list)
    branches: list[ExportedBranch] = Field(default_factory=list)


class AccountExportResponse(BaseModel):
    """A complete copy of the caller's own account data."""

    exported_at: datetime
    user: ExportedUser
    profiles: list[ProfileSummary] = Field(default_factory=list)
    memberships: list[MembershipSummary] = Field(default_factory=list)
    health_record: ExportedHealthRecord | None = None
    appointments: list[ExportedAppointment] = Field(default_factory=list)
    messages: list[ExportedMessage] = Field(default_factory=list)
    supplier: ExportedSupplier | None = None
    training_provider: ExportedTrainingProvider | None = None
    specialist: ExportedSpecialist | None = None


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
        if appointment.specialist_id is None:
            raise InvalidRequestError(message="Appointment is missing its listing")
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
        messages = await MessageRepository.list_for_user(session, user_id=actor.id)

        # Supplier storefront + products the caller owns.
        supplier = await SupplierRepository.get_by_owner(session, actor.id)
        exported_supplier: ExportedSupplier | None = None
        if supplier is not None:
            products = await ProductRepository.list_for_supplier(
                session, supplier.id, limit=100000, offset=0
            )
            exported_supplier = ExportedSupplier(
                id=supplier.id,
                name=supplier.name,
                slug=supplier.slug,
                description=supplier.description,
                country_code=supplier.country_code,
                scope=supplier.scope,
                is_verified=supplier.is_verified,
                created_at=supplier.created_at,
                products=[
                    ExportedProduct(
                        id=product.id,
                        name=product.name,
                        brand=product.brand,
                        category=product.category,
                        description=product.description,
                        image_url=product.image_url,
                        currency=product.currency,
                        retail_price=str(product.retail_price),
                        wholesale_price=(
                            str(product.wholesale_price)
                            if product.wholesale_price is not None
                            else None
                        ),
                        wholesale_min_qty=product.wholesale_min_qty,
                        in_stock=product.in_stock,
                        country_code=product.country_code,
                        created_at=product.created_at,
                    )
                    for product in products
                ],
            )

        # Training Provider the caller owns, with its courses and webinars.
        training_provider = await TrainingRepository.get_provider_by_owner(session, actor.id)
        exported_training: ExportedTrainingProvider | None = None
        if training_provider is not None:
            courses = await TrainingRepository.list_courses_for_provider(
                session, training_provider.id, limit=100000, offset=0
            )
            webinars = await TrainingRepository.list_webinars_for_provider(
                session, training_provider.id, limit=100000, offset=0
            )
            exported_training = ExportedTrainingProvider(
                id=training_provider.id,
                name=training_provider.name,
                country_code=training_provider.country_code,
                is_verified=training_provider.is_verified,
                created_at=training_provider.created_at,
                courses=[
                    ExportedTrainingCourse(
                        id=course.id,
                        title=course.title,
                        description=course.description,
                        country_code=course.country_code,
                        subdivision_code=course.subdivision_code,
                        delivery_mode=course.delivery_mode,
                        price=str(course.price) if course.price is not None else None,
                        currency=course.currency,
                        cpd_points=course.cpd_points,
                        created_at=course.created_at,
                        updated_at=course.updated_at,
                    )
                    for course in courses
                ],
                webinars=[
                    ExportedTrainingWebinar(
                        id=webinar.id,
                        title=webinar.title,
                        description=webinar.description,
                        country_code=webinar.country_code,
                        join_url=webinar.join_url,
                        scheduled_start=webinar.scheduled_start,
                        cpd_points=webinar.cpd_points,
                    )
                    for webinar in webinars
                ],
            )

        # Specialist listing the caller runs.
        specialist = await SpecialistRepository.get_by_user(session, actor.id)
        exported_specialist: ExportedSpecialist | None = None
        if specialist is not None:
            exported_specialist = ExportedSpecialist(
                id=specialist.id,
                name=specialist.name,
                slug=specialist.slug,
                bio=specialist.bio,
                avatar_key=specialist.avatar_key,
                country_code=specialist.country_code,
                subdivision_code=specialist.subdivision_code,
                verification_tier=str(specialist.verification_tier),
                currency=specialist.currency,
                list_price=(
                    str(specialist.list_price) if specialist.list_price is not None else None
                ),
                rating=str(specialist.rating) if specialist.rating is not None else None,
                review_count=specialist.review_count,
                specialties=[specialty.code for specialty in specialist.specialties],
                branches=[
                    ExportedBranch(
                        id=branch.id,
                        name=branch.name,
                        subdivision_code=branch.subdivision_code,
                        address=branch.address,
                        phone=branch.phone,
                        email=branch.email,
                        open_now=None,
                    )
                    for branch in specialist.branches
                ],
            )

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
                    sender_id=message.sender_id,
                    body=message.body,
                    created_at=message.created_at,
                )
                for message in messages
            ],
            supplier=exported_supplier,
            training_provider=exported_training,
            specialist=exported_specialist,
        )


async def delete_account(state: AppState, *, actor: User) -> None:
    """Erase the caller's identity now, retaining only protected clinical rows."""

    async with state.db_session_maker() as session:
        stored = await UserRepository.get_by_id_for_update(session, actor.id)
        if stored is None:
            raise UnauthorizedException(message="User not found")

        if await DeletionRepository.get_by_user(session, stored.id) is not None:
            # A concurrent or repeated DELETE already erased this account.
            return

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
            await HealthRecordRepository.update(session, record, maternal_status="deleted")

        await MessageRepository.scrub_sender(
            session,
            sender_id=stored.id,
            replacement_body=DELETED_MESSAGE_BODY,
        )
        await AppointmentRepository.clear_notes_for_patient(session, patient_id=stored.id)

        await SpecialistRepository.detach_user(
            session,
            user_id=stored.id,
            replacement_name=DELETED_SPECIALIST_NAME,
            replacement_slug_prefix=DELETED_SPECIALIST_SLUG_PREFIX,
        )
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


async def get_me(state: AppState, *, actor: User) -> UserResponse:
    """The caller's own account settings."""
    async with state.db_session_maker() as session:
        user = await UserRepository.get_by_id(session, actor.id)

        if user is None:
            raise UnauthorizedException(message="User not found")

        return await user_response(session, user)


async def update_me(state: AppState, *, actor: User, data: MeUpdate) -> UserResponse:
    """Apply a partial update to the caller's own account.

    An explicit ``null`` clears ``phone`` or ``home_country_code``; a supplied
    ``full_name`` may not be blank. A home Country must be one DentHub operates
    in and has not retired.
    """
    fields = data.model_dump(exclude_unset=True)

    async with state.db_session_maker() as session:
        user = await UserRepository.get_by_id(session, actor.id)

        if user is None:
            raise UnauthorizedException(message="User not found")

        if "full_name" in fields:
            name = (fields["full_name"] or "").strip()
            if not name:
                raise InvalidRequestError(message="Name cannot be empty")
            await UserRepository.update(user, full_name=name)

        if "phone" in fields:
            await UserRepository.update(user, phone=fields["phone"])

        if "home_country_code" in fields:
            code = fields["home_country_code"]
            if code is None:
                await UserRepository.update(user, home_country_code=None)
            else:
                country = await CountryRepository.get(session, code)
                if country is None or not country.is_active:
                    raise InvalidRequestError(message="Unknown or inactive home Country")
                await UserRepository.update(user, home_country_code=country.code)

        await session.commit()
        return await user_response(session, user)


async def add_profile(state: AppState, *, actor: User, data: ProfileCreate) -> UserResponse:
    """Add one Profile kind the caller does not already hold."""
    async with state.db_session_maker() as session:
        user = await UserRepository.get_by_id(session, actor.id)

        if user is None:
            raise UnauthorizedException(message="User not found")

        if await ProfileRepository.has_kind(session, user_id=user.id, kind=data.kind):
            raise ConflictError(message="This account already holds that Profile")

        await ProfileRepository.add(session, user_id=user.id, kind=data.kind)
        await session.commit()
        return await user_response(session, user)
