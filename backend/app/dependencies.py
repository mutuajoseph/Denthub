"""FastAPI ``Depends()`` factories.

The single source of truth for pulling app-level singletons and the signed-in
caller into handlers. Handlers depend on these rather than reaching into
``request.app.state`` or decoding a bearer token themselves.
"""

from __future__ import annotations

from typing import cast

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from starlette.requests import Request

from app.exceptions import ForbiddenException
from app.logic.v1.auth import ADMIN_ROLES, PUBLIC_SCOPE, STAFF_SCOPE, authenticate
from app.repositories.user import User
from app.utils.state import AppState

_bearer = HTTPBearer(auto_error=True)


def get_app_state(request: Request) -> AppState:
    return cast(AppState, request.app.state.app_state)


async def current_user(
    credentials: HTTPAuthorizationCredentials = Depends(_bearer),
    state: AppState = Depends(get_app_state),
) -> User:
    """The active User behind a public-surface token; staff tokens are refused."""
    return await authenticate(state, credentials.credentials, scope=PUBLIC_SCOPE)


async def current_staff(
    credentials: HTTPAuthorizationCredentials = Depends(_bearer),
    state: AppState = Depends(get_app_state),
) -> User:
    """The active Platform Staff member behind a staff-surface token."""
    return await authenticate(state, credentials.credentials, scope=STAFF_SCOPE)


async def current_admin(actor: User = Depends(current_staff)) -> User:
    """A staff caller with an admin role; an Operator's staff token is a 403."""
    if actor.role not in ADMIN_ROLES:
        raise ForbiddenException(message="Only admins may use the admin console")

    return actor


async def current_super_admin(actor: User = Depends(current_staff)) -> User:
    """A staff caller with the ``super_admin`` role; every other role is a 403."""
    if actor.role != "super_admin":
        raise ForbiddenException(message="Only a Super Admin may manage Platform Staff")

    return actor
