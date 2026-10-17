"""Facility routes — thin HTTP adapters over facility dashboard logic.

Every route is role-gated to the facility roles (owner, front office, facility
dentist) and scoped to the Facility the signed-in account is linked to, so the
caller never names a facility in the path. Both routes document 401 and 403 as
well as the shared envelope, because an authenticated, role-gated route can
return them (root ``AGENTS.md``, "Auth and security").
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.dependencies import get_app_state
from app.logic.v1.appointments import AppointmentResponse
from app.logic.v1.facility import (
    FACILITY_DASHBOARD_LIMIT,
    FacilityAppointmentUpdateRequest,
    FacilityDashboardResponse,
    get_facility_dashboard,
    update_facility_appointment,
)
from app.utils.openapi_helpers import standard_error_responses
from app.utils.state import AppState

router = APIRouter(prefix="/facility", tags=["facility"])
security = HTTPBearer(auto_error=True)


@router.get(
    "/dashboard",
    response_model=FacilityDashboardResponse,
    responses=standard_error_responses(401, 403),
)
async def read_dashboard(
    limit: int = Query(default=FACILITY_DASHBOARD_LIMIT, ge=1, le=100),
    credentials: HTTPAuthorizationCredentials = Depends(security),
    state: AppState = Depends(get_app_state),
) -> FacilityDashboardResponse:
    """One clinic's day: today's Appointments, the pending queue, and its staff."""
    return await get_facility_dashboard(
        state,
        token=credentials.credentials,
        limit=limit,
    )


@router.patch(
    "/appointments/{appointment_id}",
    response_model=AppointmentResponse,
    responses=standard_error_responses(401, 403),
)
async def update_appointment(
    appointment_id: str,
    request: FacilityAppointmentUpdateRequest,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    state: AppState = Depends(get_app_state),
) -> AppointmentResponse:
    """Move one of the clinic's Appointments one step forward along the workflow."""
    return await update_facility_appointment(
        state,
        token=credentials.credentials,
        appointment_id=appointment_id,
        request=request,
    )
