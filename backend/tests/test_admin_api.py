"""HTTP-level tests for the admin console (#82).

The console is a staff-surface feature: a public token is refused before the
stored role matters, and an Operator's staff token is refused because the console
belongs to ``admin`` and ``super_admin``. Every write is audited, and a flag or
tier write is only correct when the public read path sees it.
"""

from __future__ import annotations

import uuid

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
) -> User:
    async with state.db_session_maker() as session:
        user = User(
            full_name=f"Account {role}",
            email=email or f"{role}-{uuid.uuid4().hex[:8]}@example.com",
            role=role,
            password_hash=PASSWORD_HASH,
            is_active=True,
            account_status="active",
        )
        session.add(user)
        await session.commit()
        await session.refresh(user)
        return user


def _staff_headers(state: AppState, user: User) -> dict[str, str]:
    token = create_access_token(state, user.id, user.role, scope=STAFF_SCOPE)
    return {"Authorization": f"Bearer {token}"}


def _public_headers(state: AppState, user: User) -> dict[str, str]:
    token = create_access_token(state, user.id, user.role)
    return {"Authorization": f"Bearer {token}"}


async def _facility_id(client: AsyncClient, name: str) -> str:
    response = await client.get("/api/v1/facilities", params={"country": "KE"})
    for item in response.json()["items"]:
        if item["name"] == name:
            return str(item["id"])
    raise AssertionError(f"facility {name!r} not found")


async def _specialist_id(client: AsyncClient, name: str) -> str:
    response = await client.get("/api/v1/dentists", params={"country": "KE"})
    for item in response.json()["items"]:
        if item["name"] == name:
            return str(item["id"])
    raise AssertionError(f"specialist {name!r} not found")


async def test_admin_lists_countries_with_feature_flags(
    client: AsyncClient,
    state: AppState,
) -> None:
    admin = await _make_user(state, role="admin")

    response = await client.get("/api/v1/admin/countries", headers=_staff_headers(state, admin))

    assert response.status_code == 200
    countries = {item["code"]: item for item in response.json()["items"]}
    assert set(countries) == {"KE", "NG"}
    kenya = {flag["feature"]: flag for flag in countries["KE"]["features"]}
    assert kenya["DENTAL_INSURANCE"]["is_enabled"] is True
    assert kenya["DENTAL_INSURANCE"]["primary_scheme"] == "NHIF"
    nigeria = {flag["feature"]: flag for flag in countries["NG"]["features"]}
    assert nigeria["CPD_TRAINING"]["is_enabled"] is False

    # Admin replies must never enter a shared cache.
    assert "etag" not in response.headers
    assert "cache-control" not in response.headers


async def test_public_token_is_refused_even_for_an_admin_account(
    client: AsyncClient,
    state: AppState,
) -> None:
    admin = await _make_user(state, role="admin")

    response = await client.get(
        "/api/v1/admin/countries",
        headers=_public_headers(state, admin),
    )

    assert response.status_code == 403
    assert response.json()["code"] == 403


async def test_operator_staff_token_is_refused_by_the_admin_console(
    client: AsyncClient,
    state: AppState,
) -> None:
    operator = await _make_user(state, role="platform_operator")

    response = await client.get(
        "/api/v1/admin/countries",
        headers=_staff_headers(state, operator),
    )

    assert response.status_code == 403
    assert "Only admins" in response.json()["message"]


async def test_anonymous_request_is_refused(client: AsyncClient) -> None:
    response = await client.get("/api/v1/admin/countries")

    assert response.status_code in (401, 403)


async def test_feature_flag_write_reaches_the_public_country_config(
    client: AsyncClient,
    state: AppState,
) -> None:
    admin = await _make_user(state, role="admin")

    update = await client.patch(
        "/api/v1/admin/countries/KE/features/CPD_TRAINING",
        headers=_staff_headers(state, admin),
        json={"is_enabled": False, "primary_scheme": None},
    )
    assert update.status_code == 200
    assert update.json() == {
        "feature": "CPD_TRAINING",
        "is_enabled": False,
        "primary_scheme": None,
    }

    public = await client.get("/api/v1/config/country", params={"country": "KE"})
    flags = {flag["feature"]: flag for flag in public.json()["features"]}
    assert flags["CPD_TRAINING"]["is_enabled"] is False


