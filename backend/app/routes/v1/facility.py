"""Facility routes — thin HTTP adapters over facility dashboard logic.

The dashboard is role-gated to the facility roles (owner, front office, facility
dentist) and scoped to the Facility the signed-in account is linked to, so the
caller never names a facility in the path. The appointment workflow also serves
the account that runs the booked Specialist listing, whose Appointment has no
Facility (#113). Both routes document 401 and 403 as well as the shared envelope,
because an authenticated, role-gated route can return them (root ``AGENTS.md``,
"Auth and security").
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query

from app.dependencies import current_user, get_app_state
from app.logic.v1.appointments import AppointmentResponse
from app.logic.v1.facility import (
    FACILITY_DASHBOARD_LIMIT,
    FacilityDashboardResponse,
    ProviderAppointmentUpdateRequest,
    advance_appointment,
    get_facility_dashboard,
)
from app.repositories.user import User
from app.utils.openapi_helpers import standard_error_responses
from app.utils.state import AppState

router = APIRouter(prefix="/facility", tags=["facility"])


@router.get(
    "/dashboard",
    response_model=FacilityDashboardResponse,
    responses=standard_error_responses(401, 403),
)
async def read_dashboard(
    limit: int = Query(default=FACILITY_DASHBOARD_LIMIT, ge=1, le=100),
    actor: User = Depends(current_user),
    state: AppState = Depends(get_app_state),
) -> FacilityDashboardResponse:
    """One clinic's day: today's Appointments, the pending queue, and its staff."""
    return await get_facility_dashboard(
        state,
        actor=actor,
        limit=limit,
    )


@router.patch(
    "/appointments/{appointment_id}",
    response_model=AppointmentResponse,
    responses=standard_error_responses(401, 403),
)
async def update_appointment(
    appointment_id: str,
    request: ProviderAppointmentUpdateRequest,
    actor: User = Depends(current_user),
    state: AppState = Depends(get_app_state),
) -> AppointmentResponse:
    """Move a clinic or Specialist Appointment one step forward along the workflow."""
    return await advance_appointment(
        state,
        actor=actor,
        appointment_id=appointment_id,
        request=request,
    )
