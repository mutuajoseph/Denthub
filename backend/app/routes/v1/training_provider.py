"""Training-provider dashboard routes — adapters over training-provider logic.

The provider's own profile, courses and webinars, all authenticated and gated to
``TRAINING_PROVIDER_ROLES``. Country arrives as the ``Accept-Country`` header
and a course's currency as ``Accept-Currency``, per the multi-country contract
in the PRD.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Header, Query

from app.dependencies import current_user, get_app_state
from app.logic.v1.training_provider import (
    DEFAULT_PAGE_SIZE,
    CreateCourseRequest,
    CreateProviderRequest,
    CreateWebinarRequest,
    ProviderCourse,
    ProviderCourseList,
    ProviderWebinar,
    ProviderWebinarList,
    TrainingProviderDashboard,
    UpdateCourseRequest,
    UpdateWebinarRequest,
    create_my_course,
    create_my_provider,
    create_my_webinar,
    get_my_dashboard,
    list_my_courses,
    list_my_webinars,
    update_my_course,
    update_my_webinar,
)
from app.repositories.user import User
from app.utils.openapi_helpers import standard_error_responses
from app.utils.state import AppState

router = APIRouter(prefix="/training/me", tags=["training-provider"])

AUTH_RESPONSES = standard_error_responses(401, 403)


@router.get("", response_model=TrainingProviderDashboard, responses=AUTH_RESPONSES)
async def read_my_dashboard(
    actor: User = Depends(current_user),
    state: AppState = Depends(get_app_state),
) -> TrainingProviderDashboard:
    """The caller's provider profile and stats, or 404 before it exists."""
    return await get_my_dashboard(state, actor=actor)


@router.post("", response_model=TrainingProviderDashboard, responses=AUTH_RESPONSES)
async def create_provider(
    data: CreateProviderRequest,
    accept_country: str = Header(default="KE", alias="Accept-Country"),
    actor: User = Depends(current_user),
    state: AppState = Depends(get_app_state),
) -> TrainingProviderDashboard:
    """Create the caller's training provider (one per account)."""
    return await create_my_provider(
        state,
        actor=actor,
        data=data,
        country_code=accept_country,
    )


@router.get("/courses", response_model=ProviderCourseList, responses=AUTH_RESPONSES)
async def read_my_courses(
    limit: int = Query(default=DEFAULT_PAGE_SIZE, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    actor: User = Depends(current_user),
    state: AppState = Depends(get_app_state),
) -> ProviderCourseList:
    """One page of the caller's own courses."""
    return await list_my_courses(
        state,
        actor=actor,
        limit=limit,
        offset=offset,
    )


@router.post("/courses", response_model=ProviderCourse, responses=AUTH_RESPONSES)
async def create_course(
    data: CreateCourseRequest,
    accept_currency: str = Header(default="KES", alias="Accept-Currency"),
    actor: User = Depends(current_user),
    state: AppState = Depends(get_app_state),
) -> ProviderCourse:
    """Create a course in the caller's own provider."""
    return await create_my_course(
        state,
        actor=actor,
        data=data,
        currency=accept_currency,
    )


@router.patch(
    "/courses/{course_id}",
    response_model=ProviderCourse,
    responses=AUTH_RESPONSES,
)
async def patch_my_course(
    course_id: str,
    data: UpdateCourseRequest,
    accept_currency: str = Header(default="KES", alias="Accept-Currency"),
    actor: User = Depends(current_user),
    state: AppState = Depends(get_app_state),
) -> ProviderCourse:
    """Partially update one of the caller's own courses (404 for the rest)."""
    return await update_my_course(
        state,
        actor=actor,
        course_id=course_id,
        data=data,
        currency=accept_currency,
    )


@router.get("/webinars", response_model=ProviderWebinarList, responses=AUTH_RESPONSES)
async def read_my_webinars(
    limit: int = Query(default=DEFAULT_PAGE_SIZE, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    actor: User = Depends(current_user),
    state: AppState = Depends(get_app_state),
) -> ProviderWebinarList:
    """One page of the caller's own webinars, past ones included."""
    return await list_my_webinars(
        state,
        actor=actor,
        limit=limit,
        offset=offset,
    )


@router.post("/webinars", response_model=ProviderWebinar, responses=AUTH_RESPONSES)
async def create_webinar(
    data: CreateWebinarRequest,
    actor: User = Depends(current_user),
    state: AppState = Depends(get_app_state),
) -> ProviderWebinar:
    """Create a webinar in the caller's own provider."""
    return await create_my_webinar(
        state,
        actor=actor,
        data=data,
    )


@router.patch(
    "/webinars/{webinar_id}",
    response_model=ProviderWebinar,
    responses=AUTH_RESPONSES,
)
async def patch_my_webinar(
    webinar_id: str,
    data: UpdateWebinarRequest,
    actor: User = Depends(current_user),
    state: AppState = Depends(get_app_state),
) -> ProviderWebinar:
    """Partially update one of the caller's own webinars (404 for the rest)."""
    return await update_my_webinar(
        state,
        actor=actor,
        webinar_id=webinar_id,
        data=data,
    )
