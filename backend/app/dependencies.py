"""FastAPI ``Depends()`` factories.

The single source of truth for pulling app-level singletons into handlers.
Handlers depend on these rather than reaching into ``request.app.state`` directly.
"""

from __future__ import annotations

from typing import cast

from starlette.requests import Request

from app.utils.state import AppState


def get_app_state(request: Request) -> AppState:
    return cast(AppState, request.app.state.app_state)
