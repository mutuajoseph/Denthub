"""Health Record routes — thin HTTP adapters over Health Record logic (#84).

Every route is authenticated and role-gated to the Patient who owns the record
(the path's ``patient_id``) or a Verified Medic treating them; a non-patient id
is a 404 and anyone else a 403. The author of a written entry is taken from the
token, never the path or body, so one account cannot author as another.

Both read and write document 401, 403, and 404 (a missing patient is not probed),
because an authenticated, role-gated route can return them (root ``AGENTS.md``,
"Auth and security").
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, status

from app.dependencies import current_user, get_app_state
from app.logic.v1.health_records import (
    HealthRecordEntryRequest,
    HealthRecordEntryResponse,
    HealthRecordResponse,
    HealthRecordUpdateRequest,
    add_health_record_entry,
    get_health_record,
    update_health_record,
)
from app.repositories.user import User
from app.utils.openapi_helpers import standard_error_responses
from app.utils.state import AppState

router = APIRouter(prefix="/health-records", tags=["health-records"])


@router.get(
    "/{patient_id}",
    response_model=HealthRecordResponse,
    responses=standard_error_responses(401, 403),
)
async def read_health_record(
    patient_id: str,
    actor: User = Depends(current_user),
    state: AppState = Depends(get_app_state),
) -> HealthRecordResponse:
    """The Patient's Health Record, for the Patient or a treating Medic."""
    return await get_health_record(
        state,
        actor=actor,
        patient_id=patient_id,
    )


@router.post(
    "/{patient_id}/entries",
    response_model=HealthRecordEntryResponse,
    status_code=status.HTTP_201_CREATED,
    responses=standard_error_responses(401, 403),
)
async def append_health_record_entry(
    patient_id: str,
    request: HealthRecordEntryRequest,
    actor: User = Depends(current_user),
    state: AppState = Depends(get_app_state),
) -> HealthRecordEntryResponse:
    """Append one entry to the Patient's record."""
    return await add_health_record_entry(
        state,
        actor=actor,
        patient_id=patient_id,
        request=request,
    )


@router.patch(
    "/{patient_id}",
    response_model=HealthRecordResponse,
    responses=standard_error_responses(401, 403),
)
async def edit_health_record(
    patient_id: str,
    request: HealthRecordUpdateRequest,
    actor: User = Depends(current_user),
    state: AppState = Depends(get_app_state),
) -> HealthRecordResponse:
    """Update the Patient's own record-level facts (maternal status)."""
    return await update_health_record(
        state,
        actor=actor,
        patient_id=patient_id,
        request=request,
    )