async def test_a_new_flag_row_is_created_on_first_write(
    client: AsyncClient,
    state: AppState,
) -> None:
    admin = await _make_user(state, role="admin")

    response = await client.patch(
        "/api/v1/admin/countries/KE/features/TELECONSULTATION",
        headers=_staff_headers(state, admin),
        json={"is_enabled": True, "primary_scheme": None},
    )

    assert response.status_code == 200
    assert response.json()["feature"] == "TELECONSULTATION"
    assert response.json()["is_enabled"] is True

    public = await client.get("/api/v1/config/country", params={"country": "KE"})
    flags = {flag["feature"]: flag for flag in public.json()["features"]}
    assert flags["TELECONSULTATION"]["is_enabled"] is True


async def test_a_country_can_be_retired_and_restored(
    client: AsyncClient,
    state: AppState,
) -> None:
    admin = await _make_user(state, role="admin")
    headers = _staff_headers(state, admin)

    retired = await client.patch(
        "/api/v1/admin/countries/NG",
        headers=headers,
        json={"is_active": False},
    )
    assert retired.status_code == 200
    assert retired.json()["is_active"] is False

    public = await client.get("/api/v1/config/countries")
    assert "NG" not in {item["code"] for item in public.json()["items"]}

    admin_list = await client.get("/api/v1/admin/countries", headers=headers)
    nigeria = {item["code"]: item for item in admin_list.json()["items"]}["NG"]
    assert nigeria["is_active"] is False

    restored = await client.patch(
        "/api/v1/admin/countries/NG",
        headers=headers,
        json={"is_active": True},
    )
    assert restored.status_code == 200
    assert restored.json()["is_active"] is True


async def test_verification_tiers_reach_the_public_listings(
    client: AsyncClient,
    state: AppState,
) -> None:
    admin = await _make_user(state, role="admin")
    headers = _staff_headers(state, admin)

    facility_id = await _facility_id(client, "Nyali Coastal Dental")
    facility = await client.patch(
        f"/api/v1/admin/facilities/{facility_id}/verification-tier",
        headers=headers,
        json={"verification_tier": "featured"},
    )
    assert facility.status_code == 200
    assert facility.json()["verification_tier"] == "featured"
    assert facility.json()["entity_type"] == "facility"

    public_facility = await client.get(f"/api/v1/facilities/{facility_id}")
    assert public_facility.json()["verification_tier"] == "featured"

    specialist_id = await _specialist_id(client, "Dr. Amina Otieno")
    specialist = await client.patch(
        f"/api/v1/admin/specialists/{specialist_id}/verification-tier",
        headers=headers,
        json={"verification_tier": "verified"},
    )
    assert specialist.status_code == 200
    assert specialist.json()["verification_tier"] == "verified"
    assert specialist.json()["entity_type"] == "specialist"

    public_specialist = await client.get(f"/api/v1/dentists/{specialist_id}")
    assert public_specialist.json()["listing"]["verification_tier"] == "verified"


async def test_verification_rejects_an_unknown_entity(
    client: AsyncClient,
    state: AppState,
) -> None:
    admin = await _make_user(state, role="admin")

    response = await client.patch(
        "/api/v1/admin/specialists/does-not-exist/verification-tier",
        headers=_staff_headers(state, admin),
        json={"verification_tier": "basic"},
    )

    assert response.status_code == 404


