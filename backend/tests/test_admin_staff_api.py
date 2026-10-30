"""HTTP-level tests for Super Admin managing Platform Staff (#122).

Only a ``super_admin`` may list, create, or change Platform Staff. The role is
granted by the server: a request names the role it wants, but no caller can
promote themselves, and an Operator without both a Division and a tier is
refused. Every change writes an audit row with the before and after state.
"""

from __future__ import annotations

import uuid
from typing import Any

from httpx import AsyncClient

from app.logic.v1.auth import STAFF_SCOPE, create_access_token, hash_password
from app.repositories.user import User
from app.utils.state import AppState

PASSWORD = "correct horse battery staple"
PASSWORD_HASH = hash_password(PASSWORD)


async def _make_user(
    state: AppState,
    *,
    role: str,
    email: str | None = None,
    operator_division: str | None = None,
    operator_tier: str | None = None,
    is_active: bool = True,
) -> User:
    async with state.db_session_maker() as session:
        user = User(
            full_name=f"Account {role}",
            email=email or f"{role}-{uuid.uuid4().hex[:8]}@example.com",
            role=role,
            password_hash=PASSWORD_HASH,
            is_active=is_active,
            account_status="active",
            operator_division=operator_division,
            operator_tier=operator_tier,
        )
        session.add(user)
        await session.commit()
        await session.refresh(user)
        return user


def _staff_headers(state: AppState, user: User) -> dict[str, str]:
    token = create_access_token(state, user.id, user.role, scope=STAFF_SCOPE)
    return {"Authorization": f"Bearer {token}"}


def _staff_payload(**overrides: Any) -> dict[str, Any]:
    return {
        "full_name": "New Admin",
        "email": f"new-admin-{uuid.uuid4().hex[:8]}@example.com",
        "password": PASSWORD,
        "role": "admin",
        **overrides,
    }


async def _create_staff(
    client: AsyncClient,
    headers: dict[str, str],
    **overrides: Any,
) -> dict[str, Any]:
    response = await client.post(
        "/api/v1/admin/staff",
        headers=headers,
        json=_staff_payload(**overrides),
    )
    assert response.status_code == 200, response.text
    return response.json()


async def test_super_admin_creates_an_admin_who_can_sign_in(
    client: AsyncClient,
    state: AppState,
) -> None:
    super_admin = await _make_user(state, role="super_admin")
    headers = _staff_headers(state, super_admin)
    email = f"new-admin-{uuid.uuid4().hex[:8]}@example.com"

    created = await _create_staff(client, headers, email=email)

    assert created["role"] == "admin"
    assert created["email"] == email
    assert created["is_active"] is True
    assert created["operator_division"] is None
    assert created["operator_tier"] is None

    login = await client.post(
        "/api/v1/auth/staff/login",
        json={"email": email, "password": PASSWORD},
    )
    assert login.status_code == 200
    assert login.json()["user"]["role"] == "admin"

    audit = await client.get("/api/v1/admin/audit", headers=headers)
    entry = audit.json()["items"][0]
    assert entry["action"] == "staff.create"
    assert entry["entity_type"] == "staff"
    assert entry["entity_id"] == created["id"]
    assert entry["before"] is None
    assert entry["after"]["role"] == "admin"
    assert entry["after"]["email"] == email
    assert "password" not in entry["after"]


async def test_super_admin_lists_platform_staff_only(
    client: AsyncClient,
    state: AppState,
) -> None:
    super_admin = await _make_user(state, role="super_admin")
    admin = await _make_user(state, role="admin")
    operator = await _make_user(
        state,
        role="platform_operator",
        operator_division="jobs",
        operator_tier="lead",
    )
    patient = await _make_user(state, role="patient")

    response = await client.get(
        "/api/v1/admin/staff",
        headers=_staff_headers(state, super_admin),
    )

    assert response.status_code == 200
    ids = {item["id"] for item in response.json()["items"]}
    assert {super_admin.id, admin.id, operator.id} <= ids
    assert patient.id not in ids


async def test_an_admin_cannot_manage_platform_staff(
    client: AsyncClient,
    state: AppState,
) -> None:
    admin = await _make_user(state, role="admin")
    headers = _staff_headers(state, admin)
    target = await _make_user(state, role="admin")

    read = await client.get("/api/v1/admin/staff", headers=headers)
    create = await client.post("/api/v1/admin/staff", headers=headers, json=_staff_payload())
    update = await client.patch(
        f"/api/v1/admin/staff/{target.id}",
        headers=headers,
        json={"is_active": False},
    )

    assert read.status_code == 403
    assert create.status_code == 403
    assert update.status_code == 403


