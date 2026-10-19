"""HTTP-level tests for the operations console (#83).

The console is a staff-surface feature scoped to one Division: a public token is
refused before the role matters, an Admin's staff token is refused because the
console belongs to the Operator role, and an Operator whose token is fine but
whose row has no Division assigned is refused too. Division isolation and the
Lead/Assistant tier limit are both server-side, so they are asserted against
the HTTP boundary rather than the UI.
"""

from __future__ import annotations

import uuid

from httpx import AsyncClient

from app.logic.v1.auth import STAFF_SCOPE, create_access_token, hash_password
from app.repositories.admin import AdminAuditRepository
from app.repositories.user import User
from app.utils.state import AppState

PASSWORD = "correct horse battery staple"
PASSWORD_HASH = hash_password(PASSWORD)


async def _make_user(
    state: AppState,
    *,
    role: str,
    email: str | None = None,
    division: str | None = None,
    tier: str | None = None,
) -> User:
    async with state.db_session_maker() as session:
        user = User(
            full_name=f"Account {role}",
            email=email or f"{role}-{uuid.uuid4().hex[:8]}@example.com",
            role=role,
            password_hash=PASSWORD_HASH,
            is_active=True,
            account_status="active",
            operator_division=division,
            operator_tier=tier,
        )
        session.add(user)
        await session.commit()
        await session.refresh(user)
        return user


async def _make_operator(
    state: AppState,
    *,
    division: str = "jobs",
    tier: str = "lead",
) -> User:
    return await _make_user(state, role="platform_operator", division=division, tier=tier)


def _staff_headers(state: AppState, user: User) -> dict[str, str]:
    token = create_access_token(state, user.id, user.role, scope=STAFF_SCOPE)
    return {"Authorization": f"Bearer {token}"}


def _public_headers(state: AppState, user: User) -> dict[str, str]:
    token = create_access_token(state, user.id, user.role)
    return {"Authorization": f"Bearer {token}"}


async def _first_job_id(client: AsyncClient, headers: dict[str, str]) -> str:
    response = await client.get("/api/v1/operations/jobs", headers=headers)
    assert response.status_code == 200
    items = response.json()["items"]
    assert items, "the fixture seeds at least one Job posting"
    return str(items[0]["id"])


async def test_overview_reports_the_operators_division_and_tier(
    client: AsyncClient,
    state: AppState,
) -> None:
    lead = await _make_operator(state, division="jobs", tier="lead")

    response = await client.get(
        "/api/v1/operations/overview",
        headers=_staff_headers(state, lead),
    )

    assert response.status_code == 200
    assert response.json() == {"division": "jobs", "tier": "lead", "can_write": True}
    # Operator replies must never enter a shared cache.
    assert "etag" not in response.headers
    assert "cache-control" not in response.headers


async def test_an_assistant_reads_but_may_not_write(
    client: AsyncClient,
    state: AppState,
) -> None:
    assistant = await _make_operator(state, division="jobs", tier="assistant")
    headers = _staff_headers(state, assistant)

    overview = await client.get("/api/v1/operations/overview", headers=headers)
    assert overview.status_code == 200
    assert overview.json()["can_write"] is False

    posting_id = await _first_job_id(client, headers)
    write = await client.patch(
        f"/api/v1/operations/jobs/{posting_id}",
        headers=headers,
        json={"status": "hidden"},
    )
    assert write.status_code == 403


async def test_a_lead_hides_a_posting_and_the_public_board_drops_it(
    client: AsyncClient,
    state: AppState,
) -> None:
    lead = await _make_operator(state, division="jobs", tier="lead")
    headers = _staff_headers(state, lead)

    published = await client.get("/api/v1/jobs", params={"country": "KE"})
    posting_id = published.json()["items"][0]["id"]

    moderation = await client.get("/api/v1/operations/jobs", headers=headers)
    assert posting_id in {item["id"] for item in moderation.json()["items"]}

    response = await client.patch(
        f"/api/v1/operations/jobs/{posting_id}",
        headers=headers,
        json={"status": "hidden"},
    )

    assert response.status_code == 200
    assert response.json()["status"] == "hidden"

    async with state.db_session_maker() as session:
        rows = await AdminAuditRepository.list_recent(session, limit=1)

    assert rows[0].actor_id == lead.id
    assert rows[0].actor_role == "platform_operator"
    assert rows[0].action == "moderation.status"
    assert rows[0].entity_type == "job"
    assert rows[0].entity_id == posting_id
    assert rows[0].before == {"status": "published"}
    assert rows[0].after == {"status": "hidden"}

    unpublished = await client.get("/api/v1/jobs", params={"country": "KE"})
    assert posting_id not in {item["id"] for item in unpublished.json()["items"]}

    restored = await client.patch(
        f"/api/v1/operations/jobs/{posting_id}",
        headers=headers,
        json={"status": "published"},
    )
    assert restored.status_code == 200
    assert restored.json()["status"] == "published"


async def test_an_operator_in_another_division_is_refused(
    client: AsyncClient,
    state: AppState,
) -> None:
    shop = await _make_operator(state, division="shop", tier="lead")
    headers = _staff_headers(state, shop)

    read = await client.get("/api/v1/operations/jobs", headers=headers)
    assert read.status_code == 403

    jobs_lead = await _make_operator(state, division="jobs", tier="lead")
    posting_id = await _first_job_id(client, _staff_headers(state, jobs_lead))

    write = await client.patch(
        f"/api/v1/operations/jobs/{posting_id}",
        headers=headers,
        json={"status": "hidden"},
    )
    assert write.status_code == 403


async def test_a_public_token_is_refused_even_for_an_operator_account(
    client: AsyncClient,
    state: AppState,
) -> None:
    operator = await _make_operator(state)

    response = await client.get(
        "/api/v1/operations/overview",
        headers=_public_headers(state, operator),
    )

    assert response.status_code == 403


async def test_an_admin_staff_token_is_refused(
    client: AsyncClient,
    state: AppState,
) -> None:
    admin = await _make_user(state, role="admin")

    response = await client.get(
        "/api/v1/operations/overview",
        headers=_staff_headers(state, admin),
    )

    assert response.status_code == 403


async def test_an_operator_without_a_division_is_refused(
    client: AsyncClient,
    state: AppState,
) -> None:
    operator = await _make_user(state, role="platform_operator")

    response = await client.get(
        "/api/v1/operations/overview",
        headers=_staff_headers(state, operator),
    )

    assert response.status_code == 403


async def test_anonymous_is_unauthorized(client: AsyncClient) -> None:
    response = await client.get("/api/v1/operations/overview")

    assert response.status_code == 401


async def test_hiding_an_unknown_posting_is_404(
    client: AsyncClient,
    state: AppState,
) -> None:
    lead = await _make_operator(state)

    response = await client.patch(
        f"/api/v1/operations/jobs/{uuid.uuid4()}",
        headers=_staff_headers(state, lead),
        json={"status": "hidden"},
    )

    assert response.status_code == 404
