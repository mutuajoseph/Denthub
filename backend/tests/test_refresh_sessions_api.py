"""HTTP tests for short-lived access tokens and the rotating refresh cookie.

ADR-0003's follow-up (#121): sign-in returns a 15-minute access token and sets a
refresh token in an httpOnly cookie. Refreshing rotates it, replaying a rotated
token ends the whole family, logout ends it, and the staff and public surfaces
never accept each other's cookie.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

import jwt
from httpx import AsyncClient
from sqlalchemy import update
from sqlalchemy.ext.asyncio import async_sessionmaker

from app.logic.v1.auth import (
    ACCESS_TOKEN_TTL,
    PUBLIC_REFRESH_COOKIE,
    PUBLIC_SCOPE,
    STAFF_REFRESH_COOKIE,
    STAFF_SCOPE,
    hash_password,
)
from app.repositories.refresh_token import RefreshToken
from app.repositories.user import UserRepository
from app.utils.state import AppState

PASSWORD = "correct horse battery staple"
PUBLIC_REFRESH = f"/api/v1/auth/refresh"
STAFF_REFRESH = "/api/v1/auth/staff/refresh"


async def _create_user(session_maker: async_sessionmaker[Any], role: str = "patient") -> str:
    """A user with a known password; returns the email."""
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
    return email


async def _login(
    client: AsyncClient,
    session_maker: async_sessionmaker[Any],
    *,
    role: str = "patient",
    staff: bool = False,
) -> dict[str, Any]:
    """Sign in and return the body; the client keeps the refresh cookie."""
    email = await _create_user(session_maker, role)
    path = "/api/v1/auth/staff/login" if staff else "/api/v1/auth/login"
    response = await client.post(path, json={"email": email, "password": PASSWORD})
    assert response.status_code == 200
    body: dict[str, Any] = response.json()
    return body


def _present(client: AsyncClient, name: str, value: str) -> None:
    """Replace the client's jar with exactly one cookie, as a browser would send."""
    client.cookies.clear()
    client.cookies.set(name, value)


def _token_minutes(state: AppState, token: str) -> float:
    payload = jwt.decode(
        token,
        state.settings.jwt_secret_key,
        algorithms=[state.settings.jwt_algorithm],
    )
    return (payload["exp"] - payload["iat"]) / 60


# --- Sign-in -----------------------------------------------------------------


async def test_login_sets_an_http_only_cookie_and_a_short_lived_access_token(
    client: AsyncClient,
    state: AppState,
    session_maker: async_sessionmaker[Any],
) -> None:
    email = await _create_user(session_maker)

    response = await client.post(
        "/api/v1/auth/login", json={"email": email, "password": PASSWORD}
    )

    assert response.status_code == 200
    body = response.json()

    # The access token lasts ACCESS_TOKEN_TTL and is the only credential in the
    # body: the refresh token is never reflected back as JSON.
    assert _token_minutes(state, body["access_token"]) == ACCESS_TOKEN_TTL.total_seconds() / 60
    assert PUBLIC_REFRESH_COOKIE not in body

    cookie = response.cookies.get(PUBLIC_REFRESH_COOKIE)
    assert cookie

    header = response.headers["set-cookie"]
    assert "HttpOnly" in header
    assert "Path=/api/v1/auth" in header
    assert "samesite=lax" in header.lower()


async def test_signup_also_starts_a_session(
    client: AsyncClient,
    state: AppState,
) -> None:
    response = await client.post(
        "/api/v1/auth/register",
        json={
            "full_name": "New Patient",
            "email": f"signup-{uuid.uuid4().hex[:8]}@example.com",
            "password": PASSWORD,
            "account_type": "patient",
        },
    )

    assert response.status_code == 200
    assert response.cookies.get(PUBLIC_REFRESH_COOKIE)


async def test_the_access_token_it_returns_is_accepted(
    client: AsyncClient,
    session_maker: async_sessionmaker[Any],
) -> None:
    body = await _login(client, session_maker)

    response = await client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {body['access_token']}"},
    )

    assert response.status_code == 200
    assert response.json()["email"] == body["user"]["email"]


# --- Rotation ----------------------------------------------------------------


async def test_refresh_rotates_the_cookie_and_returns_a_new_access_token(
    client: AsyncClient,
    session_maker: async_sessionmaker[Any],
) -> None:
    await _login(client, session_maker)
    original = client.cookies.get(PUBLIC_REFRESH_COOKIE)

    response = await client.post(PUBLIC_REFRESH)

    assert response.status_code == 200
    rotated = client.cookies.get(PUBLIC_REFRESH_COOKIE)
    assert rotated and rotated != original

    me = await client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {response.json()['access_token']}"},
    )
    assert me.status_code == 200


