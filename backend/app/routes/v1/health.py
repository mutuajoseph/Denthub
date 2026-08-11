"""Health route — a thin HTTP adapter over the health logic.

No business logic here: pull app state, call the logic function, return its
typed result. ``standard_error_responses()`` documents the shared error shape.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends

from app.dependencies import get_app_state
from app.logic.v1.health import HealthStatus, get_health
from app.utils.openapi_helpers import standard_error_responses
from app.utils.state import AppState

router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthStatus, responses=standard_error_responses())
async def health(state: AppState = Depends(get_app_state)) -> HealthStatus:
    return get_health(state)
