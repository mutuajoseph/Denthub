"""Reference-data API tests (issue #127).

These lists are what Branch Services, insurance filters, and region dropdowns
read, so the tests assert the contract the admin console edits and the public
catalogue sees, not just that a row was written.

Deletion is a soft delete: a retired row leaves every public list but stays in
the admin list (and on historic rows), which is why the tests assert both sides.
"""

from __future__ import annotations

import uuid

from httpx import AsyncClient

from app.logic.v1.auth import STAFF_SCOPE, create_access_token, hash_password
from app.repositories.user import User
from app.utils.state import AppState

BASE = "/api/v1"
PASSWORD = "correct horse battery staple"
PASSWORD_HASH = hash_password(PASSWORD)


async def _make_admin(state: AppState) -> User:
    async with state.db_session_maker() as session:
        user = User(
            full_name="Reference Admin",
            email=f"admin-{uuid.uuid4().hex[:8]}@example.com",
            role="admin",
            password_hash=PASSWORD_HASH,
            is_active=True,
            account_status="active",
        )
        session.add(user)
        await session.commit()
        await session.refresh(user)
        return user


async def _make_operator(state: AppState) -> User:
    async with state.db_session_maker() as session:
        user = User(
            full_name="Reference Operator",
            email=f"operator-{uuid.uuid4().hex[:8]}@example.com",
            role="platform_operator",
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


# --- Public lists -----------------------------------------------------------


async def test_treatments_are_public_and_in_display_order(client: AsyncClient) -> None:
    response = await client.get(f"{BASE}/config/treatments")

    assert response.status_code == 200
    items = response.json()["items"]
    assert [row["code"] for row in items] == [
        "consultation",
        "scale-and-polish",
        "dental-crown",
    ]
    assert items[0]["description"] == "An examination and treatment plan."


async def test_insurance_providers_respect_accept_country(client: AsyncClient) -> None:
    kenya = await client.get(
        f"{BASE}/config/country/insurance-providers",
        headers={"Accept-Country": "KE"},
    )
    nigeria = await client.get(
        f"{BASE}/config/country/insurance-providers",
        headers={"Accept-Country": "NG"},
    )

    assert kenya.status_code == 200
    assert kenya.json()["country_code"] == "KE"
    assert [row["name"] for row in kenya.json()["items"]] == ["Britam", "NHIF"]

    assert [row["name"] for row in nigeria.json()["items"]] == ["NHIS"]


async def test_insurance_providers_query_overrides_accept_country(client: AsyncClient) -> None:
    response = await client.get(
        f"{BASE}/config/country/insurance-providers",
        params={"country": "NG"},
        headers={"Accept-Country": "KE"},
    )

    assert response.json()["country_code"] == "NG"
    assert [row["name"] for row in response.json()["items"]] == ["NHIS"]


async def test_insurance_providers_for_unknown_country_is_empty(client: AsyncClient) -> None:
    response = await client.get(
        f"{BASE}/config/country/insurance-providers",
        params={"country": "ZZ"},
    )

    assert response.status_code == 200
    assert response.json() == {"country_code": "ZZ", "items": []}


# --- Authorization ----------------------------------------------------------


async def test_reference_writes_require_a_staff_admin(
    client: AsyncClient,
    state: AppState,
) -> None:
    operator = await _make_operator(state)

    response = await client.post(
        f"{BASE}/admin/treatments",
        headers=_staff_headers(state, operator),
        json={"code": "night-guard", "name": "Night Guard"},
    )

    assert response.status_code == 403
    assert response.json()["code"] == 403


# --- Treatments -------------------------------------------------------------


async def test_admin_creates_updates_and_retires_a_treatment(
    client: AsyncClient,
    state: AppState,
) -> None:
    headers = _staff_headers(state, await _make_admin(state))

    created = await client.post(
        f"{BASE}/admin/treatments",
        headers=headers,
        json={
            "code": "night-guard",
            "name": "Night Guard",
            "description": "A custom guard for jaw clenching.",
            "display_order": 5,
        },
    )
    assert created.status_code == 201
    treatment = created.json()
    assert treatment["code"] == "night-guard"
    assert treatment["is_active"] is True

    public = await client.get(f"{BASE}/config/treatments")
    assert [row["code"] for row in public.json()["items"]][0] == "night-guard"

    updated = await client.patch(
        f"{BASE}/admin/treatments/{treatment['id']}",
        headers=headers,
        json={
            "name": "Custom Night Guard",
            "description": "A custom guard for jaw clenching.",
            "display_order": 5,
        },
    )
    assert updated.status_code == 200
    assert updated.json()["name"] == "Custom Night Guard"

    public = await client.get(f"{BASE}/config/treatments")
    names = {row["code"]: row["name"] for row in public.json()["items"]}
    assert names["night-guard"] == "Custom Night Guard"

    retired = await client.delete(f"{BASE}/admin/treatments/{treatment['id']}", headers=headers)
    assert retired.status_code == 204

    public = await client.get(f"{BASE}/config/treatments")
    assert "night-guard" not in {row["code"] for row in public.json()["items"]}

    admin_list = await client.get(f"{BASE}/admin/treatments", headers=headers)
    retired_row = next(
        row for row in admin_list.json()["items"] if row["id"] == treatment["id"]
    )
    assert retired_row["is_active"] is False

    restored = await client.patch(
        f"{BASE}/admin/treatments/{treatment['id']}",
        headers=headers,
        json={
            "name": "Custom Night Guard",
            "description": "A custom guard for jaw clenching.",
            "display_order": 5,
            "is_active": True,
        },
    )
    assert restored.status_code == 200

    public = await client.get(f"{BASE}/config/treatments")
    assert "night-guard" in {row["code"] for row in public.json()["items"]}


async def test_duplicate_treatment_code_is_refused(
    client: AsyncClient,
    state: AppState,
) -> None:
    headers = _staff_headers(state, await _make_admin(state))

    response = await client.post(
        f"{BASE}/admin/treatments",
        headers=headers,
        json={"code": "consultation", "name": "Another Consultation"},
    )

    assert response.status_code == 409
    assert response.json()["code"] == 409


# --- Specialties ------------------------------------------------------------


async def test_admin_specialty_edits_reach_the_public_filter(
    client: AsyncClient,
    state: AppState,
) -> None:
    headers = _staff_headers(state, await _make_admin(state))

    created = await client.post(
        f"{BASE}/admin/specialties",
        headers=headers,
        json={
            "code": "sleep-dentistry",
            "name": "Sleep Dentistry",
            "description": "Snoring and sleep apnoea appliances.",
            "display_order": 5,
        },
    )
    assert created.status_code == 201
    specialty = created.json()

    public = await client.get(f"{BASE}/config/specialties")
    assert [row["code"] for row in public.json()["items"]][0] == "sleep-dentistry"

    deleted = await client.delete(
        f"{BASE}/admin/specialties/{specialty['id']}", headers=headers
    )
    assert deleted.status_code == 204

    public = await client.get(f"{BASE}/config/specialties")
    assert "sleep-dentistry" not in {row["code"] for row in public.json()["items"]}

    admin_list = await client.get(f"{BASE}/admin/specialties", headers=headers)
    retired = next(
        row for row in admin_list.json()["items"] if row["id"] == specialty["id"]
    )
    assert retired["is_active"] is False


async def test_duplicate_specialty_code_is_refused(
    client: AsyncClient,
    state: AppState,
) -> None:
    headers = _staff_headers(state, await _make_admin(state))

    response = await client.post(
        f"{BASE}/admin/specialties",
        headers=headers,
        json={"code": "orthodontics", "name": "Another Orthodontics"},
    )

    assert response.status_code == 409


# --- Insurance providers ----------------------------------------------------


async def test_admin_manages_insurers_inside_one_country(
    client: AsyncClient,
    state: AppState,
) -> None:
    headers = _staff_headers(state, await _make_admin(state))

    kenya = await client.get(f"{BASE}/admin/countries/KE/insurance-providers", headers=headers)
    britam = next(row for row in kenya.json()["items"] if row["name"] == "Britam")

    created = await client.post(
        f"{BASE}/admin/countries/KE/insurance-providers",
        headers=headers,
        json={"name": "AAR", "is_national": False},
    )
    assert created.status_code == 201
    aar = created.json()

    public = await client.get(
        f"{BASE}/config/country/insurance-providers", params={"country": "KE"}
    )
    assert "AAR" in {row["name"] for row in public.json()["items"]}

    renamed = await client.patch(
        f"{BASE}/admin/countries/KE/insurance-providers/{aar['id']}",
        headers=headers,
        json={"name": "AAR Insurance", "is_national": False},
    )
    assert renamed.status_code == 200
    assert renamed.json()["name"] == "AAR Insurance"

    retired = await client.delete(
        f"{BASE}/admin/countries/KE/insurance-providers/{britam['id']}", headers=headers
    )
    assert retired.status_code == 204

    public = await client.get(
        f"{BASE}/config/country/insurance-providers", params={"country": "KE"}
    )
    assert "Britam" not in {row["name"] for row in public.json()["items"]}
    # Nigeria is unaffected.
    nigeria = await client.get(
        f"{BASE}/config/country/insurance-providers", params={"country": "NG"}
    )
    assert [row["name"] for row in nigeria.json()["items"]] == ["NHIS"]

    admin_list = await client.get(
        f"{BASE}/admin/countries/KE/insurance-providers", headers=headers
    )
    retired_row = next(
        row for row in admin_list.json()["items"] if row["id"] == britam["id"]
    )
    assert retired_row["is_active"] is False


async def test_insurer_cannot_be_edited_through_another_country(
    client: AsyncClient,
    state: AppState,
) -> None:
    headers = _staff_headers(state, await _make_admin(state))
    kenya = await client.get(f"{BASE}/admin/countries/KE/insurance-providers", headers=headers)
    nhif = next(row for row in kenya.json()["items"] if row["name"] == "NHIF")

    response = await client.patch(
        f"{BASE}/admin/countries/NG/insurance-providers/{nhif['id']}",
        headers=headers,
        json={"name": "NHIF", "is_national": True},
    )

    assert response.status_code == 404


async def test_duplicate_insurer_name_in_a_country_is_refused(
    client: AsyncClient,
    state: AppState,
) -> None:
    headers = _staff_headers(state, await _make_admin(state))

    response = await client.post(
        f"{BASE}/admin/countries/KE/insurance-providers",
        headers=headers,
        json={"name": "Britam", "is_national": False},
    )

    assert response.status_code == 409


# --- Subdivisions -----------------------------------------------------------


async def test_admin_creates_a_subdivision_with_a_derived_code(
    client: AsyncClient,
    state: AppState,
) -> None:
    headers = _staff_headers(state, await _make_admin(state))

    created = await client.post(
        f"{BASE}/admin/countries/KE/subdivisions",
        headers=headers,
        json={"name": "Kisumu County"},
    )
    assert created.status_code == 201
    subdivision = created.json()
    assert subdivision["code"] == "KISUMU_COUNTY"

    public = await client.get(f"{BASE}/config/country/regions", params={"country": "KE"})
    assert "Kisumu County" in {row["name"] for row in public.json()["items"]}

    deleted = await client.delete(
        f"{BASE}/admin/countries/KE/subdivisions/{subdivision['id']}", headers=headers
    )
    assert deleted.status_code == 204

    public = await client.get(f"{BASE}/config/country/regions", params={"country": "KE"})
    assert "Kisumu County" not in {row["name"] for row in public.json()["items"]}

    admin_list = await client.get(
        f"{BASE}/admin/countries/KE/subdivisions", headers=headers
    )
    retired = next(
        row for row in admin_list.json()["items"] if row["id"] == subdivision["id"]
    )
    assert retired["is_active"] is False


async def test_duplicate_subdivision_code_is_refused(
    client: AsyncClient,
    state: AppState,
) -> None:
    headers = _staff_headers(state, await _make_admin(state))

    response = await client.post(
        f"{BASE}/admin/countries/KE/subdivisions",
        headers=headers,
        json={"name": "Nairobi", "code": "NAIROBI"},
    )

    assert response.status_code == 409


async def test_subdivision_writes_reject_an_unknown_country(
    client: AsyncClient,
    state: AppState,
) -> None:
    headers = _staff_headers(state, await _make_admin(state))

    response = await client.post(
        f"{BASE}/admin/countries/ZZ/subdivisions",
        headers=headers,
        json={"name": "Somewhere"},
    )

    assert response.status_code == 404


# --- Audit ------------------------------------------------------------------


async def test_reference_writes_are_audited_with_the_actor_and_the_change(
    client: AsyncClient,
    state: AppState,
) -> None:
    admin = await _make_admin(state)
    headers = _staff_headers(state, admin)

    created = await client.post(
        f"{BASE}/admin/treatments",
        headers=headers,
        json={"code": "night-guard", "name": "Night Guard"},
    )
    treatment = created.json()
    await client.delete(f"{BASE}/admin/treatments/{treatment['id']}", headers=headers)

    audit = await client.get(f"{BASE}/admin/audit", headers=headers)

    assert audit.status_code == 200
    entries = audit.json()["items"]
    delete_entry, create_entry = entries[0], entries[1]

    assert delete_entry["action"] == "treatment.delete"
    assert delete_entry["entity_type"] == "treatment"
    assert delete_entry["entity_id"] == treatment["id"]
    assert delete_entry["before"]["is_active"] is True
    assert delete_entry["after"]["is_active"] is False

    assert create_entry["action"] == "treatment.create"
    assert create_entry["actor_email"] == admin.email
    assert create_entry["actor_role"] == "admin"
    assert create_entry["before"] is None
    assert create_entry["after"]["code"] == "night-guard"
