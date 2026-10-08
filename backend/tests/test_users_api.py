"""HTTP-level tests for approving pending professional accounts.

Only admins and super-admins may approve; the decision lives in the route's
user (root AGENTS.md, "Auth and security"), never in request input.
"""

from __future__ import annotations

import uuid
from typing import Any

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import async_sessionmaker

from app.logic.v1.auth import hash_password
from app.repositories.user import UserRepository


async def _create_admin(session_maker: async_sessionmaker[Any]) -> tuple[str, str]:
    email = f"admin-{uuid.uuid4().hex[:8]}@example.com"
    password = "correct horse battery staple"
    async with session_maker() as session:
        await UserRepository.create(
            session,
            full_name="Platform Admin",
            email=email,
            password_hash=hash_password(password),
            role="admin",
        )
        await session.commit()
    return email, password


async def _login(client: AsyncClient, email: str, password: str) -> dict[str, str]:
    response = await client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": password},
    )
    assert response.status_code == 200
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


async def test_admin_approves_a_pending_professional(
    client: AsyncClient,
    session_maker: async_sessionmaker[Any],
) -> None:
    email, password = await _create_admin(session_maker)
    admin_headers = await _login(client, email, password)

    signup = await client.post(
        "/api/v1/auth/register",
        json={
            "full_name": "Wanjiru Kamau",
            "email": "wanjiru@example.com",
            "password": "correct horse battery staple",
            "account_type": "specialist",
        },
    )
    assert signup.json()["user"]["account_status"] == "pending"
    user_id = signup.json()["user"]["id"]

    response = await client.post(
        f"/api/v1/users/{user_id}/approve",
        headers=admin_headers,
    )

    assert response.status_code == 200
    body = response.json()
    assert body["id"] == user_id
    assert body["role"] == "specialist"
    assert body["is_staff"] is False
    assert body["account_status"] == "active"

    login = await client.post(
        "/api/v1/auth/login",
        json={"email": "wanjiru@example.com", "password": "correct horse battery staple"},
    )
    assert login.json()["user"]["account_status"] == "active"


async def test_approve_is_rejected_for_non_admin_roles(
    client: AsyncClient,
    session_maker: async_sessionmaker[Any],
) -> None:
    admin_email, admin_password = await _create_admin(session_maker)
    admin_headers = await _login(client, admin_email, admin_password)

    signup = await client.post(
        "/api/v1/auth/register",
        json={
            "full_name": "Otieno Odhiambo",
            "email": "otieno@example.com",
            "password": "correct horse battery staple",
            "account_type": "supplier",
        },
    )
    user_id = signup.json()["user"]["id"]

    await client.post(
        "/api/v1/auth/register",
        json={
            "full_name": "Patient Karanja",
            "email": "patient@example.com",
            "password": "correct horse battery staple",
            "account_type": "patient",
        },
    )
    patient_headers = await _login(client, "patient@example.com", "correct horse battery staple")
    await client.post(
        "/api/v1/auth/register",
        json={
            "full_name": "Supplier Staff",
            "email": "supplier@example.com",
            "password": "correct horse battery staple",
            "account_type": "supplier",
        },
    )
    supplier_headers = await _login(
        client,
        "supplier@example.com",
        "correct horse battery staple",
    )

    for headers in (patient_headers, supplier_headers):
        response = await client.post(
            f"/api/v1/users/{user_id}/approve",
            headers=headers,
        )
        assert response.status_code == 403

    still_pending = await client.post(
        "/api/v1/auth/login",
        json={"email": "otieno@example.com", "password": "correct horse battery staple"},
    )
    assert still_pending.json()["user"]["account_status"] == "pending"

    approved = await client.post(
        f"/api/v1/users/{user_id}/approve",
        headers=admin_headers,
    )
    assert approved.status_code == 200
    assert approved.json()["account_status"] == "active"


async def test_approve_of_an_unknown_user_is_404(
    client: AsyncClient,
    session_maker: async_sessionmaker[Any],
) -> None:
    email, password = await _create_admin(session_maker)
    admin_headers = await _login(client, email, password)

    response = await client.post(
        f"/api/v1/users/{uuid.uuid4()}/approve",
        headers=admin_headers,
    )

    assert response.status_code == 404


async def test_approve_is_idempotent(
    client: AsyncClient,
    session_maker: async_sessionmaker[Any],
) -> None:
    email, password = await _create_admin(session_maker)
    admin_headers = await _login(client, email, password)

    signup = await client.post(
        "/api/v1/auth/register",
        json={
            "full_name": "Alice Wambui",
            "email": "alice@example.com",
            "password": "correct horse battery staple",
            "account_type": "patient",
        },
    )
    user_id = signup.json()["user"]["id"]
    assert signup.json()["user"]["account_status"] == "active"

    response = await client.post(
        f"/api/v1/users/{user_id}/approve",
        headers=admin_headers,
    )

    assert response.status_code == 200
    assert response.json()["account_status"] == "active"