"""Object-upload rules: one purpose per kind of file (ADR-0007, #123).

The route is open to any signed-in User; the purpose adds the real permission
check. Type and size are checked before a presigned URL is issued, and the key
the API hands back is the only key an owning resource is allowed to store.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from typing import Literal

from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.exceptions import (
    ForbiddenException,
    InvalidRequestError,
    NotFoundException,
    UnprocessableError,
)
from app.repositories.profile import ProfileRepository
from app.repositories.upload import UploadedObjectRepository
from app.repositories.user import User
from app.utils.state import AppState
from app.utils.storage import LocalStorage

UploadPurpose = Literal["specialist_avatar", "verification_document"]

MAX_AVATAR_BYTES = 5 * 1024 * 1024
MAX_DOCUMENT_BYTES = 10 * 1024 * 1024
IMAGE_TYPES = frozenset({"image/jpeg", "image/png", "image/webp"})
DOCUMENT_TYPES = IMAGE_TYPES | frozenset({"application/pdf"})


@dataclass(frozen=True)
class _Purpose:
    public: bool
    content_types: frozenset[str]
    max_bytes: int
    extensions: dict[str, str]


PURPOSES: dict[UploadPurpose, _Purpose] = {
    "specialist_avatar": _Purpose(
        public=True,
        content_types=IMAGE_TYPES,
        max_bytes=MAX_AVATAR_BYTES,
        extensions={"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"},
    ),
    "verification_document": _Purpose(
        public=False,
        content_types=DOCUMENT_TYPES,
        max_bytes=MAX_DOCUMENT_BYTES,
        extensions={
            "image/jpeg": "jpg",
            "image/png": "png",
            "image/webp": "webp",
            "application/pdf": "pdf",
        },
    ),
}


class UploadRequest(BaseModel):
    """What the client wants to upload; no file bytes cross this boundary."""

    purpose: UploadPurpose
    content_type: str = Field(min_length=1, max_length=100)
    size: int = Field(gt=0)


class UploadResponse(BaseModel):
    """A single-use presigned PUT and the key it writes."""

    object_key: str
    upload_url: str
    headers: dict[str, str]
    expires_in: int
    method: Literal["PUT"] = "PUT"
    #: Only a public-bucket object gets a URL anyone may read.
    public_url: str | None = None


async def _may_upload(session: AsyncSession, actor: User, purpose: UploadPurpose) -> bool:
    if purpose == "specialist_avatar":
        return await ProfileRepository.has_kind(session, user_id=actor.id, kind="specialist")

    for kind in ("specialist", "supplier", "training_provider"):
        if await ProfileRepository.has_kind(session, user_id=actor.id, kind=kind):
            return True
    return bool(await ProfileRepository.owned_facility_ids(session, actor.id))


async def validate_avatar_key(session: AsyncSession, key: str, actor_id: str) -> None:
    """Only a key issued to this User for this purpose may become their avatar."""
    prefix = f"specialist_avatar/{actor_id}/"
    if (
        not key.startswith(prefix)
        or "/" in key[len(prefix) :]
        or len(key) > 255
        or not await UploadedObjectRepository.belongs_to(
            session, object_key=key, user_id=actor_id, purpose="specialist_avatar"
        )
    ):
        raise UnprocessableError(message="This avatar key was not issued for your account")


async def request_upload(state: AppState, *, actor: User, data: UploadRequest) -> UploadResponse:
    """Check the request, then hand back a presigned PUT for a fresh object key."""
    purpose = PURPOSES[data.purpose]

    if data.content_type not in purpose.content_types or data.size > purpose.max_bytes:
        raise UnprocessableError(message="This content type or size is not allowed for the purpose")

    bucket = state.storage.public_bucket if purpose.public else state.storage.private_bucket
    object_key = (
        f"{data.purpose}/{actor.id}/{uuid.uuid4().hex}.{purpose.extensions[data.content_type]}"
    )

    async with state.db_session_maker() as session:
        if not await _may_upload(session, actor, data.purpose):
            raise ForbiddenException(message="Your account may not upload this purpose")
        await UploadedObjectRepository.record(
            session,
            object_key=object_key,
            user_id=actor.id,
            purpose=data.purpose,
            bucket=bucket,
        )
        await session.commit()

    presigned = state.storage.presign_put(
        bucket=bucket,
        object_key=object_key,
        content_type=data.content_type,
        max_bytes=purpose.max_bytes,
    )
    public_url = (
        state.storage.public_url(bucket=bucket, object_key=object_key) if purpose.public else None
    )

    return UploadResponse(
        object_key=object_key,
        upload_url=presigned.url,
        headers=presigned.headers,
        expires_in=presigned.expires_in,
        public_url=public_url,
    )


def public_avatar_url(state: AppState, key: str | None) -> str | None:
    """Where the public avatar of an object key is served, if it has one."""
    if key is None:
        return None
    return state.storage.public_url(bucket=state.storage.public_bucket, object_key=key)


def _local(state: AppState) -> LocalStorage:
    if not isinstance(state.storage, LocalStorage):
        raise NotFoundException(message="Local storage is not available")
    return state.storage


def store_local_object(state: AppState, ticket: str, body: bytes, content_type: str) -> None:
    """The local stand-in's PUT: only a live ticket with a matching type may write."""
    if not _local(state).store(ticket, body, content_type):
        raise InvalidRequestError(message="This upload URL is invalid or expired")


def read_local_object(state: AppState, ticket: str) -> tuple[bytes, str]:
    """The local stand-in's signed GET, for a public or private object."""
    storage = _local(state)
    found = storage.read(ticket)
    if found is None:
        raise NotFoundException(message="This download URL is invalid or expired")
    bucket, object_key = found
    body = storage.object(bucket, object_key)
    if body is None:
        raise NotFoundException(message="Object not found")
    return body, storage.content_type(bucket, object_key)


def read_public_local_object(state: AppState, bucket: str, object_key: str) -> tuple[bytes, str]:
    """A public-bucket read only; a private object never arrives here."""
    storage = _local(state)
    if bucket != storage.public_bucket:
        raise NotFoundException(message="Object not found")
    body = storage.object(bucket, object_key)
    if body is None:
        raise NotFoundException(message="Object not found")
    return body, storage.content_type(bucket, object_key)
