"""HTTP-level tests for the public signup and login endpoints.

Public signup creates public account types only (PRD §2); staff roles are
granted by staff, never requested by the caller.
"""

from __future__ import annotations

from typing import Any

from httpx import AsyncClient


def signup_payload(**overrides: Any) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "full_name": "Amina Wanjiku",
        "email": "amina@example.com",
        "password": "correct horse battery staple",
        "account_type": "patient",
    }
    payload.update(overrides)
    return payload


async def test_patient_signup_succeeds(client: AsyncClient) -> None:
    response = await client.post("/api/v1/auth/register", json=signup_payload())

    assert response.status_code == 200
    body = response.json()
    assert body["access_token"]
    assert body["user"]["role"] == "patient"
    assert body["user"]["is_staff"] is False


async def test_signup_ignores_a_role_supplied_in_the_body(client: AsyncClient) -> None:
    response = await client.post(
        "/api/v1/auth/register",
        json=signup_payload(role="admin"),
    )

    assert response.status_code == 200
    body = response.json()
    assert body["user"]["role"] != "admin"
    assert body["user"]["role"] == "patient"
    assert body["user"]["is_staff"] is False


async def test_public_account_type_is_honoured(client: AsyncClient) -> None:
    response = await client.post(
        "/api/v1/auth/register",
        json=signup_payload(email="supplier@example.com", account_type="supplier"),
    )

    assert response.status_code == 200
    body = response.json()
    assert body["user"]["role"] == "supplier"
    assert body["user"]["is_staff"] is False


async def test_specialist_signup_is_honoured(client: AsyncClient) -> None:
    response = await client.post(
        "/api/v1/auth/register",
        json=signup_payload(email="kiptoo@example.com", account_type="specialist"),
    )

    assert response.status_code == 200
    body = response.json()
    assert body["user"]["role"] == "specialist"
    assert body["user"]["is_staff"] is False


async def test_staff_account_type_is_rejected(client: AsyncClient) -> None:
    response = await client.post(
        "/api/v1/auth/register",
        json=signup_payload(email="admin@example.com", account_type="admin"),
    )

    assert response.status_code == 422


async def test_me_reports_a_granted_role_as_not_staff(client: AsyncClient) -> None:
    signup = await client.post("/api/v1/auth/register", json=signup_payload())
    token = signup.json()["access_token"]

    response = await client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 200
    assert response.json()["is_staff"] is False
