"""HTTP-level tests for the staff auth surface (``/auth/staff/*``).

The staff surface is a separate sign-in for platform staff only (PRD §6, issue
#80). It shares the users table with the public surface, so a staff token is
distinguished by its issuer and ``scope`` claim rather than by a second store.
An account that is not platform staff cannot sign in here, and no request input
can turn a caller into staff (root AGENTS.md, "Auth and security").
"""

from __future__ import annotations

import uuid
from typing import Any

import jwt
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import async_sessionmaker

from app.logic.v1.auth import (
    STAFF_SCOPE,
    STAFF_TOKEN_ISSUER,
    hash_password,
)
from app.repositories.user import UserRepository

PASSWORD = "correct horse battery staple"


async def _create_user(
    session_maker: async_sessionmaker[Any],
    role: str,
) -> tuple[str, str]:
    """Create a user with ``role`` and a known password; return (email, password)."""
    email = f"{role}-{uuid.uuid4().hex[:8]}@example.com"
    async with session_maker() as session:
        await UserRepository.create(
            session,
            full_name=f"Account {role}",
            email=email,
            password_hash=hash_password(PASSWORD),
            role=role,
            account_status="active",
        )
        await session.commit()
    return email, PASSWORD


async def test_admin_signs_in_and_receives_a_staff_token(
    client: AsyncClient,
    session_maker: async_sessionmaker[Any],
) -> None:
    email, password = await _create_user(session_maker, "admin")

    response = await client.post(
        "/api/v1/auth/staff/login",
        json={"email": email, "password": password},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["user"]["role"] == "admin"
    assert body["user"]["is_staff"] is True

    claims = jwt.decode(body["access_token"], options={"verify_signature": False})
    assert claims["scope"] == STAFF_SCOPE
    assert claims["iss"] == STAFF_TOKEN_ISSUER


async def test_platform_operator_may_sign_in(
    client: AsyncClient,
    session_maker: async_sessionmaker[Any],
) -> None:
    email, password = await _create_user(session_maker, "platform_operator")

    response = await client.post(
        "/api/v1/auth/staff/login",
        json={"email": email, "password": password},
    )

    assert response.status_code == 200
    assert response.json()["user"]["is_staff"] is True


async def test_public_token_is_marked_public(
    client: AsyncClient,
) -> None:
    signup = await client.post(
        "/api/v1/auth/register",
        json={
            "full_name": "Amina Wanjiku",
            "email": "amina@example.com",
            "password": PASSWORD,
            "account_type": "patient",
        },
    )

    claims = jwt.decode(
        signup.json()["access_token"],
        options={"verify_signature": False},
    )

    assert claims["scope"] == "public"
    assert claims["iss"] != STAFF_TOKEN_ISSUER


async def test_wrong_password_is_rejected(
    client: AsyncClient,
    session_maker: async_sessionmaker[Any],
) -> None:
    email, _ = await _create_user(session_maker, "admin")

    response = await client.post(
        "/api/v1/auth/staff/login",
        json={"email": email, "password": "not the password"},
    )

    assert response.status_code == 401


async def test_public_account_is_refused_at_the_staff_surface(
    client: AsyncClient,
) -> None:
    await client.post(
        "/api/v1/auth/register",
        json={
            "full_name": "Amina Wanjiku",
            "email": "patient@example.com",
            "password": PASSWORD,
            "account_type": "patient",
        },
    )

    response = await client.post(
        "/api/v1/auth/staff/login",
        json={"email": "patient@example.com", "password": PASSWORD},
    )

    assert response.status_code == 403


async def test_generic_staff_role_signs_in_publicly_not_at_the_staff_surface(
    client: AsyncClient,
    session_maker: async_sessionmaker[Any],
) -> None:
    email, password = await _create_user(session_maker, "staff")

    staff_surface = await client.post(
        "/api/v1/auth/staff/login",
        json={"email": email, "password": password},
    )
    assert staff_surface.status_code == 403

    public_surface = await client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": password},
    )
    assert public_surface.status_code == 200


async def test_staff_me_accepts_a_staff_token(
    client: AsyncClient,
    session_maker: async_sessionmaker[Any],
) -> None:
    email, password = await _create_user(session_maker, "super_admin")
    login = await client.post(
        "/api/v1/auth/staff/login",
        json={"email": email, "password": password},
    )
    token = login.json()["access_token"]

    response = await client.get(
        "/api/v1/auth/staff/me",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 200
    assert response.json()["role"] == "super_admin"


async def test_staff_me_refuses_a_public_token(
    client: AsyncClient,
    session_maker: async_sessionmaker[Any],
) -> None:
    # An admin has the role, but a token minted at the public surface must not
    # open a staff route: the scope claim decides, not the stored role.
    email, password = await _create_user(session_maker, "admin")
    login = await client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": password},
    )
    token = login.json()["access_token"]

    response = await client.get(
        "/api/v1/auth/staff/me",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 403


async def test_staff_me_rejects_an_invalid_token(client: AsyncClient) -> None:
    response = await client.get(
        "/api/v1/auth/staff/me",
        headers={"Authorization": "Bearer not-a-real-token"},
    )

    assert response.status_code == 401


async def test_signup_cannot_self_assign_a_staff_role(client: AsyncClient) -> None:
    response = await client.post(
        "/api/v1/auth/register",
        json={
            "full_name": "Would-be Admin",
            "email": "sneaky@example.com",
            "password": PASSWORD,
            "account_type": "admin",
        },
    )

    assert response.status_code == 422


async def test_staff_login_ignores_a_role_supplied_in_the_body(
    client: AsyncClient,
    session_maker: async_sessionmaker[Any],
) -> None:
    email, password = await _create_user(session_maker, "patient")

    response = await client.post(
        "/api/v1/auth/staff/login",
        json={"email": email, "password": password, "role": "admin"},
    )

    assert response.status_code == 403
