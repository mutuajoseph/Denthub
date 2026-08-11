"""OpenAPI helpers.

``standard_error_responses()`` attaches the shared error envelope to a route's
OpenAPI spec so every endpoint documents the same error codes without repetition.
"""

from __future__ import annotations

from typing import Any

from app.exceptions import OpenApiErrorResponse

_DESCRIPTIONS: dict[int, str] = {
    400: "Invalid request",
    404: "Not found",
    409: "Conflict",
    422: "Validation error",
    500: "Internal server error",
}


def standard_error_responses() -> dict[int | str, dict[str, Any]]:
    return {
        code: {"model": OpenApiErrorResponse, "description": description}
        for code, description in _DESCRIPTIONS.items()
    }