async def test_replaying_a_rotated_token_ends_the_whole_family(
    client: AsyncClient,
    session_maker: async_sessionmaker[Any],
) -> None:
    await _login(client, session_maker)
    stale = client.cookies.get(PUBLIC_REFRESH_COOKIE)

    rotated = await client.post(PUBLIC_REFRESH)
    assert rotated.status_code == 200
    current = client.cookies.get(PUBLIC_REFRESH_COOKIE)

    # Replay the spent token: this is the theft signal.
    _present(client, PUBLIC_REFRESH_COOKIE, stale)
    replay = await client.post(PUBLIC_REFRESH)
    assert replay.status_code == 401

    # And the token the thief did not get is dead too.
    _present(client, PUBLIC_REFRESH_COOKIE, current)
    after = await client.post(PUBLIC_REFRESH)
    assert after.status_code == 401


async def test_an_expired_refresh_token_is_refused(
    client: AsyncClient,
    session_maker: async_sessionmaker[Any],
) -> None:
    await _login(client, session_maker)
    cookie = client.cookies.get(PUBLIC_REFRESH_COOKIE)
    assert cookie

    payload = jwt.decode(cookie, options={"verify_signature": False})
    async with session_maker() as session:
        await session.execute(
            update(RefreshToken)
            .where(RefreshToken.jti == payload["jti"])
            .values(expires_at=datetime.now(UTC).replace(tzinfo=None) - timedelta(minutes=1))
        )
        await session.commit()

    response = await client.post(PUBLIC_REFRESH)

    assert response.status_code == 401


async def test_refresh_without_a_cookie_is_refused(client: AsyncClient) -> None:
    response = await client.post(PUBLIC_REFRESH)

    assert response.status_code == 401
    assert response.json()["message"] == "No refresh token was presented"


# --- Surfaces ----------------------------------------------------------------


async def test_the_surfaces_do_not_accept_each_others_cookie(
    client: AsyncClient,
    session_maker: async_sessionmaker[Any],
) -> None:
    await _login(client, session_maker, role="admin", staff=True)
    staff_cookie = client.cookies.get(STAFF_REFRESH_COOKIE)
    assert staff_cookie
    # The staff sign-in set only the staff cookie.
    assert client.cookies.get(PUBLIC_REFRESH_COOKIE) is None

    # A valid token for the wrong surface is a 403, like an access token would
    # be; it is not a 401 about a bad token.
    _present(client, PUBLIC_REFRESH_COOKIE, staff_cookie)
    crossed = await client.post(PUBLIC_REFRESH)
    assert crossed.status_code == 403

    client.cookies.clear()
    await _login(client, session_maker)
    public_cookie = client.cookies.get(PUBLIC_REFRESH_COOKIE)
    assert public_cookie

    _present(client, STAFF_REFRESH_COOKIE, public_cookie)
    other_way = await client.post(STAFF_REFRESH)
    assert other_way.status_code == 403


# --- Logout ------------------------------------------------------------------


async def test_logout_revokes_the_session_and_clears_the_cookie(
    client: AsyncClient,
    session_maker: async_sessionmaker[Any],
) -> None:
    await _login(client, session_maker)
    cookie = client.cookies.get(PUBLIC_REFRESH_COOKIE)
    assert cookie

    response = await client.post("/api/v1/auth/logout")

    assert response.status_code == 204
    assert response.headers["set-cookie"].lower().startswith(f"{PUBLIC_REFRESH_COOKIE}=")
    assert "max-age=0" in response.headers["set-cookie"].lower()

    _present(client, PUBLIC_REFRESH_COOKIE, cookie)
    replay = await client.post(PUBLIC_REFRESH)
    assert replay.status_code == 401


async def test_staff_logout_ends_only_the_staff_session(
    client: AsyncClient,
    session_maker: async_sessionmaker[Any],
) -> None:
    await _login(client, session_maker, role="admin", staff=True)
    staff_cookie = client.cookies.get(STAFF_REFRESH_COOKIE)
    assert staff_cookie

    response = await client.post("/api/v1/auth/staff/logout")

    assert response.status_code == 204

    _present(client, STAFF_REFRESH_COOKIE, staff_cookie)
    replay = await client.post(STAFF_REFRESH)
    assert replay.status_code == 401


def test_the_two_surfaces_use_separate_scopes() -> None:
    assert PUBLIC_SCOPE != STAFF_SCOPE
    assert PUBLIC_REFRESH_COOKIE != STAFF_REFRESH_COOKIE
