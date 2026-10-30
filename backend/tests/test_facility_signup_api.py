"""A Facility signup creates the Facility, its first Branch, and an owner (#118).

The Facility is hidden from the directory until staff approve its owner, so a
signup can never put an unreviewed clinic in front of patients. ``users.role``
and ``users.facility_id`` are still written beside the membership (ADR-0006).
"""

from __future__ import annotations

import uuid
from typing import Any

import pytest
from httpx import AsyncClient
from sqlalchemy import select

from app.logic.v1.auth import hash_password
from app.repositories.listing import Branch, Facility
from app.repositories.user import User, UserRepository
from app.utils.state import AppState

PASSWORD = "correct horse battery staple"

FACILITY = {
    "name": "Smile Line Dental",
    "subdivision_code": "MOMBASA",
    "address": "Nyali Road, Mombasa",
}


async def _sign_up_facility(
    client: AsyncClient,
    *,
    country: str = "KE",
    email: str = "owner@example.com",
    **overrides: Any,
) -> Any:
    return await client.post(
        "/api/v1/auth/register",
        headers={"Accept-Country": country},
        json={
            "full_name": "Achieng Otieno",
            "email": email,
            "password": PASSWORD,
            "phone": "+254700000001",
            "account_type": "facility_owner",
            "facility": {**FACILITY, **overrides},
        },
    )


def _bearer(body: dict[str, Any]) -> dict[str, str]:
    return {"Authorization": f"Bearer {body['access_token']}"}


async def _facility_named(state: AppState, name: str) -> Facility | None:
    async with state.db_session_maker() as session:
        row = await session.execute(select(Facility).where(Facility.name == name))
        return row.scalar_one_or_none()


async def _staff_headers(client: AsyncClient, state: AppState) -> dict[str, str]:
    email = f"admin-{uuid.uuid4().hex[:8]}@example.com"
    async with state.db_session_maker() as session:
        await UserRepository.create(
            session,
            full_name="Platform Admin",
            email=email,
            password_hash=hash_password(PASSWORD),
            role="admin",
        )
        await session.commit()
    login = await client.post(
        "/api/v1/auth/staff/login", json={"email": email, "password": PASSWORD}
    )
    return _bearer(login.json())


async def test_a_facility_signup_creates_the_facility_its_branch_and_an_owner(
    client: AsyncClient, state: AppState
) -> None:
    response = await _sign_up_facility(client)

    assert response.status_code == 200
    body = response.json()
    facility = await _facility_named(state, "Smile Line Dental")
    assert facility is not None
    assert facility.country_code == "KE"
    assert facility.currency == "KES"
    assert facility.subdivision_code == "MOMBASA"
    assert facility.address == "Nyali Road, Mombasa"
    assert facility.phone == "+254700000001"
    assert facility.email == "owner@example.com"
    assert facility.verification_tier == "unverified"

    async with state.db_session_maker() as session:
        branches = (
            (await session.execute(select(Branch).where(Branch.facility_id == facility.id)))
            .scalars()
            .all()
        )
        user = await session.get(User, body["user"]["id"])
    [branch] = branches
    assert branch.name is None
    assert branch.subdivision_code == "MOMBASA"
    assert branch.address == "Nyali Road, Mombasa"
    assert user is not None
    assert user.facility_id == facility.id

    expected = [
        {"facility_id": facility.id, "facility_name": "Smile Line Dental", "permissions": ["owner"]}
    ]
    assert body["user"]["memberships"] == expected
    assert body["user"]["profiles"] == []
    me = await client.get("/api/v1/auth/me", headers=_bearer(body))
    assert me.json()["memberships"] == expected
    assert me.json()["role"] == "facility_owner"
    assert me.json()["account_status"] == "pending"


