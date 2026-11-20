"""Admin user search and suspension (#125)."""

from __future__ import annotations

import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy import select

from app.logic.v1.auth import STAFF_SCOPE, create_access_token, hash_password
from app.repositories.user import User
from app.utils.state import AppState

PASSWORD = "correct horse battery staple"
PASSWORD_HASH = hash_password(PASSWORD)
BASE = "/api/v1/admin/users"


async def _make_user(
    state: AppState,
    *,
    role: str = "patient",
    email: str | None = None,
    full_name: str = "Searchable Target",
    account_status: str = "active",
) -> User:
    async with state.db_session_maker() as session:
        user = User(
            full_name=full_name,
            email=email or f"target-{uuid.uuid4().hex[:8]}@example.com",
            role=role,
            password_hash=PASSWORD_HASH,
            is_active=True,
            account_status=account_status,
        )
        session.add(user)
        await session.commit()
        await session.refresh(user)
        return user


def _staff_headers(state: AppState, user: User) -> dict[str, str]:
    return {
        "Authorization": f"Bearer {create_access_token(state, user.id, user.role, scope=STAFF_SCOPE)}"
    }


def _public_headers(state: AppState, user: User) -> dict[str, str]:
    return {"Authorization": f"Bearer {create_access_token(state, user.id, user.role)}"}


async def test_an_admin_searches_users_by_name_or_email(
    client: AsyncClient, state: AppState
) -> None:
    admin = await _make_user(state, role="admin", full_name="Platform Admin")
    target = await _make_user(state, full_name="Searchable Person", email="findme@example.com")

    response = await client.get(
        BASE, headers=_staff_headers(state, admin), params={"q": "searchable"}
    )

    assert response.status_code == 200, response.text
    ids = [row["id"] for row in response.json()["items"]]
    assert ids == [target.id]
    row = response.json()["items"][0]
    assert row["email"] == "findme@example.com"
    assert "profiles" in row and "memberships" in row

    by_email = await client.get(BASE, headers=_staff_headers(state, admin), params={"q": "FINDME"})
    assert [row["id"] for row in by_email.json()["items"]] == [target.id]


async def test_an_admin_reads_one_user(client: AsyncClient, state: AppState) -> None:
    admin = await _make_user(state, role="admin")
    target = await _make_user(state)

    response = await client.get(f"{BASE}/{target.id}", headers=_staff_headers(state, admin))

    assert response.status_code == 200, response.text
    assert response.json()["id"] == target.id
    assert response.json()["account_status"] == "active"

    missing = await client.get(f"{BASE}/unknown-id", headers=_staff_headers(state, admin))
    assert missing.status_code == 404


@pytest.mark.parametrize(
    "path", [BASE, f"{BASE}/some-id", f"{BASE}/some-id/suspend", f"{BASE}/some-id/reactivate"]
)
async def test_only_admin_staff_may_call_the_new_routes(
    client: AsyncClient, state: AppState, path: str
) -> None:
    admin = await _make_user(state, role="admin")
    patient = await _make_user(state, role="patient")
    operator = await _make_user(state, role="platform_operator")

    for headers in (
        {},
        _public_headers(state, admin),
        _public_headers(state, patient),
        _staff_headers(state, patient),
        _staff_headers(state, operator),
    ):
        write = path.endswith(("/suspend", "/reactivate"))
        response = (
            await client.post(path, headers=headers)
            if write
            else await client.get(path, headers=headers)
        )
        assert response.status_code in (401, 403)


async def test_suspension_signs_the_user_out_and_blocks_sign_in(
    client: AsyncClient, state: AppState
) -> None:
    admin = await _make_user(state, role="admin")
    target = await _make_user(state)
    sign_in = await client.post(
        "/api/v1/auth/login", json={"email": target.email, "password": PASSWORD}
    )
    assert sign_in.status_code == 200, sign_in.text

    suspended = await client.post(
        f"{BASE}/{target.id}/suspend", headers=_staff_headers(state, admin)
    )
    assert suspended.status_code == 200, suspended.text
    assert suspended.json()["account_status"] == "suspended"
    assert suspended.json()["is_active"] is False

    refresh = await client.post("/api/v1/auth/refresh")
    assert refresh.status_code == 401

    again = await client.post(
        "/api/v1/auth/login", json={"email": target.email, "password": PASSWORD}
    )
    assert again.status_code == 403

    audit = await client.get("/api/v1/admin/audit", headers=_staff_headers(state, admin))
    assert audit.json()["items"][0]["action"] == "user.suspend"


async def test_reactivation_restores_access(client: AsyncClient, state: AppState) -> None:
    admin = await _make_user(state, role="admin")
    target = await _make_user(state)
    headers = _staff_headers(state, admin)

    assert (await client.post(f"{BASE}/{target.id}/suspend", headers=headers)).status_code == 200

    restored = await client.post(f"{BASE}/{target.id}/reactivate", headers=headers)
    assert restored.status_code == 200, restored.text
    assert restored.json()["account_status"] == "active"
    assert restored.json()["is_active"] is True

    sign_in = await client.post(
        "/api/v1/auth/login", json={"email": target.email, "password": PASSWORD}
    )
    assert sign_in.status_code == 200, sign_in.text

    audit = await client.get("/api/v1/admin/audit", headers=headers)
    assert audit.json()["items"][0]["action"] == "user.reactivate"


async def test_an_admin_can_not_suspend_themselves(client: AsyncClient, state: AppState) -> None:
    admin = await _make_user(state, role="admin")

    response = await client.post(f"{BASE}/{admin.id}/suspend", headers=_staff_headers(state, admin))

    assert response.status_code == 400


async def test_a_super_admin_may_use_the_console(client: AsyncClient, state: AppState) -> None:
    super_admin = await _make_user(state, role="super_admin")
    target = await _make_user(state)
    headers = _staff_headers(state, super_admin)

    assert (await client.get(BASE, headers=headers)).status_code == 200
    suspended = await client.post(f"{BASE}/{target.id}/suspend", headers=headers)
    assert suspended.status_code == 200, suspended.text


async def test_the_last_active_super_admin_can_not_be_suspended(
    client: AsyncClient, state: AppState
) -> None:
    admin = await _make_user(state, role="admin")
    super_admin = await _make_user(state, role="super_admin")
    async with state.db_session_maker() as session:
        others = (
            (
                await session.execute(
                    select(User).where(
                        User.role == "super_admin",
                        User.is_active.is_(True),
                        User.id != super_admin.id,
                    )
                )
            )
            .scalars()
            .all()
        )
        for other in others:
            other.is_active = False
        await session.commit()

    response = await client.post(
        f"{BASE}/{super_admin.id}/suspend", headers=_staff_headers(state, admin)
    )

    assert response.status_code == 400
    assert "last active Super Admin" in response.json()["message"]


async def test_approval_refuses_a_suspended_user(client: AsyncClient, state: AppState) -> None:
    admin = await _make_user(state, role="admin")
    target = await _make_user(state, account_status="pending")
    headers = _staff_headers(state, admin)

    assert (await client.post(f"{BASE}/{target.id}/suspend", headers=headers)).status_code == 200

    approved = await client.post(f"/api/v1/users/{target.id}/approve", headers=headers)

    assert approved.status_code == 400
