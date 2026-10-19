"""Training-provider dashboard logic — the provider's own side of CPD.

A Training Provider (the organisation, CONTEXT.md) is owned by exactly one
training-provider account through ``training_providers.owner_user_id``. The
account creates its own provider from ``/dashboard/training`` and then manages
its own Courses and webinars, scoped server-side so one provider can never see
or edit another's. Enrolment/enquiry records do not exist yet, so the dashboard
shows *derived* stats: own Course and webinar counts, the upcoming split, and
the total CPD points offered.
"""

from __future__ import annotations

from datetime import UTC, datetime
from decimal import Decimal
from typing import cast

from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.exceptions import (
    ConflictError,
    ForbiddenException,
    InvalidRequestError,
    NotFoundException,
)
from app.logic.v1.auth import TRAINING_PROVIDER_ROLES, get_user_from_token
from app.logic.v1.training import DeliveryMode
from app.repositories.training import (
    TrainingCourse,
    TrainingProvider,
    TrainingRepository,
    TrainingWebinar,
)
from app.repositories.user import User
from app.utils.money import quantize_money
from app.utils.state import AppState

DEFAULT_PAGE_SIZE = 48
MAX_PAGE_SIZE = 100

#: Upper bound on a single course or webinar's CPD credit.
MAX_CPD_POINTS = 1_000

#: Columns a PATCH may never blank out. ``price`` is deliberately absent:
#: sending ``null`` there makes the course free, which is a real state.
_COURSE_REQUIRED_ON_UPDATE = ("title", "description", "subdivision_code", "delivery_mode")
_WEBINAR_REQUIRED_ON_UPDATE = ("title", "description", "join_url", "scheduled_start")


class TrainingProviderProfile(BaseModel):
    """The signed-in provider's own organising body."""

    id: str
    name: str
    country_code: str
    is_verified: bool
    created_at: datetime


class TrainingProviderStats(BaseModel):
    """Derived headline numbers for the provider dashboard."""

    course_count: int
    webinar_count: int
    upcoming_webinar_count: int
    total_cpd_points: int


class TrainingProviderDashboard(BaseModel):
    """The provider's profile plus its derived stats."""

    provider: TrainingProviderProfile
    stats: TrainingProviderStats


class ProviderCourse(BaseModel):
    """One of the provider's own courses."""

    id: str
    title: str
    description: str
    country_code: str
    subdivision_code: str
    delivery_mode: DeliveryMode
    price: Decimal | None
    currency: str | None
    cpd_points: int
    created_at: datetime
    updated_at: datetime


class ProviderCourseList(BaseModel):
    """One page of the provider's own courses."""

    items: list[ProviderCourse]
    total: int
    limit: int
    offset: int


class ProviderWebinar(BaseModel):
    """One of the provider's own webinars."""

    id: str
    title: str
    description: str
    country_code: str
    join_url: str
    scheduled_start: datetime
    cpd_points: int
    created_at: datetime


class ProviderWebinarList(BaseModel):
    """One page of the provider's own webinars."""

    items: list[ProviderWebinar]
    total: int
    limit: int
    offset: int


class CreateProviderRequest(BaseModel):
    """Body for self-serve provider creation. Country comes from the header."""

    name: str = Field(min_length=1, max_length=120)


class CreateCourseRequest(BaseModel):
    """Body for creating a course in the caller's own provider."""

    title: str = Field(min_length=1, max_length=200)
    description: str = Field(min_length=1, max_length=4000)
    subdivision_code: str = Field(min_length=1, max_length=30)
    delivery_mode: DeliveryMode
    price: Decimal | None = Field(default=None, gt=0, max_digits=12, decimal_places=2)
    cpd_points: int = Field(default=0, ge=0, le=MAX_CPD_POINTS)


class UpdateCourseRequest(BaseModel):
    """PATCH body: only the fields present in the request change."""

    title: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = Field(default=None, min_length=1, max_length=4000)
    subdivision_code: str | None = Field(default=None, min_length=1, max_length=30)
    delivery_mode: DeliveryMode | None = None
    price: Decimal | None = Field(default=None, gt=0, max_digits=12, decimal_places=2)
    cpd_points: int | None = Field(default=None, ge=0, le=MAX_CPD_POINTS)


class CreateWebinarRequest(BaseModel):
    """Body for creating a webinar in the caller's own provider."""

    title: str = Field(min_length=1, max_length=200)
    description: str = Field(min_length=1, max_length=4000)
    join_url: str = Field(min_length=1, max_length=500)
    scheduled_start: datetime
    cpd_points: int = Field(default=0, ge=0, le=MAX_CPD_POINTS)


class UpdateWebinarRequest(BaseModel):
    """PATCH body: only the fields present in the request change."""

    title: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = Field(default=None, min_length=1, max_length=4000)
    join_url: str | None = Field(default=None, min_length=1, max_length=500)
    scheduled_start: datetime | None = None
    cpd_points: int | None = Field(default=None, ge=0, le=MAX_CPD_POINTS)


