"""The signed-in caller's own account (#128).

Both routes are authenticated public-surface routes: any signed-in User may
export or erase their own account, and a staff token is refused like it is on
every other public route.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Response, status

from app.dependencies import current_user, get_app_state
from app.logic.v1.me import AccountExportResponse, delete_account, export_account
from app.repositories.user import User
from app.utils.openapi_helpers import standard_error_responses
from app.utils.state import AppState

router = APIRouter(prefix="/me", tags=["account"])


@router.get(
    "/export",
    response_model=AccountExportResponse,
    responses=standard_error_responses(401, 403),
)
async def export_my_account(
    actor: User = Depends(current_user),
    state: AppState = Depends(get_app_state),
) -> AccountExportResponse:
    """A JSON copy of the caller's own account data."""
    return await export_account(state, actor=actor)


@router.delete(
    "",
    status_code=status.HTTP_204_NO_CONTENT,
    response_model=None,
    responses=standard_error_responses(401, 403),
)
async def delete_my_account(
    actor: User = Depends(current_user),
    state: AppState = Depends(get_app_state),
) -> Response:
    """Erase the caller's identity now and stop their existing session."""
    await delete_account(state, actor=actor)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
