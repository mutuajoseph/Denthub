"""Presigned uploads through ``/uploads`` (ADR-0007, #123)."""

from __future__ import annotations

import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy import select

from app.config import Settings
from app.logic.v1.auth import create_access_token, hash_password
from app.repositories.listing import Facility
from app.repositories.profile import Profile, ProfileRepository
from app.repositories.user import User
from app.utils.state import AppState
from app.utils.storage import LocalStorage, S3Storage, build_storage

PASSWORD = "correct horse battery staple"
AVATAR = {"purpose": "specialist_avatar", "content_type": "image/png", "size": 1024}
DOCUMENT = {"purpose": "verification_document", "content_type": "application/pdf", "size": 1024}


def _headers(state: AppState, user: User) -> dict[str, str]:
    return {"Authorization": f"Bearer {create_access_token(state, user.id, user.role)}"}


async def _make_user(state: AppState, *, kind: str | None = None) -> User:
    async with state.db_session_maker() as session:
        user = User(
            full_name="Upload Tester",
            email=f"upload-{uuid.uuid4().hex[:8]}@example.com",
            role=kind or "patient",
            password_hash=hash_password(PASSWORD),
        )
        session.add(user)
        await session.flush()
        if kind in {"specialist", "supplier", "training_provider"}:
            session.add(Profile(user_id=user.id, kind=kind))
        await session.commit()
        return user


async def _facility_owner(state: AppState) -> User:
    user = await _make_user(state, kind="facility_owner")
    async with state.db_session_maker() as session:
        facility = (await session.execute(select(Facility).limit(1))).scalar_one()
        await ProfileRepository.add_owner(session, user_id=user.id, facility_id=facility.id)
        await session.commit()
    return user


