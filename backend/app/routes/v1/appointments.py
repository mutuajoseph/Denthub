"""Appointment routes — thin HTTP adapters over appointment logic.

Booking, reading back, and cancelling/rescheduling are Patient-only: the routes
carry a bearer token, and the logic decides the role (root ``AGENTS.md``, "Auth
and security"). Every answer documents 401 and 403 as well as the shared
envelope, because an authenticated, role-gated route can return them.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query

from app.dependencies import current_user, get_app_state
from app.logic.v1.appointments import (
    APPOINTMENTS_PAGE_SIZE,
    AppointmentPage,
    AppointmentRequest,
    AppointmentResponse,
    AppointmentUpdateRequest,
    book_appointment,
    list_my_appointments,
    update_my_appointment,
)
from app.repositories.user import User
from app.utils.openapi_helpers import standard_error_responses
from app.utils.state import AppState

router = APIRouter(prefix="/appointments", tags=["appointments"])


@router.post(
    "",
    response_model=AppointmentResponse,
    responses=standard_error_responses(401, 403),
)
async def book(
    request: AppointmentRequest,
    actor: User = Depends(current_user),
    state: AppState = Depends(get_app_state),
) -> AppointmentResponse:
    """Book a Listing for the signed-in Patient as a PENDING Appointment."""
    return await book_appointment(
        state,
        actor=actor,
        request=request,
    )


@router.get(
    "",
    response_model=AppointmentPage,
    responses=standard_error_responses(401, 403),
)
async def read_mine(
    limit: int = Query(default=APPOINTMENTS_PAGE_SIZE, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    actor: User = Depends(current_user),
    state: AppState = Depends(get_app_state),
) -> AppointmentPage:
    """One page of the signed-in Patient's Appointments, soonest slot first."""
    return await list_my_appointments(
        state,
        actor=actor,
        limit=limit,
        offset=offset,
    )


@router.patch(
    "/{appointment_id}",
    response_model=AppointmentResponse,
    responses=standard_error_responses(401, 403),
)
async def update_mine(
    appointment_id: str,
    request: AppointmentUpdateRequest,
    actor: User = Depends(current_user),
    state: AppState = Depends(get_app_state),
) -> AppointmentResponse:
    """Cancel or reschedule one of the signed-in Patient's own Appointments."""
    return await update_my_appointment(
        state,
        actor=actor,
        appointment_id=appointment_id,
        request=request,
    )
