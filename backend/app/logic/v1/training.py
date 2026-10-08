"""CPD training logic: public, read-only, per-market.

Like the jobs board, the training catalogue is a module a Country may or may not
offer (``CPD_TRAINING`` flag). An unconfigured or disabled market gets an
explicit 503 rather than an empty list, so the UI can say "not available here"
instead of looking broken. Only the list endpoints resolve the market; a detail
read follows the item's own Country, so a deep link works from anywhere. Course
money is ``Decimal``-based, quantised before it leaves the boundary, and a price
is never returned without its currency.
"""

from __future__ import annotations

from datetime import UTC, datetime
from decimal import Decimal
from typing import Literal, cast

from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.exceptions import BaseApiException, NotFoundException
from app.logic.v1.country import CountryConfigurationMissingException
from app.repositories.country import Country, CountryRepository
from app.repositories.training import (
    TrainingCourse,
    TrainingCourseFilters,
    TrainingProvider,
    TrainingRepository,
    TrainingWebinar,
    TrainingWebinarFilters,
)
from app.utils.money import quantize_money
from app.utils.state import AppState

TRAINING_PAGE_SIZE = 12
MAX_PAGE_SIZE = 100

#: The module's feature key in ``country_features`` (matches the client flag).
CPD_TRAINING_FEATURE = "CPD_TRAINING"

DeliveryMode = Literal["in_person", "online", "blended"]

#: A webinars listing is tri-state: all (default), upcoming-only, past-only.
UpcomingFilter = Literal["upcoming", "past"] | None


class TrainingUnavailableException(BaseApiException):
    """The active Country has CPD training switched off (or unconfigured).

    Distinct from an empty page: a market that considered the module and
    disabled it should be able to say so rather than look broken.
    """

    code = 503
    message = "CPD training is not available in this country"


class TrainingProviderResponse(BaseModel):
    """The organising body, flattened enough for a card."""

    name: str
    is_verified: bool


class TrainingCourseResponse(BaseModel):
    """One course as a card and a detail page can render it."""

    id: str
    title: str
    description: str
    provider: TrainingProviderResponse
    subdivision_code: str
    delivery_mode: DeliveryMode
    price: Decimal | None
    currency: str | None


class TrainingCoursePage(BaseModel):
    """One page of courses plus the market it belongs to."""

    items: list[TrainingCourseResponse]
    total: int
    limit: int
    offset: int
    country_code: str
    currency: str


class TrainingWebinarResponse(BaseModel):
    """One dated webinar with its join URL and provider."""

    id: str
    title: str
    description: str
    provider: TrainingProviderResponse
    join_url: str
    scheduled_start: datetime


class TrainingWebinarPage(BaseModel):
    """One page of webinars plus the market it belongs to."""

    items: list[TrainingWebinarResponse]
    total: int
    limit: int
    offset: int
    country_code: str


def _validate_limit(limit: int) -> int:
    return max(1, min(limit, MAX_PAGE_SIZE))


def _now_utc() -> datetime:
    # The columns store naive UTC (as the seed does); strip tz so ``>=``
    # comparisons bind like-for-like.
    return datetime.now(UTC).replace(tzinfo=None)


def _serialize_provider(provider: TrainingProvider) -> TrainingProviderResponse:
    return TrainingProviderResponse(
        name=provider.name,
        is_verified=provider.is_verified,
    )


def _serialize_course(course: TrainingCourse) -> TrainingCourseResponse:
    return TrainingCourseResponse(
        id=course.id,
        title=course.title,
        description=course.description,
        provider=_serialize_provider(course.provider),
        subdivision_code=course.subdivision_code,
        delivery_mode=cast(DeliveryMode, course.delivery_mode),
        price=None if course.price is None else quantize_money(Decimal(course.price)),
        currency=course.currency,
    )


def _serialize_webinar(webinar: TrainingWebinar) -> TrainingWebinarResponse:
    return TrainingWebinarResponse(
        id=webinar.id,
        title=webinar.title,
        description=webinar.description,
        provider=_serialize_provider(webinar.provider),
        join_url=webinar.join_url,
        scheduled_start=webinar.scheduled_start,
    )


async def _resolve_training_market(session: AsyncSession, country_code: str) -> Country:
    """The Country a page is served for, rejecting markets without training.

    An unknown market and a market with training disabled are both explicit
    503s, because both otherwise read as "just returned nothing".
    """
    country = await CountryRepository.get(session, country_code.upper())

    if country is None:
        raise CountryConfigurationMissingException()

    flag = next(
        (feature for feature in country.features if feature.feature == CPD_TRAINING_FEATURE),
        None,
    )

    if flag is None or not flag.is_enabled:
        raise TrainingUnavailableException()

    return country


async def list_courses(
    state: AppState,
    *,
    country_code: str,
    subdivision_code: str | None = None,
    provider: str | None = None,
    delivery_mode: DeliveryMode | None = None,
    limit: int = TRAINING_PAGE_SIZE,
    offset: int = 0,
) -> TrainingCoursePage:
    """One page of a Country's courses, filtered."""
    page_size = _validate_limit(limit)
    start = max(0, offset)

    filters = TrainingCourseFilters(
        country_code=country_code.upper(),
        subdivision_code=subdivision_code,
        provider_name=provider,
        delivery_mode=delivery_mode,
    )

    async with state.db_session_maker() as session:
        country = await _resolve_training_market(session, filters.country_code)
        rows = await TrainingRepository.search_courses(
            session, filters, limit=page_size, offset=start
        )
        total = await TrainingRepository.count_courses(session, filters)

    return TrainingCoursePage(
        items=[_serialize_course(row) for row in rows],
        total=total,
        limit=page_size,
        offset=start,
        country_code=filters.country_code,
        currency=country.currency,
    )


async def get_course(state: AppState, *, course_id: str) -> TrainingCourseResponse:
    """One course with its provider and price."""
    async with state.db_session_maker() as session:
        course = await TrainingRepository.get_course(session, course_id)

        if course is None:
            raise NotFoundException(message="Training course not found")

    return _serialize_course(course)


async def list_webinars(
    state: AppState,
    *,
    country_code: str,
    provider: str | None = None,
    upcoming: UpcomingFilter = None,
    limit: int = TRAINING_PAGE_SIZE,
    offset: int = 0,
) -> TrainingWebinarPage:
    """One page of a Country's webinars, upcoming first.

    ``upcoming`` defaults to keeping the whole timeline: past webinars stay
    reachable (a provider's archive is worth having) and ``"upcoming"`` /
    ``"past"`` narrow it for the client.
    """
    page_size = _validate_limit(limit)
    start = max(0, offset)

    filters = TrainingWebinarFilters(
        country_code=country_code.upper(),
        provider_name=provider,
        upcoming=None if upcoming is None else upcoming == "upcoming",
        now=_now_utc(),
    )

    async with state.db_session_maker() as session:
        await _resolve_training_market(session, filters.country_code)
        rows = await TrainingRepository.search_webinars(
            session, filters, limit=page_size, offset=start
        )
        total = await TrainingRepository.count_webinars(session, filters)

    return TrainingWebinarPage(
        items=[_serialize_webinar(row) for row in rows],
        total=total,
        limit=page_size,
        offset=start,
        country_code=filters.country_code,
    )


async def get_webinar(state: AppState, *, webinar_id: str) -> TrainingWebinarResponse:
    """One webinar with its provider."""
    async with state.db_session_maker() as session:
        webinar = await TrainingRepository.get_webinar(session, webinar_id)

        if webinar is None:
            raise NotFoundException(message="Training webinar not found")

    return _serialize_webinar(webinar)
