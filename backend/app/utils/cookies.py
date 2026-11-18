"""Refresh-cookie plumbing (ADR-0003 follow-up, #121).

The cookie is the one place the session survives a page reload, so its
attributes are set in exactly one place:

- ``HttpOnly`` — no script can read it, which is the point of moving off
  localStorage.
- ``Secure`` in production only, so local http development still works.
- ``SameSite=Lax`` — a cross-site POST never carries it, which is the CSRF
  protection ADR-0003 step 3 asked for (recorded in that ADR).
- A distinct cookie name per auth surface, so each route reads only its own
  cookie. The public ``Path`` is a prefix of the staff path, so both cookies
  may be sent on a staff request; the name and the JWT scope keep the surfaces
  apart, not the path.
"""

from __future__ import annotations

from fastapi import Response

from app.logic.v1.auth import REFRESH_TOKEN_TTL, refresh_cookie_scope
from app.utils.state import AppState


def _secure(state: AppState) -> bool:
    return state.settings.environment == "production"


def set_refresh_cookie(
    response: Response,
    state: AppState,
    *,
    token: str,
    scope: str,
) -> None:
    """Attach the rotating refresh token to a sign-in or refresh response."""
    name, path = refresh_cookie_scope(scope)
    response.set_cookie(
        key=name,
        value=token,
        max_age=int(REFRESH_TOKEN_TTL.total_seconds()),
        path=path,
        httponly=True,
        secure=_secure(state),
        samesite="lax",
    )


def clear_refresh_cookie(response: Response, state: AppState, *, scope: str) -> None:
    """Expire the cookie on logout; the path must match the one that set it."""
    name, path = refresh_cookie_scope(scope)
    response.delete_cookie(
        key=name,
        path=path,
        httponly=True,
        secure=_secure(state),
        samesite="lax",
    )
