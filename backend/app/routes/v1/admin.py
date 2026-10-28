"""Admin console routes — thin HTTP adapters over admin logic.

Every route requires a staff-surface token and an ``admin`` or ``super_admin``
role (confirmed with the maintainer for #82). Operators use ``/operations``
instead; a public token is refused here even if its user's stored role is an
admin, because the console lives on the staff surface.

Every write is audited inside its transaction. The reads are excluded from the
public HTTP cache (``app.middleware.http_cache``): one admin's console must
never be served from a shared cache.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query

from app.dependencies import current_admin, get_app_state
from app.logic.v1.admin import (
    ADMIN_LIST_LIMIT,
    AdminAuditList,
    AdminCountry,
    AdminCountryFeature,
    AdminCountryList,
    ModerationItem,
    ModerationList,
    UpdateCountryFeatureRequest,
    UpdateCountryRequest,
    UpdateModerationStatusRequest,
    UpdateVerificationTierRequest,
    VerificationItem,
    VerificationList,
    list_audit,
    list_countries,
    list_moderation,
    list_verifications,
    moderate_job,
    moderate_magazine,
    set_facility_verification,
    set_specialist_verification,
    update_country,
    update_country_feature,
)
from app.repositories.user import User
from app.utils.openapi_helpers import standard_error_responses
from app.utils.state import AppState

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get(
    "/countries",
    response_model=AdminCountryList,
    responses=standard_error_responses(401, 403),
)
async def read_countries(
    actor: User = Depends(current_admin),
    state: AppState = Depends(get_app_state),
) -> AdminCountryList:
    """Every Country, active or retired, with its feature flags."""
    return await list_countries(state, actor=actor)


@router.patch(
    "/countries/{country_code}",
    response_model=AdminCountry,
    responses=standard_error_responses(401, 403),
)
async def patch_country(
    country_code: str,
    request: UpdateCountryRequest,
    actor: User = Depends(current_admin),
    state: AppState = Depends(get_app_state),
) -> AdminCountry:
    """Activate or retire a market."""
    return await update_country(
        state,
        actor=actor,
        country_code=country_code,
        request=request,
    )


@router.patch(
    "/countries/{country_code}/features/{feature}",
    response_model=AdminCountryFeature,
    responses=standard_error_responses(401, 403),
)
async def patch_country_feature(
    country_code: str,
    feature: str,
    request: UpdateCountryFeatureRequest,
    actor: User = Depends(current_admin),
    state: AppState = Depends(get_app_state),
) -> AdminCountryFeature:
    """Turn one Country feature flag on or off."""
    return await update_country_feature(
        state,
        actor=actor,
        country_code=country_code,
        feature=feature,
        request=request,
    )


@router.get(
    "/verifications",
    response_model=VerificationList,
    responses=standard_error_responses(401, 403),
)
async def read_verifications(
    actor: User = Depends(current_admin),
    state: AppState = Depends(get_app_state),
) -> VerificationList:
    """Every Facility and Specialist with its verification tier."""
    return await list_verifications(state, actor=actor)


@router.patch(
    "/facilities/{facility_id}/verification-tier",
    response_model=VerificationItem,
    responses=standard_error_responses(401, 403),
)
async def patch_facility_verification(
    facility_id: str,
    request: UpdateVerificationTierRequest,
    actor: User = Depends(current_admin),
    state: AppState = Depends(get_app_state),
) -> VerificationItem:
    """Set a Facility's single graded verification tier."""
    return await set_facility_verification(
        state,
        actor=actor,
        facility_id=facility_id,
        request=request,
    )


@router.patch(
    "/specialists/{specialist_id}/verification-tier",
    response_model=VerificationItem,
    responses=standard_error_responses(401, 403),
)
async def patch_specialist_verification(
    specialist_id: str,
    request: UpdateVerificationTierRequest,
    actor: User = Depends(current_admin),
    state: AppState = Depends(get_app_state),
) -> VerificationItem:
    """Set a Specialist's single graded verification tier."""
    return await set_specialist_verification(
        state,
        actor=actor,
        specialist_id=specialist_id,
        request=request,
    )


@router.get(
    "/moderation",
    response_model=ModerationList,
    responses=standard_error_responses(401, 403),
)
async def read_moderation(
    limit: int = Query(default=ADMIN_LIST_LIMIT, ge=1, le=200),
    actor: User = Depends(current_admin),
    state: AppState = Depends(get_app_state),
) -> ModerationList:
    """The newest Magazine Items and Job postings, whatever their status."""
    return await list_moderation(
        state,
        actor=actor,
        limit=limit,
    )


@router.patch(
    "/moderation/magazine/{article_id}",
    response_model=ModerationItem,
    responses=standard_error_responses(401, 403),
)
async def patch_magazine_status(
    article_id: str,
    request: UpdateModerationStatusRequest,
    actor: User = Depends(current_admin),
    state: AppState = Depends(get_app_state),
) -> ModerationItem:
    """Publish or hide a Magazine Item."""
    return await moderate_magazine(
        state,
        actor=actor,
        article_id=article_id,
        request=request,
    )


@router.patch(
    "/moderation/jobs/{posting_id}",
    response_model=ModerationItem,
    responses=standard_error_responses(401, 403),
)
async def patch_job_status(
    posting_id: str,
    request: UpdateModerationStatusRequest,
    actor: User = Depends(current_admin),
    state: AppState = Depends(get_app_state),
) -> ModerationItem:
    """Publish or hide a Job posting."""
    return await moderate_job(
        state,
        actor=actor,
        posting_id=posting_id,
        request=request,
    )


@router.get(
    "/audit",
    response_model=AdminAuditList,
    responses=standard_error_responses(401, 403),
)
async def read_audit(
    limit: int = Query(default=ADMIN_LIST_LIMIT, ge=1, le=200),
    actor: User = Depends(current_admin),
    state: AppState = Depends(get_app_state),
) -> AdminAuditList:
    """The newest admin writes, who made them, and what changed."""
    return await list_audit(
        state,
        actor=actor,
        limit=limit,
    )