async def test_the_country_and_its_currency_come_from_accept_country(
    client: AsyncClient, state: AppState
) -> None:
    response = await _sign_up_facility(
        client, country="NG", subdivision_code="LAGOS", address="Admiralty Way, Lekki"
    )

    assert response.status_code == 200
    facility = await _facility_named(state, "Smile Line Dental")
    assert facility is not None
    assert facility.country_code == "NG"
    assert facility.currency == "NGN"


async def test_the_new_owner_reaches_their_facility_dashboard(client: AsyncClient) -> None:
    body = (await _sign_up_facility(client)).json()

    response = await client.get("/api/v1/facility/dashboard", headers=_bearer(body))

    assert response.status_code == 200
    assert response.json()["facility_name"] == "Smile Line Dental"


@pytest.mark.parametrize("missing", ["name", "subdivision_code", "address"])
async def test_a_facility_signup_without_its_facility_details_is_a_422(
    client: AsyncClient, missing: str
) -> None:
    response = await _sign_up_facility(client, **{missing: None})

    assert response.status_code == 422


async def test_a_facility_signup_without_a_facility_is_a_422(client: AsyncClient) -> None:
    response = await client.post(
        "/api/v1/auth/register",
        json={
            "full_name": "Achieng Otieno",
            "email": "owner@example.com",
            "password": PASSWORD,
            "account_type": "facility_owner",
        },
    )

    assert response.status_code == 422


async def test_facility_details_on_another_account_type_are_a_422(client: AsyncClient) -> None:
    response = await client.post(
        "/api/v1/auth/register",
        json={
            "full_name": "Amina Wanjiku",
            "email": "amina@example.com",
            "password": PASSWORD,
            "account_type": "patient",
            "facility": FACILITY,
        },
    )

    assert response.status_code == 422


async def test_a_county_outside_the_country_is_refused_and_creates_nothing(
    client: AsyncClient, state: AppState
) -> None:
    response = await _sign_up_facility(client, subdivision_code="LAGOS")

    assert response.status_code == 422
    assert await _facility_named(state, "Smile Line Dental") is None
    async with state.db_session_maker() as session:
        assert await UserRepository.get_by_email(session, "owner@example.com") is None


async def test_an_unknown_country_is_refused(client: AsyncClient) -> None:
    response = await _sign_up_facility(client, country="ZZ")

    assert response.status_code == 422


async def test_a_new_facility_stays_out_of_the_directory_until_its_owner_is_approved(
    client: AsyncClient, state: AppState
) -> None:
    body = (await _sign_up_facility(client)).json()
    facility = await _facility_named(state, "Smile Line Dental")
    assert facility is not None

    def names(page: Any) -> list[str]:
        return [item["name"] for item in page.json()["items"]]

    search = await client.get("/api/v1/facilities", params={"subdivision_code": "MOMBASA"})
    profile = await client.get(f"/api/v1/facilities/{facility.id}")
    assert "Smile Line Dental" not in names(search)
    assert profile.status_code == 404

    approve = await client.post(
        f"/api/v1/users/{body['user']['id']}/approve",
        headers=await _staff_headers(client, state),
    )

    assert approve.status_code == 200
    search = await client.get("/api/v1/facilities", params={"subdivision_code": "MOMBASA"})
    profile = await client.get(f"/api/v1/facilities/{facility.id}")
    assert "Smile Line Dental" in names(search)
    assert profile.status_code == 200


async def test_an_unlisted_facility_cannot_be_booked(client: AsyncClient, state: AppState) -> None:
    await _sign_up_facility(client)
    facility = await _facility_named(state, "Smile Line Dental")
    assert facility is not None
    patient = await client.post(
        "/api/v1/auth/login",
        json={"email": "amina.patient@example.com", "password": PASSWORD},
    )
    assert patient.status_code == 200, "seeded patient email changed"

    response = await client.post(
        "/api/v1/appointments",
        headers=_bearer(patient.json()),
        json={
            "listing_type": "facility",
            "listing_id": facility.id,
            "scheduled_at": "2099-01-15T10:00:00",
        },
    )

    assert response.status_code == 404
