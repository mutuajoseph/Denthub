"""Specialist (dentist) routes — read the caller's own appointment list.

The provider workflow itself reuses the facility routes (#113): advancing a
Specialist-listing Appointment goes through ``PATCH /facility/appointments/{id}``,
scoped to the account that runs the booked listing.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends

from app.dependencies import current_user, get_app_state
from app.logic.v1.appointments import (
    AppointmentResponse,
    list_specialist_appointments,
)
from app.repositories.user import User
from app.utils.openapi_helpers import standard_error_responses
from app.utils.state import AppState

router = APIRouter(prefix="/dentists", tags=["dentists"])


@router.get(
    "/me/appointments",
    response_model=list[AppointmentResponse],
    responses=standard_error_responses(401, 403),
)
async def read_my_appointments(
    actor: User = Depends(current_user),
    state: AppState = Depends(get_app_state),
) -> list[AppointmentResponse]:
    """Appointments naming the signed-in Specialist's own listing."""
    return await list_specialist_appointments(state, actor=actor)