async def test_moderation_hides_and_restores_a_magazine_item(
    client: AsyncClient,
    state: AppState,
) -> None:
    admin = await _make_user(state, role="admin")
    headers = _staff_headers(state, admin)

    articles = await client.get("/api/v1/magazine/articles", params={"country": "KE"})
    article = articles.json()["items"][0]

    hidden = await client.patch(
        f"/api/v1/admin/moderation/magazine/{article['id']}",
        headers=headers,
        json={"status": "hidden"},
    )
    assert hidden.status_code == 200
    assert hidden.json()["status"] == "hidden"

    gone = await client.get(f"/api/v1/magazine/articles/{article['slug']}")
    assert gone.status_code == 404

    restored = await client.patch(
        f"/api/v1/admin/moderation/magazine/{article['id']}",
        headers=headers,
        json={"status": "published"},
    )
    assert restored.status_code == 200
    assert restored.json()["status"] == "published"

    back = await client.get(f"/api/v1/magazine/articles/{article['slug']}")
    assert back.status_code == 200


async def test_moderation_hides_and_restores_a_job_posting(
    client: AsyncClient,
    state: AppState,
) -> None:
    admin = await _make_user(state, role="admin")
    headers = _staff_headers(state, admin)

    jobs = await client.get("/api/v1/jobs", params={"country": "KE"})
    posting = jobs.json()["items"][0]

    hidden = await client.patch(
        f"/api/v1/admin/moderation/jobs/{posting['id']}",
        headers=headers,
        json={"status": "hidden"},
    )
    assert hidden.status_code == 200
    assert hidden.json()["status"] == "hidden"

    gone = await client.get(f"/api/v1/jobs/{posting['id']}")
    assert gone.status_code == 404

    restored = await client.patch(
        f"/api/v1/admin/moderation/jobs/{posting['id']}",
        headers=headers,
        json={"status": "published"},
    )
    assert restored.status_code == 200
    assert restored.json()["status"] == "published"


async def test_writes_are_audited_with_the_actor_and_the_change(
    client: AsyncClient,
    state: AppState,
) -> None:
    admin = await _make_user(state, role="super_admin", email="root@denthub.test")
    headers = _staff_headers(state, admin)

    await client.patch(
        "/api/v1/admin/countries/KE/features/ORAL_CARE_SHOP",
        headers=headers,
        json={"is_enabled": False, "primary_scheme": None},
    )

    audit = await client.get("/api/v1/admin/audit", headers=headers)

    assert audit.status_code == 200
    entry = audit.json()["items"][0]
    assert entry["actor_email"] == "root@denthub.test"
    assert entry["actor_role"] == "super_admin"
    assert entry["action"] == "country.feature.update"
    assert entry["entity_type"] == "country_feature"
    assert entry["entity_id"] == "KE:ORAL_CARE_SHOP"
    assert entry["before"] == {"is_enabled": True, "primary_scheme": None}
    assert entry["after"] == {"is_enabled": False, "primary_scheme": None}

    # A refused caller never writes an audit row.
    operator = await _make_user(state, role="platform_operator")
    refused = await client.patch(
        "/api/v1/admin/countries/KE/features/JOBS_BOARD",
        headers=_staff_headers(state, operator),
        json={"is_enabled": False, "primary_scheme": None},
    )
    assert refused.status_code == 403

    audit_after = await client.get("/api/v1/admin/audit", headers=headers)
    assert len(audit_after.json()["items"]) == len(audit.json()["items"])


async def test_verification_writes_are_audited(
    client: AsyncClient,
    state: AppState,
) -> None:
    admin = await _make_user(state, role="admin")
    headers = _staff_headers(state, admin)
    facility_id = await _facility_id(client, "Smile Point Dental")

    await client.patch(
        f"/api/v1/admin/facilities/{facility_id}/verification-tier",
        headers=headers,
        json={"verification_tier": "featured"},
    )

    audit = await client.get("/api/v1/admin/audit", headers=headers)
    entry = audit.json()["items"][0]
    assert entry["action"] == "verification.set"
    assert entry["entity_type"] == "facility"
    assert entry["entity_id"] == facility_id
    assert entry["before"] == {"verification_tier": "verified"}
    assert entry["after"] == {"verification_tier": "featured"}