def _now_utc() -> datetime:
    """Naive UTC, matching how the training columns are stored."""
    return datetime.now(UTC).replace(tzinfo=None)


def _page_window(limit: int, offset: int) -> tuple[int, int]:
    return max(1, min(limit, MAX_PAGE_SIZE)), max(0, offset)


def _serialize_profile(provider: TrainingProvider) -> TrainingProviderProfile:
    return TrainingProviderProfile(
        id=provider.id,
        name=provider.name,
        country_code=provider.country_code,
        is_verified=provider.is_verified,
        created_at=provider.created_at,
    )


def _serialize_course(course: TrainingCourse) -> ProviderCourse:
    return ProviderCourse(
        id=course.id,
        title=course.title,
        description=course.description,
        country_code=course.country_code,
        subdivision_code=course.subdivision_code,
        delivery_mode=cast(DeliveryMode, course.delivery_mode),
        price=None if course.price is None else quantize_money(Decimal(course.price)),
        currency=course.currency,
        cpd_points=course.cpd_points,
        created_at=course.created_at,
        updated_at=course.updated_at,
    )


def _serialize_webinar(webinar: TrainingWebinar) -> ProviderWebinar:
    return ProviderWebinar(
        id=webinar.id,
        title=webinar.title,
        description=webinar.description,
        country_code=webinar.country_code,
        join_url=webinar.join_url,
        scheduled_start=webinar.scheduled_start,
        cpd_points=webinar.cpd_points,
        created_at=webinar.created_at,
    )


async def _require_training_provider(state: AppState, token: str) -> User:
    """Load the caller and reject everyone but an active provider account."""
    actor = await get_user_from_token(state, token)

    if actor.role not in TRAINING_PROVIDER_ROLES:
        raise ForbiddenException(
            message="Only training provider accounts may manage a training dashboard"
        )

    if not actor.is_active:
        raise ForbiddenException(message="User account is deactivated")

    return actor


async def _owned_provider(session: AsyncSession, owner_user_id: str) -> TrainingProvider:
    """The caller's provider, or 404 — the dashboard creates it first."""
    provider = await TrainingRepository.get_provider_by_owner(session, owner_user_id)

    if provider is None:
        raise NotFoundException(message="Training provider not found")

    return provider


def _normalize_country(country_code: str) -> str:
    country = country_code.strip().upper()
    if len(country) != 2 or not country.isalpha():
        raise InvalidRequestError(message="Country must be a 2-letter ISO code")
    return country


async def get_my_dashboard(state: AppState, *, token: str) -> TrainingProviderDashboard:
    """The caller's provider profile and derived stats.

    404 when the account has not created a provider yet — the dashboard turns
    that into the create-provider form.
    """
    actor = await _require_training_provider(state, token)

    async with state.db_session_maker() as session:
        provider = await _owned_provider(session, actor.id)
        course_count = await TrainingRepository.count_courses_for_provider(session, provider.id)
        webinar_count = await TrainingRepository.count_webinars_for_provider(
            session, provider.id, now=_now_utc()
        )
        upcoming = await TrainingRepository.count_webinars_for_provider(
            session, provider.id, upcoming=True, now=_now_utc()
        )
        cpd_points = await TrainingRepository.sum_cpd_points_for_provider(session, provider.id)

    return TrainingProviderDashboard(
        provider=_serialize_profile(provider),
        stats=TrainingProviderStats(
            course_count=course_count,
            webinar_count=webinar_count,
            upcoming_webinar_count=upcoming,
            total_cpd_points=cpd_points,
        ),
    )


async def create_my_provider(
    state: AppState,
    *,
    token: str,
    data: CreateProviderRequest,
    country_code: str,
) -> TrainingProviderDashboard:
    """Create the caller's provider, owned by the caller.

    One provider per account (409 on a second attempt); it starts unverified
    and staff verify it later.
    """
    actor = await _require_training_provider(state, token)
    country = _normalize_country(country_code)

    async with state.db_session_maker() as session:
        if await TrainingRepository.get_provider_by_owner(session, actor.id) is not None:
            raise ConflictError(message="This account already has a training provider")

        provider = await TrainingRepository.create_provider(
            session,
            name=data.name,
            country_code=country,
            is_verified=False,
            owner_user_id=actor.id,
        )
        await session.commit()

    return TrainingProviderDashboard(
        provider=_serialize_profile(provider),
        stats=TrainingProviderStats(
            course_count=0,
            webinar_count=0,
            upcoming_webinar_count=0,
            total_cpd_points=0,
        ),
    )


