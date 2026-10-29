"""HTTP-level tests for the public signup and login endpoints.

Public signup creates public account types only (PRD §2); staff roles are
granted by staff, never requested by the caller. Professional accounts start
life pending staff review; patient accounts are active immediately.
"""

from __future__ import annotations

from typing import Any

import pytest
from httpx import AsyncClient
from sqlalchemy import select

from app.repositories.listing import Branch, Facility
from app.repositories.profile import FacilityMembership
from app.repositories.user import User
from app.utils.state import AppState


def signup_payload(**overrides: Any) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "full_name": "Amina Wanjiku",
        "email": "amina@example.com",
        "password": "correct horse battery staple",
        "account_type": "patient",
    }
    payload.update(overrides)
    return payload


def facility_signup_payload(**overrides: Any) -> dict[str, Any]:
    payload: dict[str, Any] = signup_payload(
        full_name="Clinic Owner",
        email="clinic@example.com",
        account_type="facility_owner",
        facility_name="Westlands Dental",
        country_code="KE",
        subdivision_code="NAIROBI",
        address="Kileleshwa Road, Nairobi",
    )
    payload.update(overrides)
    return payload


async def test_patient_signup_succeeds(client: AsyncClient) -> None:
    response = await client.post("/api/v1/auth/register", json=signup_payload())

    assert response.status_code == 200
    body = response.json()
    assert body["access_token"]
    assert body["user"]["role"] == "patient"
    assert body["user"]["is_staff"] is False
    assert body["user"]["account_status"] == "active"


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


async def test_professional_signup_starts_pending(client: AsyncClient) -> None:
    response = await client.post(
        "/api/v1/auth/register",
        json=signup_payload(email="dentist@example.com", account_type="dentist"),
    )

    assert response.status_code == 200
    body = response.json()
    assert body["user"]["role"] == "dentist"
    assert body["user"]["account_status"] == "pending"


async def test_patient_signup_is_active(client: AsyncClient) -> None:
    response = await client.post(
        "/api/v1/auth/register",
        json=signup_payload(email="patient@example.com", account_type="patient"),
    )

    assert response.status_code == 200
    assert response.json()["user"]["account_status"] == "active"


async def test_login_carries_the_account_status(client: AsyncClient) -> None:
    await client.post(
        "/api/v1/auth/register",
        json=signup_payload(email="intern@example.com", account_type="intern"),
    )

    response = await client.post(
        "/api/v1/auth/login",
        json={"email": "intern@example.com", "password": "correct horse battery staple"},
    )

    assert response.status_code == 200
    assert response.json()["user"]["account_status"] == "pending"


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


async def test_facility_signup_creates_the_facility_branch_and_owner_membership(
    client: AsyncClient,
    state: AppState,
) -> None:
    signup = await client.post("/api/v1/auth/register", json=facility_signup_payload())

    assert signup.status_code == 200
    body = signup.json()
    assert body["user"]["role"] == "facility_owner"
    assert body["user"]["account_status"] == "pending"
    assert body["user"]["profiles"] == []
    assert len(body["user"]["memberships"]) == 1
    membership = body["user"]["memberships"][0]
    assert membership["facility_name"] == "Westlands Dental"
    assert membership["permissions"] == ["owner"]

    me = await client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {body['access_token']}"},
    )

    assert me.status_code == 200
    assert me.json()["memberships"] == [membership]

    async with state.db_session_maker() as session:
        facility = (
            await session.execute(
                select(Facility).where(Facility.id == membership["facility_id"])
            )
        ).scalar_one()
        assert facility.name == "Westlands Dental"
        assert facility.country_code == "KE"
        assert facility.subdivision_code == "NAIROBI"
        assert facility.address == "Kileleshwa Road, Nairobi"
        assert facility.currency == "KES"
        assert facility.email == "clinic@example.com"

        branches = (
            (await session.execute(select(Branch).where(Branch.facility_id == facility.id)))
            .scalars()
            .all()
        )
        assert len(branches) == 1
        assert branches[0].name is None
        assert branches[0].subdivision_code == "NAIROBI"
        assert branches[0].address == "Kileleshwa Road, Nairobi"

        user = await session.get(User, body["user"]["id"])
        assert user is not None
        assert user.facility_id == facility.id

        stored_membership = (
            await session.execute(
                select(FacilityMembership).where(
                    FacilityMembership.user_id == user.id,
                    FacilityMembership.facility_id == facility.id,
                )
            )
        ).scalar_one()
        assert stored_membership.owner is True
        assert stored_membership.front_office is False
        assert stored_membership.clinical is False


@pytest.mark.parametrize(
    "missing_field",
    ["facility_name", "country_code", "subdivision_code", "address"],
)
async def test_facility_signup_requires_its_location_fields(
    client: AsyncClient,
    missing_field: str,
) -> None:
    payload = facility_signup_payload()
    del payload[missing_field]

    response = await client.post("/api/v1/auth/register", json=payload)

    assert response.status_code == 422


async def test_facility_signup_rejects_an_unknown_market(client: AsyncClient) -> None:
    response = await client.post(
        "/api/v1/auth/register",
        json=facility_signup_payload(country_code="ZZ"),
    )

    assert response.status_code == 400


async def test_facility_signup_rejects_a_subdivision_outside_its_market(
    client: AsyncClient,
) -> None:
    response = await client.post(
        "/api/v1/auth/register",
        json=facility_signup_payload(subdivision_code="LAGOS"),
    )

    assert response.status_code == 400


async def test_me_carries_the_account_status(client: AsyncClient) -> None:
    signup = await client.post("/api/v1/auth/register", json=facility_signup_payload())

    response = await client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {signup.json()['access_token']}"},
    )

    assert response.status_code == 200
    assert response.json()["account_status"] == "pending"
