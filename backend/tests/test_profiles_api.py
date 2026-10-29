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
    token = create_access_token(state, user.id, user.role, scope=scope)
    return {"Authorization": f"Bearer {token}"}


async def test_me_lists_profiles_and_memberships_derives_role_from_profiles(
    client: AsyncClient, state: AppState
) -> None:
    """Test that /auth/me derives role from profiles per ADR-0006.

    A user with both patient and specialist profiles gets "patient" role
    (profiles take precedence over memberships, and "patient" comes first alphabetically).
    """
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
    # Per ADR-0006: role is derived from profiles (first alphabetically)
    # User has both "patient" and "specialist" profiles -> "patient" role
    assert body["role"] == "patient"
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
    ("account_type", "profiles", "expected_role"),
    [
        ("patient", [{"kind": "patient"}], "patient"),
        # Per PRD §2: "Patient (incl. international patient)" - both map to patient role
        ("international_patient", [{"kind": "patient"}], "patient"),
        ("dentist", [{"kind": "specialist"}], "specialist"),
        ("specialist", [{"kind": "specialist"}], "specialist"),
        ("intern", [{"kind": "specialist"}], "specialist"),
        ("supplier", [{"kind": "supplier"}], "supplier"),
        ("training_provider", [{"kind": "training_provider"}], "training_provider"),
        ("facility", [], "facility_owner"),
    ],
)
async def test_signup_creates_the_profile_its_account_type_implies(
    client: AsyncClient, account_type: str, profiles: list[dict[str, str]], expected_role: str
) -> None:
    payload: dict[str, str] = {
        "full_name": "New Account",
        "email": f"{account_type}@example.com",
        "password": "correct horse battery staple",
        "account_type": account_type,
    }
    if account_type == "facility":
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
    assert me.json()["role"] == expected_role


async def test_me_detailed_returns_phone_home_country_and_account_status(
    client: AsyncClient, state: AppState
) -> None:
    """GET /auth/me returns detailed user info including phone,
    home_country_code, and account_status."""
    user = await _make_user(state, "patient")
    # Update user with phone and home_country_code directly in DB
    async with state.db_session_maker() as session:
        db_user = await session.get(User, user.id)
        db_user.phone = "+254700000000"
        db_user.home_country_code = "KE"
        db_user.account_status = "active"
        await session.commit()

    response = await client.get("/api/v1/auth/me", headers=_bearer(state, user))

    assert response.status_code == 200
    body = response.json()
    assert body["id"] == user.id
    assert body["email"] == user.email
    assert body["full_name"] == user.full_name
    assert body["phone"] == "+254700000000"
    assert body["home_country_code"] == "KE"
    assert body["account_status"] == "active"
    assert body["role"] == "patient"
    assert body["is_staff"] is False
    assert "profiles" in body
    assert "memberships" in body


async def test_patch_me_updates_name_phone_and_home_country(
    client: AsyncClient, state: AppState
) -> None:
    """PATCH /auth/me updates name, phone, and home_country_code."""
    user = await _make_user(state, "patient")

    response = await client.patch(
        "/api/v1/auth/me",
        json={"full_name": "Updated Name", "phone": "+254711111111", "home_country_code": "NG"},
        headers=_bearer(state, user),
    )

    assert response.status_code == 200
    body = response.json()
    assert body["full_name"] == "Updated Name"
    assert body["phone"] == "+254711111111"
    assert body["home_country_code"] == "NG"

    # Verify persistence
    async with state.db_session_maker() as session:
        db_user = await session.get(User, user.id)
        assert db_user.full_name == "Updated Name"
        assert db_user.phone == "+254711111111"
        assert db_user.home_country_code == "NG"


async def test_patch_me_rejects_invalid_country_code(client: AsyncClient, state: AppState) -> None:
    """PATCH /auth/me rejects invalid or inactive country code."""
    user = await _make_user(state, "patient")

    response = await client.patch(
        "/api/v1/auth/me",
        json={"home_country_code": "XX"},  # Invalid country code
        headers=_bearer(state, user),
    )

    assert response.status_code == 409
    assert "Invalid or inactive country" in response.json()["message"]


async def test_add_profile_endpoint_adds_new_profile_kind(
    client: AsyncClient, state: AppState
) -> None:
    """POST /auth/me/profiles adds a new profile kind to the user."""
    user = await _make_user(state, "patient")
    # Add patient profile manually (signup would do this)
    async with state.db_session_maker() as session:
        from app.repositories.profile import Profile

        session.add(Profile(user_id=user.id, kind="patient"))
        await session.commit()

    response = await client.post(
        "/api/v1/auth/me/profiles",
        json={"profile_kind": "specialist"},
        headers=_bearer(state, user),
    )

    assert response.status_code == 200
    body = response.json()
    assert body["profile_kind"] == "specialist"
    assert "successfully" in body["message"]

    # Verify the profile was added
    me = await client.get("/api/v1/auth/me", headers=_bearer(state, user))
    assert me.status_code == 200
    profiles = [p["kind"] for p in me.json()["profiles"]]
    assert "patient" in profiles
    assert "specialist" in profiles


async def test_add_profile_rejects_duplicate_kind(client: AsyncClient, state: AppState) -> None:
    """POST /auth/me/profiles rejects adding a profile kind the user already has."""
    user = await _make_user(state, "patient")
    # Add patient profile manually
    async with state.db_session_maker() as session:
        from app.repositories.profile import Profile

        session.add(Profile(user_id=user.id, kind="patient"))
        await session.commit()

    response = await client.post(
        "/api/v1/auth/me/profiles",
        json={"profile_kind": "patient"},
        headers=_bearer(state, user),
    )

    assert response.status_code == 409
    assert "already has a patient profile" in response.json()["message"]


