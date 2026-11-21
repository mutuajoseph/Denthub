"""Upload routes: one presigned PUT endpoint, plus local-only storage stand-in.

The local endpoints exist only outside production (``main.py`` decides). They
serve the in-process ``LocalStorage`` so a browser can complete an upload with
no cloud account, while keeping the private bucket reachable only through a
short-lived GET ticket — never through a public URL.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Header, Request, Response, status

from app.dependencies import current_user, get_app_state
from app.logic.v1.uploads import (
    UploadRequest,
    UploadResponse,
    read_local_object,
    read_public_local_object,
    request_upload,
    store_local_object,
)
from app.repositories.user import User
from app.utils.openapi_helpers import standard_error_responses
from app.utils.state import AppState

router = APIRouter(prefix="/uploads", tags=["uploads"])


@router.post("", response_model=UploadResponse, responses=standard_error_responses(401, 403))
async def create_upload(
    data: UploadRequest,
    actor: User = Depends(current_user),
    state: AppState = Depends(get_app_state),
) -> UploadResponse:
    """Issue a presigned PUT for one purpose, after checking type, size and role."""
    return await request_upload(state, actor=actor, data=data)


local_router = APIRouter(prefix="/uploads/local", tags=["uploads"])


@local_router.put("/put/{ticket}", status_code=status.HTTP_204_NO_CONTENT)
async def local_put(
    ticket: str,
    request: Request,
    state: AppState = Depends(get_app_state),
    content_type: str | None = Header(default=None, alias="content-type"),
) -> None:
    """Accept the bytes a local presigned PUT names."""
    store_local_object(state, ticket, await request.body(), content_type or "")


@local_router.get("/get/{ticket}")
async def local_get(
    ticket: str,
    state: AppState = Depends(get_app_state),
) -> Response:
    """Read an object through a short-lived ticket (private or public bucket)."""
    body, content_type = read_local_object(state, ticket)
    return Response(content=body, media_type=content_type, headers={"Cache-Control": "no-store"})


@local_router.get("/public/{bucket}/{object_key:path}")
async def local_public(
    bucket: str,
    object_key: str,
    state: AppState = Depends(get_app_state),
) -> Response:
    """Public-bucket reads only; a private object can never arrive here."""
    body, content_type = read_public_local_object(state, bucket, object_key)
    return Response(content=body, media_type=content_type)