async def test_an_operator_cannot_manage_platform_staff(
    client: AsyncClient,
    state: AppState,
) -> None:
    operator = await _make_user(
        state,
        role="platform_operator",
        operator_division="jobs",
        operator_tier="lead",
    )

    response = await client.get(
        "/api/v1/admin/staff",
        headers=_staff_headers(state, operator),
    )

    assert response.status_code == 403


async def test_an_operator_needs_a_division_and_a_tier(
    client: AsyncClient,
    state: AppState,
) -> None:
    super_admin = await _make_user(state, role="super_admin")
    headers = _staff_headers(state, super_admin)

    missing_tier = await client.post(
        "/api/v1/admin/staff",
        headers=headers,
        json=_staff_payload(role="platform_operator", operator_division="jobs"),
    )
    missing_division = await client.post(
        "/api/v1/admin/staff",
        headers=headers,
        json=_staff_payload(role="platform_operator", operator_tier="lead"),
    )
    admin_with_division = await client.post(
        "/api/v1/admin/staff",
        headers=headers,
        json=_staff_payload(role="admin", operator_division="jobs", operator_tier="lead"),
    )
    complete = await client.post(
        "/api/v1/admin/staff",
        headers=headers,
        json=_staff_payload(
            role="platform_operator",
            operator_division="jobs",
            operator_tier="lead",
        ),
    )

    assert missing_tier.status_code == 422
    assert missing_division.status_code == 422
    assert admin_with_division.status_code == 422
    assert complete.status_code == 200
    assert complete.json()["operator_division"] == "jobs"
    assert complete.json()["operator_tier"] == "lead"


async def test_a_duplicate_email_is_refused(
    client: AsyncClient,
    state: AppState,
) -> None:
    super_admin = await _make_user(state, role="super_admin")
    headers = _staff_headers(state, super_admin)
    email = f"taken-{uuid.uuid4().hex[:8]}@example.com"
    await _create_staff(client, headers, email=email)

    response = await client.post(
        "/api/v1/admin/staff",
        headers=headers,
        json=_staff_payload(email=email),
    )

    assert response.status_code == 409


async def test_a_password_over_72_bytes_is_refused(
    client: AsyncClient,
    state: AppState,
) -> None:
    super_admin = await _make_user(state, role="super_admin")

    response = await client.post(
        "/api/v1/admin/staff",
        headers=_staff_headers(state, super_admin),
        json=_staff_payload(password="a" * 73),
    )

    assert response.status_code == 422


async def test_super_admin_changes_a_members_role_and_the_change_is_audited(
    client: AsyncClient,
    state: AppState,
) -> None:
    super_admin = await _make_user(state, role="super_admin")
    headers = _staff_headers(state, super_admin)
    created = await _create_staff(client, headers)

    response = await client.patch(
        f"/api/v1/admin/staff/{created['id']}",
        headers=headers,
        json={
            "role": "platform_operator",
            "operator_division": "jobs",
            "operator_tier": "lead",
        },
    )

    assert response.status_code == 200
    updated = response.json()
    assert updated["role"] == "platform_operator"
    assert updated["operator_division"] == "jobs"
    assert updated["operator_tier"] == "lead"

    audit = await client.get("/api/v1/admin/audit", headers=headers)
    entry = audit.json()["items"][0]
    assert entry["action"] == "staff.update"
    assert entry["entity_type"] == "staff"
    assert entry["entity_id"] == created["id"]
    assert entry["before"] == {
        "role": "admin",
        "operator_division": None,
        "operator_tier": None,
        "is_active": True,
    }
    assert entry["after"] == {
        "role": "platform_operator",
        "operator_division": "jobs",
        "operator_tier": "lead",
        "is_active": True,
    }


async def test_setting_an_operator_without_a_division_on_update_is_refused(
    client: AsyncClient,
    state: AppState,
) -> None:
    super_admin = await _make_user(state, role="super_admin")
    headers = _staff_headers(state, super_admin)
    created = await _create_staff(client, headers)

    response = await client.patch(
        f"/api/v1/admin/staff/{created['id']}",
        headers=headers,
        json={"role": "platform_operator"},
    )

    assert response.status_code == 400


