"""Profiles and Facility Memberships on ``/auth/me`` (ADR-0006, #117).

A User holds at most one Profile of each kind, enforced by the database, and
any number of Facility Memberships, each with its own permission set. ``role``
is still returned unchanged while clients migrate off it.
"""

from __future__ import annotations

import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.logic.v1.auth import STAFF_SCOPE, create_access_token, hash_password
from app.repositories.listing import Facility
from app.repositories.profile import FacilityMembership, Profile
from app.repositories.user import User
from app.utils.state import AppState
from tests.factories import PATIENTS


async def _make_user(state: AppState, role: str) -> User:
    async with state.db_session_maker() as session:
        user = User(
            full_name=f"Account {role}",
            email=f"{role}-{uuid.uuid4().hex[:8]}@example.com",
            role=role,
            password_hash=hash_password("correct horse battery staple"),
        )
        session.add(user)
        await session.commit()
        return user


async def _two_facilities(state: AppState) -> list[Facility]:
    async with state.db_session_maker() as session:
        rows = await session.execute(select(Facility).order_by(Facility.name).limit(2))
        return list(rows.scalars().all())


def _bearer(state: AppState, user: User, scope: str = "public") -> dict[str, str]:
    return {"Authorization": f"Bearer {create_access_token(state, user.id, user.role, scope=scope)}"}


async def test_me_lists_profiles_and_memberships_and_keeps_role(
    client: AsyncClient, state: AppState
) -> None:
    user = await _make_user(state, "facility_dentist")
    first, second = await _two_facilities(state)
    async with state.db_session_maker() as session:
        session.add_all(
            [
                Profile(user_id=user.id, kind="specialist"),
                Profile(user_id=user.id, kind="patient"),
                FacilityMembership(
                    user_id=user.id, facility_id=first.id, owner=True, clinical=True
                ),
                FacilityMembership(user_id=user.id, facility_id=second.id, front_office=True),
            ]
        )
        await session.commit()

    response = await client.get("/api/v1/auth/me", headers=_bearer(state, user))

    assert response.status_code == 200
    body = response.json()
    assert body["role"] == "facility_dentist"
    assert body["profiles"] == [{"kind": "patient"}, {"kind": "specialist"}]
    assert body["memberships"] == [
        {
            "facility_id": first.id,
            "facility_name": first.name,
            "permissions": ["owner", "clinical"],
        },
        {
            "facility_id": second.id,
            "facility_name": second.name,
            "permissions": ["front_office"],
        },
    ]


async def test_login_returns_the_seeded_patients_profile(client: AsyncClient) -> None:
    response = await client.post(
        "/api/v1/auth/login",
        json={"email": PATIENTS[0]["email"], "password": "correct horse battery staple"},
    )

    assert response.status_code == 200
    assert response.json()["user"]["profiles"] == [{"kind": "patient"}]
    assert response.json()["user"]["memberships"] == []


async def test_a_staff_member_holds_no_profiles(client: AsyncClient, state: AppState) -> None:
    admin = await _make_user(state, "admin")

    response = await client.get(
        "/api/v1/auth/staff/me", headers=_bearer(state, admin, scope=STAFF_SCOPE)
    )

    assert response.status_code == 200
    assert response.json()["profiles"] == []
    assert response.json()["memberships"] == []


async def test_the_database_allows_one_profile_per_kind(state: AppState) -> None:
    user = await _make_user(state, "patient")

    async with state.db_session_maker() as session:
        session.add_all(
            [Profile(user_id=user.id, kind="patient"), Profile(user_id=user.id, kind="patient")]
        )
        with pytest.raises(IntegrityError):
            await session.commit()


async def test_the_database_allows_one_membership_per_facility(state: AppState) -> None:
    user = await _make_user(state, "front_office")
    facility, _ = await _two_facilities(state)

    async with state.db_session_maker() as session:
        session.add_all(
            [
                FacilityMembership(user_id=user.id, facility_id=facility.id, front_office=True),
                FacilityMembership(user_id=user.id, facility_id=facility.id, clinical=True),
            ]
        )
        with pytest.raises(IntegrityError):
            await session.commit()


async def test_a_membership_needs_at_least_one_permission(state: AppState) -> None:
    user = await _make_user(state, "front_office")
    facility, _ = await _two_facilities(state)

    async with state.db_session_maker() as session:
        session.add(FacilityMembership(user_id=user.id, facility_id=facility.id))
        with pytest.raises(IntegrityError):
            await session.commit()


@pytest.mark.parametrize(
    ("account_type", "profiles"),
    [
        ("patient", [{"kind": "patient"}]),
        ("international_patient", [{"kind": "patient"}]),
        ("dentist", [{"kind": "specialist"}]),
        ("specialist", [{"kind": "specialist"}]),
        ("intern", [{"kind": "specialist"}]),
        ("supplier", [{"kind": "supplier"}]),
        ("training_provider", [{"kind": "training_provider"}]),
        ("facility_owner", []),
    ],
)
async def test_signup_creates_the_profile_its_account_type_implies(
    client: AsyncClient, account_type: str, profiles: list[dict[str, str]]
) -> None:
    payload: dict[str, str] = {
        "full_name": "New Account",
        "email": f"{account_type}@example.com",
        "password": "correct horse battery staple",
        "account_type": account_type,
    }
    if account_type == "facility_owner":
        payload.update(
            {
                "facility_name": "New Clinic",
                "country_code": "KE",
                "subdivision_code": "NAIROBI",
                "address": "Kileleshwa Road, Nairobi",
            }
        )

    response = await client.post("/api/v1/auth/register", json=payload)

    assert response.status_code == 200
    assert response.json()["user"]["profiles"] == profiles
    me = await client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {response.json()['access_token']}"},
    )
    assert me.json()["profiles"] == profiles
    assert me.json()["role"] == account_type