def test_local_without_credentials_uses_the_in_process_store(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    for name in (
        "STORAGE_ENDPOINT",
        "STORAGE_ACCESS_KEY_ID",
        "STORAGE_SECRET_ACCESS_KEY",
        "STORAGE_PUBLIC_BUCKET",
        "STORAGE_PRIVATE_BUCKET",
        "STORAGE_PUBLIC_BASE_URL",
    ):
        monkeypatch.delenv(name, raising=False)

    assert isinstance(build_storage(Settings.from_env()), LocalStorage)


def test_configured_storage_builds_an_s3_client(monkeypatch: pytest.MonkeyPatch) -> None:
    for name, value in (
        ("STORAGE_ENDPOINT", "https://objects.example.com"),
        ("STORAGE_ACCESS_KEY_ID", "key"),
        ("STORAGE_SECRET_ACCESS_KEY", "secret"),
        ("STORAGE_PUBLIC_BUCKET", "images"),
        ("STORAGE_PRIVATE_BUCKET", "documents"),
        ("STORAGE_PUBLIC_BASE_URL", "https://images.example.com"),
    ):
        monkeypatch.setenv(name, value)

    assert isinstance(build_storage(Settings.from_env()), S3Storage)


async def test_a_specialist_gets_a_presigned_put_and_can_show_the_avatar(
    client: AsyncClient, state: AppState
) -> None:
    user = await _make_user(state, kind="specialist")

    issued = await client.post("/api/v1/uploads", headers=_headers(state, user), json=AVATAR)

    assert issued.status_code == 200, issued.text
    upload = issued.json()
    assert upload["method"] == "PUT"
    assert upload["object_key"].startswith(f"specialist_avatar/{user.id}/")
    assert upload["headers"]["Content-Type"] == "image/png"
    assert upload["expires_in"] > 0
    assert upload["upload_url"]
    assert upload["public_url"]

    put = await client.put(upload["upload_url"], content=b"png-bytes", headers=upload["headers"])
    assert put.status_code == 204, put.text

    image = await client.get(upload["public_url"])
    assert image.status_code == 200
    assert image.content == b"png-bytes"
    assert image.headers["content-type"].startswith("image/png")


async def test_a_patient_can_not_upload_an_avatar(client: AsyncClient, state: AppState) -> None:
    user = await _make_user(state)

    response = await client.post("/api/v1/uploads", headers=_headers(state, user), json=AVATAR)

    assert response.status_code == 403


@pytest.mark.parametrize(
    "payload",
    [
        {**AVATAR, "purpose": "unknown_purpose"},
        {**AVATAR, "content_type": "application/pdf"},
        {**AVATAR, "size": 6 * 1024 * 1024},
        {**DOCUMENT, "content_type": "text/html"},
    ],
)
async def test_a_disallowed_purpose_type_or_size_is_refused_before_a_url_is_issued(
    client: AsyncClient, state: AppState, payload: dict[str, object]
) -> None:
    user = await _make_user(state, kind="specialist")

    response = await client.post("/api/v1/uploads", headers=_headers(state, user), json=payload)

    assert response.status_code == 422
    assert "object_key" not in response.json()


async def test_uploads_require_a_signed_in_user(client: AsyncClient) -> None:
    response = await client.post("/api/v1/uploads", json=AVATAR)

    assert response.status_code == 401


async def test_a_verification_document_is_private(client: AsyncClient, state: AppState) -> None:
    user = await _make_user(state, kind="supplier")

    response = await client.post("/api/v1/uploads", headers=_headers(state, user), json=DOCUMENT)

    assert response.status_code == 200, response.text
    upload = response.json()
    assert upload["object_key"].startswith(f"verification_document/{user.id}/")
    assert upload["public_url"] is None
    with pytest.raises(ValueError, match="public"):
        state.storage.public_url(
            bucket=state.storage.private_bucket, object_key=upload["object_key"]
        )


async def test_a_private_object_has_a_signed_get_but_no_public_url(
    client: AsyncClient, state: AppState
) -> None:
    user = await _make_user(state, kind="supplier")
    upload = (
        await client.post("/api/v1/uploads", headers=_headers(state, user), json=DOCUMENT)
    ).json()
    put = await client.put(upload["upload_url"], content=b"pdf", headers=upload["headers"])
    assert put.status_code == 204

    download = state.storage.presign_get(
        bucket=state.storage.private_bucket, object_key=upload["object_key"]
    )
    signed = await client.get(download.url)
    assert signed.status_code == 200
    assert signed.content == b"pdf"

    denied = await client.get(
        f"/api/v1/uploads/local/public/{state.storage.private_bucket}/{upload['object_key']}"
    )
    assert denied.status_code == 404


async def test_the_local_store_enforces_the_purpose_size_limit(
    client: AsyncClient, state: AppState
) -> None:
    user = await _make_user(state, kind="specialist")
    upload = (
        await client.post(
            "/api/v1/uploads",
            headers=_headers(state, user),
            json={**AVATAR, "size": 5 * 1024 * 1024},
        )
    ).json()

    put = await client.put(
        upload["upload_url"], content=b"x" * (6 * 1024 * 1024), headers=upload["headers"]
    )

    assert put.status_code == 400


async def test_a_facility_owner_can_upload_a_verification_document(
    client: AsyncClient, state: AppState
) -> None:
    owner = await _facility_owner(state)

    response = await client.post("/api/v1/uploads", headers=_headers(state, owner), json=DOCUMENT)

    assert response.status_code == 200, response.text


async def test_an_uploaded_avatar_shows_on_the_public_profile(
    client: AsyncClient, state: AppState
) -> None:
    user = await _make_user(state, kind="specialist")
    listing = await client.post(
        "/api/v1/dentists/me",
        headers=_headers(state, user),
        json={"country_code": "KE", "subdivision_code": "NAIROBI"},
    )
    assert listing.status_code == 200, listing.text
    listing_id = listing.json()["id"]

    before = await client.get(f"/api/v1/dentists/{listing_id}")
    assert before.json()["avatar_url"] is None

    upload = (
        await client.post("/api/v1/uploads", headers=_headers(state, user), json=AVATAR)
    ).json()
    assert (
        await client.put(upload["upload_url"], content=b"png", headers=upload["headers"])
    ).status_code == 204
    patched = await client.patch(
        "/api/v1/dentists/me",
        headers=_headers(state, user),
        json={"avatar_key": upload["object_key"]},
    )
    assert patched.status_code == 200, patched.text

    after = await client.get(f"/api/v1/dentists/{listing_id}")
    assert after.status_code == 200
    assert after.json()["avatar_key"] == upload["object_key"]
    assert after.json()["avatar_url"] == upload["public_url"]


async def test_a_foreign_avatar_key_is_refused(client: AsyncClient, state: AppState) -> None:
    user = await _make_user(state, kind="specialist")
    created = await client.post(
        "/api/v1/dentists/me",
        headers=_headers(state, user),
        json={"country_code": "KE", "subdivision_code": "NAIROBI"},
    )
    assert created.status_code == 200, created.text

    patched = await client.patch(
        "/api/v1/dentists/me",
        headers=_headers(state, user),
        json={"avatar_key": "specialist_avatar/someone-else/photo.png"},
    )

    assert patched.status_code == 422


async def test_an_unissued_avatar_key_is_refused(client: AsyncClient, state: AppState) -> None:
    user = await _make_user(state, kind="specialist")
    created = await client.post(
        "/api/v1/dentists/me",
        headers=_headers(state, user),
        json={"country_code": "KE", "subdivision_code": "NAIROBI"},
    )
    assert created.status_code == 200, created.text

    patched = await client.patch(
        "/api/v1/dentists/me",
        headers=_headers(state, user),
        json={"avatar_key": f"specialist_avatar/{user.id}/never-issued.png"},
    )

    assert patched.status_code == 422