async def list_my_courses(
    state: AppState,
    *,
    token: str,
    limit: int = DEFAULT_PAGE_SIZE,
    offset: int = 0,
) -> ProviderCourseList:
    """List the caller's own courses."""
    actor = await _require_training_provider(state, token)
    page_size, start = _page_window(limit, offset)

    async with state.db_session_maker() as session:
        provider = await _owned_provider(session, actor.id)
        rows = await TrainingRepository.list_courses_for_provider(
            session, provider.id, limit=page_size, offset=start
        )
        total = await TrainingRepository.count_courses_for_provider(session, provider.id)

    return ProviderCourseList(
        items=[_serialize_course(row) for row in rows],
        total=total,
        limit=page_size,
        offset=start,
    )


async def create_my_course(
    state: AppState,
    *,
    token: str,
    data: CreateCourseRequest,
    currency: str,
) -> ProviderCourse:
    """Create a course in the caller's own provider.

    The course is published into the provider's market (``country_code`` from
    the provider, ``currency`` from the region headers) and starts free unless
    a price is given, in which case it carries that currency on the same row.
    """
    actor = await _require_training_provider(state, token)

    async with state.db_session_maker() as session:
        provider = await _owned_provider(session, actor.id)
        course = await TrainingRepository.create_course(
            session,
            title=data.title,
            description=data.description,
            provider_id=provider.id,
            country_code=provider.country_code,
            subdivision_code=data.subdivision_code,
            delivery_mode=data.delivery_mode,
            price=quantize_money(data.price) if data.price is not None else None,
            currency=currency.upper() if data.price is not None else None,
            cpd_points=data.cpd_points,
        )
        await session.commit()
        await session.refresh(course)

    return _serialize_course(course)


async def update_my_course(
    state: AppState,
    *,
    token: str,
    course_id: str,
    data: UpdateCourseRequest,
    currency: str,
) -> ProviderCourse:
    """Apply a partial update to one of the caller's own courses.

    A course belonging to another provider reads as 404, exactly as an unknown
    id does, so ownership is never observable from the response.
    """
    actor = await _require_training_provider(state, token)

    updates = data.model_dump(exclude_unset=True)
    for key in _COURSE_REQUIRED_ON_UPDATE:
        if updates.get(key) is None:
            updates.pop(key, None)

    if "price" in updates:
        if updates["price"] is None:
            updates["currency"] = None
        else:
            updates["price"] = quantize_money(cast(Decimal, updates["price"]))
            updates["currency"] = currency.upper()

    async with state.db_session_maker() as session:
        provider = await _owned_provider(session, actor.id)
        course = await TrainingRepository.get_course_for_provider(session, course_id, provider.id)

        if course is None:
            raise NotFoundException(message="Training course not found")

        await TrainingRepository.update_course(course, **updates)
        await session.commit()
        await session.refresh(course)

    return _serialize_course(course)


async def list_my_webinars(
    state: AppState,
    *,
    token: str,
    limit: int = DEFAULT_PAGE_SIZE,
    offset: int = 0,
) -> ProviderWebinarList:
    """List the caller's own webinars, past ones included."""
    actor = await _require_training_provider(state, token)
    page_size, start = _page_window(limit, offset)

    async with state.db_session_maker() as session:
        provider = await _owned_provider(session, actor.id)
        rows = await TrainingRepository.list_webinars_for_provider(
            session, provider.id, limit=page_size, offset=start
        )
        total = await TrainingRepository.count_webinars_for_provider(
            session, provider.id, now=_now_utc()
        )

    return ProviderWebinarList(
        items=[_serialize_webinar(row) for row in rows],
        total=total,
        limit=page_size,
        offset=start,
    )


async def create_my_webinar(
    state: AppState,
    *,
    token: str,
    data: CreateWebinarRequest,
) -> ProviderWebinar:
    """Create a webinar in the caller's own provider."""
    actor = await _require_training_provider(state, token)

    async with state.db_session_maker() as session:
        provider = await _owned_provider(session, actor.id)
        webinar = await TrainingRepository.create_webinar(
            session,
            title=data.title,
            description=data.description,
            provider_id=provider.id,
            country_code=provider.country_code,
            join_url=data.join_url,
            scheduled_start=data.scheduled_start,
            cpd_points=data.cpd_points,
        )
        await session.commit()
        await session.refresh(webinar)

    return _serialize_webinar(webinar)


async def update_my_webinar(
    state: AppState,
    *,
    token: str,
    webinar_id: str,
    data: UpdateWebinarRequest,
) -> ProviderWebinar:
    """Apply a partial update to one of the caller's own webinars."""
    actor = await _require_training_provider(state, token)

    updates = data.model_dump(exclude_unset=True)
    for key in _WEBINAR_REQUIRED_ON_UPDATE:
        if updates.get(key) is None:
            updates.pop(key, None)

    async with state.db_session_maker() as session:
        provider = await _owned_provider(session, actor.id)
        webinar = await TrainingRepository.get_webinar_for_provider(
            session, webinar_id, provider.id
        )

        if webinar is None:
            raise NotFoundException(message="Training webinar not found")

        await TrainingRepository.update_webinar(webinar, **updates)
        await session.commit()
        await session.refresh(webinar)

    return _serialize_webinar(webinar)
