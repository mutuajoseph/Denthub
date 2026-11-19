"""Object storage behind one ``Storage`` interface (ADR-0007, #123).

The API never handles file bytes in production: it hands the client a presigned
PUT for the public or private bucket and keeps only the object key. A local
stand-in serves the same protocol with a small in-process store, so development
and tests need no cloud account. Its HTTP endpoints are registered only outside
production; the private bucket is never reachable through a public URL in either
implementation.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Literal, Protocol
from urllib.parse import quote

from app.config import Settings

if TYPE_CHECKING:
    from mypy_boto3_s3.client import S3Client

PRESIGN_EXPIRES_IN = 900


@dataclass(frozen=True)
class PresignedUpload:
    """The one PUT a client may use to write an object."""

    url: str
    headers: dict[str, str]
    expires_in: int = PRESIGN_EXPIRES_IN
    method: Literal["PUT"] = "PUT"


@dataclass(frozen=True)
class PresignedDownload:
    """A short-lived GET for a private object, embedded in its owner's response."""

    url: str
    expires_in: int = PRESIGN_EXPIRES_IN


def build_storage(settings: Settings) -> Storage:
    """The configured S3 client, or the in-process stand-in when unconfigured."""
    endpoint = settings.storage_endpoint
    key_id = settings.storage_access_key_id
    secret = settings.storage_secret_access_key
    public_bucket = settings.storage_public_bucket
    private_bucket = settings.storage_private_bucket
    public_base_url = settings.storage_public_base_url

    if not (
        endpoint and key_id and secret and public_bucket and private_bucket and public_base_url
    ):
        return LocalStorage(public_bucket=public_bucket or "denthub-images")

    import boto3
    from botocore.config import Config

    client = boto3.client(
        "s3",
        endpoint_url=endpoint,
        aws_access_key_id=key_id,
        aws_secret_access_key=secret,
        region_name="auto",
        config=Config(signature_version="s3v4"),
    )
    return S3Storage(
        client=client,
        public_bucket=public_bucket,
        private_bucket=private_bucket,
        public_base_url=public_base_url,
    )


class Storage(Protocol):
    public_bucket: str
    private_bucket: str

    def presign_put(
        self, *, bucket: str, object_key: str, content_type: str, max_bytes: int | None = None
    ) -> PresignedUpload: ...

    def presign_get(self, *, bucket: str, object_key: str) -> PresignedDownload: ...

    def public_url(self, *, bucket: str, object_key: str) -> str: ...


@dataclass(frozen=True)
class _PutTicket:
    bucket: str
    object_key: str
    content_type: str
    max_bytes: int | None


@dataclass
class LocalStorage:
    """In-process stand-in: presigned-style URLs served by a local-only router."""

    public_bucket: str = "denthub-images"
    private_bucket: str = "denthub-documents"
    base_path: str = "/api/v1/uploads/local"
    max_bytes: int = 10 * 1024 * 1024
    objects: dict[tuple[str, str], bytes] = field(default_factory=dict)
    types: dict[tuple[str, str], str] = field(default_factory=dict)
    puts: dict[str, _PutTicket] = field(default_factory=dict)
    gets: dict[str, tuple[str, str]] = field(default_factory=dict)

    def presign_put(
        self,
        *,
        bucket: str,
        object_key: str,
        content_type: str,
        max_bytes: int | None = None,
    ) -> PresignedUpload:
        ticket = uuid.uuid4().hex
        self.puts[ticket] = _PutTicket(bucket, object_key, content_type, max_bytes)
        return PresignedUpload(
            url=f"{self.base_path}/put/{ticket}", headers={"Content-Type": content_type}
        )

    def presign_get(self, *, bucket: str, object_key: str) -> PresignedDownload:
        ticket = uuid.uuid4().hex
        self.gets[ticket] = (bucket, object_key)
        return PresignedDownload(url=f"{self.base_path}/get/{ticket}")

    def public_url(self, *, bucket: str, object_key: str) -> str:
        if bucket != self.public_bucket:
            raise ValueError("Only a public-bucket object has a public URL")
        return f"{self.base_path}/public/{bucket}/{quote(object_key, safe='/')}"

    def store(self, ticket: str, body: bytes, content_type: str) -> bool:
        """Write the bytes a presigned PUT names; False when the ticket is invalid."""
        details = self.puts.pop(ticket, None)
        limit = min(self.max_bytes, details.max_bytes or self.max_bytes) if details else 0
        if details is None or details.content_type != content_type or len(body) > limit:
            return False
        self.objects[(details.bucket, details.object_key)] = body
        self.types[(details.bucket, details.object_key)] = content_type
        return True

    def read(self, ticket: str) -> tuple[str, str] | None:
        return self.gets.pop(ticket, None)

    def object(self, bucket: str, object_key: str) -> bytes | None:
        return self.objects.get((bucket, object_key))

    def content_type(self, bucket: str, object_key: str) -> str:
        """The type recorded for an object by its presigned PUT."""
        return self.types.get((bucket, object_key), "application/octet-stream")


@dataclass
class S3Storage:
    """Production: presigned PUT/GET on S3-compatible storage (R2 or similar)."""

    client: S3Client
    public_bucket: str
    private_bucket: str
    public_base_url: str
    expires_in: int = PRESIGN_EXPIRES_IN

    def presign_put(
        self,
        *,
        bucket: str,
        object_key: str,
        content_type: str,
        max_bytes: int | None = None,
    ) -> PresignedUpload:
        """Sign a PUT; the declared size was checked in logic before this call."""
        url = self.client.generate_presigned_url(
            "put_object",
            Params={
                "Bucket": bucket,
                "Key": object_key,
                "ContentType": content_type,
            },
            ExpiresIn=self.expires_in,
        )
        return PresignedUpload(
            url=url, headers={"Content-Type": content_type}, expires_in=self.expires_in
        )

    def presign_get(self, *, bucket: str, object_key: str) -> PresignedDownload:
        url = self.client.generate_presigned_url(
            "get_object",
            Params={"Bucket": bucket, "Key": object_key},
            ExpiresIn=self.expires_in,
        )
        return PresignedDownload(url=url, expires_in=self.expires_in)

    def public_url(self, *, bucket: str, object_key: str) -> str:
        if bucket != self.public_bucket:
            raise ValueError("Only a public-bucket object has a public URL")
        return f"{self.public_base_url.rstrip('/')}/{quote(object_key, safe='/')}"
