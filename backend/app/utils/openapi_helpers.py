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

#: Codes only an authenticated, role-gated route can answer with. They are not
#: in the default set because a public route never returns them; ask for them
#: explicitly with ``standard_error_responses(401, 403)``.
_AUTH_DESCRIPTIONS: dict[int, str] = {
    401: "Missing, invalid, or expired credentials",
    403: "Authenticated but not permitted",
}


def standard_error_responses(*extra_codes: int) -> dict[int | str, dict[str, Any]]:
    """The shared error envelope, plus any explicitly requested auth codes."""
    descriptions = {**_DESCRIPTIONS, **{code: _AUTH_DESCRIPTIONS[code] for code in extra_codes}}

    return {
        code: {"model": OpenApiErrorResponse, "description": description}
        for code, description in descriptions.items()
    }
