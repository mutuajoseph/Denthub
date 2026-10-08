"""CPD training routes - thin HTTP adapters over training logic.

Public read-only module per PRD §2, so no role gate. Country resolves like the
listing and jobs routes do: ``country`` names the market being asked about and
the ambient ``Accept-Country`` header is the fallback, the more specific one
winning.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Header, Query

from app.dependencies import get_app_state
from app.logic.v1.country import DEFAULT_COUNTRY_CODE
from app.logic.v1.training import (
    TRAINING_PAGE_SIZE,
    DeliveryMode,
    TrainingCoursePage,
    TrainingCourseResponse,
    TrainingWebinarPage,
    TrainingWebinarResponse,
    UpcomingFilter,
    get_course,
    get_webinar,
    list_courses,
    list_webinars,
)
from app.utils.openapi_helpers import standard_error_responses
from app.utils.state import AppState

router = APIRouter(prefix="/training", tags=["training"])


@router.get(
    "/courses",
    response_model=TrainingCoursePage,
    responses=standard_error_responses(),
)
async def read_courses(
    country: str | None = Query(default=None, description="Overrides Accept-Country"),
    accept_country: str = Header(default=DEFAULT_COUNTRY_CODE, alias="Accept-Country"),
    subdivision_code: str | None = Query(default=None, description="Filter to one subdivision"),
    provider: str | None = Query(default=None, description="Filter to one provider by name"),
    delivery_mode: DeliveryMode | None = Query(
        default=None, description="in_person, online, or blended"
    ),
    limit: int = Query(default=TRAINING_PAGE_SIZE, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    state: AppState = Depends(get_app_state),
) -> TrainingCoursePage:
    """One page of a market's courses, filtered by country and delivery."""
    return await list_courses(
        state,
        country_code=country or accept_country,
        subdivision_code=subdivision_code,
        provider=provider,
        delivery_mode=delivery_mode,
        limit=limit,
        offset=offset,
    )


@router.get(
    "/courses/{course_id}",
    response_model=TrainingCourseResponse,
    responses=standard_error_responses(),
)
async def read_course(
    course_id: str,
    state: AppState = Depends(get_app_state),
) -> TrainingCourseResponse:
    """One course with its provider and price.

    The course's own Country governs the response, so a deep link reads the same
    from any market.
    """
    return await get_course(state, course_id=course_id)


@router.get(
    "/webinars",
    response_model=TrainingWebinarPage,
    responses=standard_error_responses(),
)
async def read_webinars(
    country: str | None = Query(default=None, description="Overrides Accept-Country"),
    accept_country: str = Header(default=DEFAULT_COUNTRY_CODE, alias="Accept-Country"),
    provider: str | None = Query(default=None, description="Filter to one provider by name"),
    upcoming: UpcomingFilter = Query(
        default=None,
        description="Default keeps all (archive included); 'upcoming' or 'past' narrows",
    ),
    limit: int = Query(default=TRAINING_PAGE_SIZE, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    state: AppState = Depends(get_app_state),
) -> TrainingWebinarPage:
    """One page of a market's webinars, upcoming first, past ones kept."""
    return await list_webinars(
        state,
        country_code=country or accept_country,
        provider=provider,
        upcoming=upcoming,
        limit=limit,
        offset=offset,
    )


@router.get(
    "/webinars/{webinar_id}",
    response_model=TrainingWebinarResponse,
    responses=standard_error_responses(),
)
async def read_webinar(
    webinar_id: str,
    state: AppState = Depends(get_app_state),
) -> TrainingWebinarResponse:
    """One webinar with its provider and join URL."""
    return await get_webinar(state, webinar_id=webinar_id)