async def test_get_dentist_me_returns_none_without_specialist_profile(
    client: AsyncClient, state: AppState
) -> None:
    """GET /dentists/me returns null when user has no specialist profile."""
    user = await _make_user(state, "patient")
    # Add patient profile (but not specialist)
    async with state.db_session_maker() as session:
        from app.repositories.profile import Profile

        session.add(Profile(user_id=user.id, kind="patient"))
        await session.commit()

    response = await client.get("/api/v1/dentists/me", headers=_bearer(state, user))

    assert response.status_code == 200
    assert response.json() is None


async def test_get_dentist_me_returns_listing_for_specialist(
    client: AsyncClient, state: AppState
) -> None:
    """GET /dentists/me returns the specialist listing when user has specialist profile."""
    from app.repositories.listing import Specialist

    user = await _make_user(state, "specialist")
    # Add specialist profile
    async with state.db_session_maker() as session:
        from app.repositories.profile import Profile

        session.add(Profile(user_id=user.id, kind="specialist"))
        await session.execute(
            Specialist.__table__.insert().values(
                id=str(uuid.uuid4()),
                name="Dr. Test Specialist",
                slug="dr-test-specialist",
                user_id=user.id,
                country_code="KE",
                subdivision_code="NAIROBI",
                currency="KES",
                verification_tier="unverified",
            )
        )
        await session.commit()

    response = await client.get("/api/v1/dentists/me", headers=_bearer(state, user))

    assert response.status_code == 200
    body = response.json()
    assert body is not None
    assert body["name"] == "Dr. Test Specialist"
    assert body["slug"] == "dr-test-specialist"
    assert "specialties" in body
    assert "branches" in body
    assert "verification_tier" in body
    assert "list_price" in body
    assert "currency" in body
    assert "rating" in body
    assert "review_count" in body


async def test_post_dentist_me_creates_listing_for_specialist(
    client: AsyncClient, state: AppState
) -> None:
    """POST /dentists/me creates a specialist listing for user with specialist profile."""
    user = await _make_user(state, "specialist")
    # Add specialist profile
    async with state.db_session_maker() as session:
        from app.repositories.profile import Profile

        session.add(Profile(user_id=user.id, kind="specialist"))
        await session.commit()

    response = await client.post(
        "/api/v1/dentists/me",
        json={
            "name": "Dr. New Specialist",
            "slug": "dr-new-specialist",
            "specialty_codes": [],
            "branch_ids": [],
            "list_price": "5000.00",
        },
        headers=_bearer(state, user),
    )

    assert response.status_code == 200
    body = response.json()
    assert body["name"] == "Dr. New Specialist"
    assert body["slug"] == "dr-new-specialist"
    assert body["list_price"] == "5000.00"
    assert body["currency"] == "KES"
    assert body["verification_tier"] == "unverified"


async def test_post_dentist_me_rejects_without_specialist_profile(
    client: AsyncClient, state: AppState
) -> None:
    """POST /dentists/me rejects when user has no specialist profile."""
    user = await _make_user(state, "patient")

    response = await client.post(
        "/api/v1/dentists/me",
        json={"name": "Dr. Test", "slug": "dr-test"},
        headers=_bearer(state, user),
    )

    assert response.status_code == 409
    assert "must have a specialist profile" in response.json()["message"]


async def test_post_dentist_me_rejects_duplicate_listing(
    client: AsyncClient, state: AppState
) -> None:
    """POST /dentists/me rejects when user already has a specialist listing."""
    from app.repositories.listing import Specialist

    user = await _make_user(state, "specialist")
    # Add specialist profile and existing listing
    async with state.db_session_maker() as session:
        from app.repositories.profile import Profile

        session.add(Profile(user_id=user.id, kind="specialist"))
        await session.execute(
            Specialist.__table__.insert().values(
                id=str(uuid.uuid4()),
                name="Existing Specialist",
                slug="existing-specialist",
                user_id=user.id,
                country_code="KE",
                subdivision_code="NAIROBI",
                currency="KES",
                verification_tier="unverified",
            )
        )
        await session.commit()

    response = await client.post(
        "/api/v1/dentists/me",
        json={"name": "Dr. New", "slug": "dr-new"},
        headers=_bearer(state, user),
    )

    assert response.status_code == 409
    assert "already exists" in response.json()["message"]


async def test_patch_dentist_me_updates_listing(client: AsyncClient, state: AppState) -> None:
    """PATCH /dentists/me updates the specialist listing."""
    from app.repositories.listing import Specialist

    user = await _make_user(state, "specialist")
    # Add specialist profile and listing
    async with state.db_session_maker() as session:
        from app.repositories.profile import Profile

        session.add(Profile(user_id=user.id, kind="specialist"))
        spec_id = str(uuid.uuid4())
        await session.execute(
            Specialist.__table__.insert().values(
                id=spec_id,
                name="Dr. Original",
                slug="dr-original",
                user_id=user.id,
                country_code="KE",
                subdivision_code="NAIROBI",
                currency="KES",
                verification_tier="unverified",
                list_price="3000.00",
            )
        )
        await session.commit()

    response = await client.patch(
        "/api/v1/dentists/me",
        json={"name": "Dr. Updated", "list_price": "6000.00"},
        headers=_bearer(state, user),
    )

    assert response.status_code == 200
    body = response.json()
    assert body["name"] == "Dr. Updated"
    assert body["list_price"] == "6000.00"