async def test_demoting_takes_effect_on_the_next_request(
    client: AsyncClient,
    state: AppState,
) -> None:
    super_admin = await _make_user(state, role="super_admin")
    super_headers = _staff_headers(state, super_admin)
    created = await _create_staff(client, super_headers)
    member = await state_user(state, created["id"])
    member_headers = _staff_headers(state, member)

    before = await client.get("/api/v1/admin/countries", headers=member_headers)
    assert before.status_code == 200

    demote = await client.patch(
        f"/api/v1/admin/staff/{created['id']}",
        headers=super_headers,
        json={
            "role": "platform_operator",
            "operator_division": "jobs",
            "operator_tier": "lead",
        },
    )
    assert demote.status_code == 200

    after = await client.get("/api/v1/admin/countries", headers=member_headers)
    assert after.status_code == 403


async def test_deactivating_takes_effect_on_the_next_request(
    client: AsyncClient,
    state: AppState,
) -> None:
    super_admin = await _make_user(state, role="super_admin")
    super_headers = _staff_headers(state, super_admin)
    created = await _create_staff(client, super_headers)
    member = await state_user(state, created["id"])
    member_headers = _staff_headers(state, member)

    before = await client.get("/api/v1/admin/countries", headers=member_headers)
    assert before.status_code == 200

    deactivate = await client.patch(
        f"/api/v1/admin/staff/{created['id']}",
        headers=super_headers,
        json={"is_active": False},
    )
    assert deactivate.status_code == 200
    assert deactivate.json()["is_active"] is False

    after = await client.get("/api/v1/admin/countries", headers=member_headers)
    assert after.status_code == 403

    login = await client.post(
        "/api/v1/auth/staff/login",
        json={"email": created["email"], "password": PASSWORD},
    )
    assert login.status_code == 403


async def test_the_last_active_super_admin_cannot_demote_themselves(
    client: AsyncClient,
    state: AppState,
) -> None:
    super_admin = await _make_user(state, role="super_admin")

    response = await client.patch(
        f"/api/v1/admin/staff/{super_admin.id}",
        headers=_staff_headers(state, super_admin),
        json={"role": "admin"},
    )

    assert response.status_code == 400
    assert "last active Super Admin" in response.json()["message"]


async def test_the_last_active_super_admin_cannot_deactivate_themselves(
    client: AsyncClient,
    state: AppState,
) -> None:
    super_admin = await _make_user(state, role="super_admin")

    response = await client.patch(
        f"/api/v1/admin/staff/{super_admin.id}",
        headers=_staff_headers(state, super_admin),
        json={"is_active": False},
    )

    assert response.status_code == 400
    assert "last active Super Admin" in response.json()["message"]


async def test_a_super_admin_can_step_down_when_another_remains(
    client: AsyncClient,
    state: AppState,
) -> None:
    super_admin = await _make_user(state, role="super_admin")
    other_super_admin = await _make_user(state, role="super_admin")

    response = await client.patch(
        f"/api/v1/admin/staff/{super_admin.id}",
        headers=_staff_headers(state, super_admin),
        json={"is_active": False},
    )

    assert response.status_code == 200
    assert response.json()["is_active"] is False

    now_refused = await client.get(
        "/api/v1/admin/staff",
        headers=_staff_headers(state, super_admin),
    )
    still_allowed = await client.get(
        "/api/v1/admin/staff",
        headers=_staff_headers(state, other_super_admin),
    )
    assert now_refused.status_code == 403
    assert still_allowed.status_code == 200


async def test_a_no_op_update_writes_no_audit_row(
    client: AsyncClient,
    state: AppState,
) -> None:
    super_admin = await _make_user(state, role="super_admin")
    headers = _staff_headers(state, super_admin)
    created = await _create_staff(client, headers)

    response = await client.patch(
        f"/api/v1/admin/staff/{created['id']}",
        headers=headers,
        json={"is_active": True},
    )

    assert response.status_code == 200
    audit = await client.get("/api/v1/admin/audit", headers=headers)
    actions = [entry["action"] for entry in audit.json()["items"]]
    assert actions == ["staff.create"]


async def test_updating_an_unknown_staff_member_is_404(
    client: AsyncClient,
    state: AppState,
) -> None:
    super_admin = await _make_user(state, role="super_admin")

    response = await client.patch(
        f"/api/v1/admin/staff/{uuid.uuid4()}",
        headers=_staff_headers(state, super_admin),
        json={"is_active": False},
    )

    assert response.status_code == 404


async def state_user(state: AppState, user_id: str) -> User:
    """Reload a user through the session so tests hold the stored row."""
    async with state.db_session_maker() as session:
        user = await session.get(User, user_id)
        assert user is not None
        return user
