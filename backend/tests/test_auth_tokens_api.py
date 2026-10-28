"""HTTP-level tests for how every authenticated route treats a bearer token.

One gate (``app/dependencies.py``) decides who is calling: a token only works
on the surface it was minted for (ADR-0004), its issuer must agree with its
scope, and a deactivated account's still-unexpired token stops working.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta

import jwt
from httpx import AsyncClient

from app.logic.v1.auth import STAFF_SCOPE, create_access_token, hash_password
from app.repositories.user import User
from app.utils.state import AppState

PASSWORD_HASH = hash_password("correct horse battery staple")


async def _make_user(state: AppState, *, role: str, is_active: bool = True) -> User:
    async with state.db_session_maker() as session:
        user = User(
            full_name=f"Account {role}",
            email=f"{role}-{uuid.uuid4().hex[:8]}@example.com",
            role=role,
            password_hash=PASSWORD_HASH,
            is_active=is_active,
            account_status="active",
        )
        session.add(user)
        await session.commit()
        await session.refresh(user)
        return user


def _bearer(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _forged_token(state: AppState, user: User, *, scope: str, issuer: str) -> str:
    """A correctly signed token whose scope and issuer disagree."""
    now = datetime.now(UTC)
    return jwt.encode(
        {
            "sub": user.id,
            "role": user.role,
            "scope": scope,
            "iss": issuer,
            "iat": int(now.timestamp()),
            "exp": int((now + timedelta(minutes=5)).timestamp()),
        },
        state.settings.jwt_secret_key,
        algorithm=state.settings.jwt_algorithm,
    )


async def test_a_staff_token_is_refused_on_a_public_route(
    client: AsyncClient,
    state: AppState,
) -> None:
    admin = await _make_user(state, role="admin")
    staff_token = create_access_token(state, admin.id, admin.role, scope=STAFF_SCOPE)

    response = await client.get("/api/v1/auth/me", headers=_bearer(staff_token))

    assert response.status_code == 403


async def test_a_public_token_is_refused_on_a_staff_route(
    client: AsyncClient,
    state: AppState,
) -> None:
    admin = await _make_user(state, role="admin")
    public_token = create_access_token(state, admin.id, admin.role)

    response = await client.get("/api/v1/auth/staff/me", headers=_bearer(public_token))

    assert response.status_code == 403


async def test_a_staff_scoped_token_with_the_public_issuer_is_refused(
    client: AsyncClient,
    state: AppState,
) -> None:
    admin = await _make_user(state, role="admin")
    token = _forged_token(state, admin, scope="staff", issuer="denthub-public")

    response = await client.get("/api/v1/admin/countries", headers=_bearer(token))

    assert response.status_code == 401


async def test_a_public_scoped_token_with_the_staff_issuer_is_refused(
    client: AsyncClient,
    state: AppState,
) -> None:
    patient = await _make_user(state, role="patient")
    token = _forged_token(state, patient, scope="public", issuer="denthub-staff")

    response = await client.get("/api/v1/appointments", headers=_bearer(token))

    assert response.status_code == 401


async def test_a_deactivated_accounts_token_stops_working(
    client: AsyncClient,
    state: AppState,
) -> None:
    patient = await _make_user(state, role="patient", is_active=False)
    token = create_access_token(state, patient.id, patient.role)

    response = await client.post(
        "/api/v1/messages/conversations",
        headers=_bearer(token),
        json={"recipient_id": str(uuid.uuid4()), "body": "Hello"},
    )

    assert response.status_code == 403
