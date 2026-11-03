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
from app.logic.v1.reference import (
    AdminInsuranceProvider,
    AdminInsuranceProviderList,
    AdminSpecialty,
    AdminSpecialtyList,
    AdminSubdivision,
    AdminSubdivisionList,
    AdminTreatment,
    AdminTreatmentList,
    CreateInsuranceProviderRequest,
    CreateSpecialtyRequest,
    CreateSubdivisionRequest,
    CreateTreatmentRequest,
    UpdateInsuranceProviderRequest,
    UpdateSpecialtyRequest,
    UpdateSubdivisionRequest,
    UpdateTreatmentRequest,
    create_insurance_provider,
    create_specialty,
    create_subdivision,
    create_treatment,
    delete_insurance_provider,
    delete_specialty,
    delete_subdivision,
    delete_treatment,
    list_insurance_providers,
    list_specialties,
    list_subdivisions,
    list_treatments,
    update_insurance_provider,
    update_specialty,
    update_subdivision,
    update_treatment,
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


# --- Reference data ---------------------------------------------------------


@router.get(
    "/specialties",
    response_model=AdminSpecialtyList,
    responses=standard_error_responses(401, 403),
)
async def read_specialties(
    actor: User = Depends(current_admin),
    state: AppState = Depends(get_app_state),
) -> AdminSpecialtyList:
    """Every Specialty, retired ones included."""
    return await list_specialties(state, actor=actor)


@router.post(
    "/specialties",
    response_model=AdminSpecialty,
    status_code=201,
    responses=standard_error_responses(401, 403),
)
async def post_specialty(
    request: CreateSpecialtyRequest,
    actor: User = Depends(current_admin),
    state: AppState = Depends(get_app_state),
) -> AdminSpecialty:
    """Add a Specialty to the reference list."""
    return await create_specialty(state, actor=actor, request=request)


@router.patch(
    "/specialties/{specialty_id}",
    response_model=AdminSpecialty,
    responses=standard_error_responses(401, 403),
)
async def patch_specialty(
    specialty_id: str,
    request: UpdateSpecialtyRequest,
    actor: User = Depends(current_admin),
    state: AppState = Depends(get_app_state),
) -> AdminSpecialty:
    """Change a Specialty, or restore a retired one."""
    return await update_specialty(
        state,
        actor=actor,
        specialty_id=specialty_id,
        request=request,
    )


@router.delete(
    "/specialties/{specialty_id}",
    status_code=204,
    response_model=None,
    responses=standard_error_responses(401, 403),
)
async def remove_specialty(
    specialty_id: str,
    actor: User = Depends(current_admin),
    state: AppState = Depends(get_app_state),
) -> None:
    """Retire a Specialty."""
    await delete_specialty(state, actor=actor, specialty_id=specialty_id)


@router.get(
    "/treatments",
    response_model=AdminTreatmentList,
    responses=standard_error_responses(401, 403),
)
async def read_treatments(
    actor: User = Depends(current_admin),
    state: AppState = Depends(get_app_state),
) -> AdminTreatmentList:
    """Every Treatment, retired ones included."""
    return await list_treatments(state, actor=actor)


@router.post(
    "/treatments",
    response_model=AdminTreatment,
    status_code=201,
    responses=standard_error_responses(401, 403),
)
async def post_treatment(
    request: CreateTreatmentRequest,
    actor: User = Depends(current_admin),
    state: AppState = Depends(get_app_state),
) -> AdminTreatment:
    """Add a Treatment to the platform-wide list."""
    return await create_treatment(state, actor=actor, request=request)


@router.patch(
    "/treatments/{treatment_id}",
    response_model=AdminTreatment,
    responses=standard_error_responses(401, 403),
)
async def patch_treatment(
    treatment_id: str,
    request: UpdateTreatmentRequest,
    actor: User = Depends(current_admin),
    state: AppState = Depends(get_app_state),
) -> AdminTreatment:
    """Change a Treatment, or restore a retired one."""
    return await update_treatment(
        state,
        actor=actor,
        treatment_id=treatment_id,
        request=request,
    )


@router.delete(
    "/treatments/{treatment_id}",
    status_code=204,
    response_model=None,
    responses=standard_error_responses(401, 403),
)
async def remove_treatment(
    treatment_id: str,
    actor: User = Depends(current_admin),
    state: AppState = Depends(get_app_state),
) -> None:
    """Retire a Treatment."""
    await delete_treatment(state, actor=actor, treatment_id=treatment_id)


@router.get(
    "/countries/{country_code}/insurance-providers",
    response_model=AdminInsuranceProviderList,
    responses=standard_error_responses(401, 403),
)
async def read_insurance_providers(
    country_code: str,
    actor: User = Depends(current_admin),
    state: AppState = Depends(get_app_state),
) -> AdminInsuranceProviderList:
    """Every insurer in a Country, retired ones included."""
    return await list_insurance_providers(
        state,
        actor=actor,
        country_code=country_code,
    )


@router.post(
    "/countries/{country_code}/insurance-providers",
    response_model=AdminInsuranceProvider,
    status_code=201,
    responses=standard_error_responses(401, 403),
)
async def post_insurance_provider(
    country_code: str,
    request: CreateInsuranceProviderRequest,
    actor: User = Depends(current_admin),
    state: AppState = Depends(get_app_state),
) -> AdminInsuranceProvider:
    """Add an insurer to one Country."""
    return await create_insurance_provider(
        state,
        actor=actor,
        country_code=country_code,
        request=request,
    )


@router.patch(
    "/countries/{country_code}/insurance-providers/{provider_id}",
    response_model=AdminInsuranceProvider,
    responses=standard_error_responses(401, 403),
)
async def patch_insurance_provider(
    country_code: str,
    provider_id: str,
    request: UpdateInsuranceProviderRequest,
    actor: User = Depends(current_admin),
    state: AppState = Depends(get_app_state),
) -> AdminInsuranceProvider:
    """Change an insurer, or restore a retired one."""
    return await update_insurance_provider(
        state,
        actor=actor,
        country_code=country_code,
        provider_id=provider_id,
        request=request,
    )


@router.delete(
    "/countries/{country_code}/insurance-providers/{provider_id}",
    status_code=204,
    response_model=None,
    responses=standard_error_responses(401, 403),
)
async def remove_insurance_provider(
    country_code: str,
    provider_id: str,
    actor: User = Depends(current_admin),
    state: AppState = Depends(get_app_state),
) -> None:
    """Retire an insurer."""
    await delete_insurance_provider(
        state,
        actor=actor,
        country_code=country_code,
        provider_id=provider_id,
    )


@router.get(
    "/countries/{country_code}/subdivisions",
    response_model=AdminSubdivisionList,
    responses=standard_error_responses(401, 403),
)
async def read_subdivisions(
    country_code: str,
    actor: User = Depends(current_admin),
    state: AppState = Depends(get_app_state),
) -> AdminSubdivisionList:
    """Every Subdivision in a Country, retired ones included."""
    return await list_subdivisions(
        state,
        actor=actor,
        country_code=country_code,
    )


@router.post(
    "/countries/{country_code}/subdivisions",
    response_model=AdminSubdivision,
    status_code=201,
    responses=standard_error_responses(401, 403),
)
async def post_subdivision(
    country_code: str,
    request: CreateSubdivisionRequest,
    actor: User = Depends(current_admin),
    state: AppState = Depends(get_app_state),
) -> AdminSubdivision:
    """Add a Subdivision to one Country."""
    return await create_subdivision(
        state,
        actor=actor,
        country_code=country_code,
        request=request,
    )


@router.patch(
    "/countries/{country_code}/subdivisions/{subdivision_id}",
    response_model=AdminSubdivision,
    responses=standard_error_responses(401, 403),
)
async def patch_subdivision(
    country_code: str,
    subdivision_id: str,
    request: UpdateSubdivisionRequest,
    actor: User = Depends(current_admin),
    state: AppState = Depends(get_app_state),
) -> AdminSubdivision:
    """Rename a Subdivision, or restore a retired one."""
    return await update_subdivision(
        state,
        actor=actor,
        country_code=country_code,
        subdivision_id=subdivision_id,
        request=request,
    )


@router.delete(
    "/countries/{country_code}/subdivisions/{subdivision_id}",
    status_code=204,
    response_model=None,
    responses=standard_error_responses(401, 403),
)
async def remove_subdivision(
    country_code: str,
    subdivision_id: str,
    actor: User = Depends(current_admin),
    state: AppState = Depends(get_app_state),
) -> None:
    """Retire a Subdivision."""
    await delete_subdivision(
        state,
        actor=actor,
        country_code=country_code,
        subdivision_id=subdivision_id,
    )
