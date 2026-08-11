"""Health logic — the business layer for the health check.

Trivial today, but it keeps the layering honest: routes stay thin HTTP adapters
and the actual "what does healthy mean" answer lives here, where a real check
(database ping, dependency probe) would eventually go.
"""

from __future__ import annotations

from pydantic import BaseModel

from app.config import APP_NAME
from app.utils.state import AppState


class HealthStatus(BaseModel):
    status: str
    service: str
    message: str


def get_health(state: AppState) -> HealthStatus:
    state.logger.debug("health.checked")
    return HealthStatus(
        status="ok",
        service=f"{APP_NAME} API",
        message="ready to work",
    )
