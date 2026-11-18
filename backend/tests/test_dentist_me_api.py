"""A Specialist's own listing under ``/dentists/me`` (#119)."""

from __future__ import annotations

import uuid

from httpx import AsyncClient
from sqlalchemy import select

from app.logic.v1.auth import create_access_token, hash_password
from app.repositories.listing import Branch, Facility
from app.repositories.profile import Profile
from app.repositories.user import User
from app.utils.state import AppState


def _headers(state: AppState, user: User) -> dict[str, str]:
    return {"Authorization": f"Bearer {create_access_token(state, user.id, user.role)}"}


async def _make_user(state: AppState, *, kind: str | None = None) -> User:
    async with state.db_session_maker() as session:
        user = User(
            full_name="Dr. Test Own",
            email=f"own-listing-{uuid.uuid4().hex[:8]}@example.com",
            role="specialist" if kind else "patient",
            password_hash=hash_password("correct horse battery staple"),
        )
        session.add(user)
        await session.flush()

        if kind is not None:
            session.add(Profile(user_id=user.id, kind=kind))

        await session.commit()
        return user


async def _branch_in_country(state: AppState, country_code: str) -> Branch:
    async with state.db_session_maker() as session:
        branch = (
            await session.execute(
                select(Branch)
                .join(Branch.facility)
                .where(Facility.country_code == country_code)
                .limit(1)
            )
        ).scalar_one()
        return branch


async def _kenyan_branch(state: AppState) -> Branch:
    return await _branch_in_country(state, "KE")


async def _create_listing(client: AsyncClient, state: AppState, user: User) -> dict[str, object]:
    branch = await _kenyan_branch(state)
    response = await client.post(
        "/api/v1/dentists/me",
        headers=_headers(state, user),
        json={
            "country_code": "KE",
            "subdivision_code": "NAIROBI",
            "bio": "Gentle preventive care.",
            "specialty_codes": ["orthodontics"],
            "branch_ids": [branch.id],
        },
    )
    assert response.status_code == 200, response.text
    return response.json()


async def test_a_patient_without_a_specialist_profile_is_refused(
    client: AsyncClient, state: AppState
) -> None:
    user = await _make_user(state)

    response = await client.get("/api/v1/dentists/me", headers=_headers(state, user))

    assert response.status_code == 403
    assert response.json()["message"] == "A Specialist Profile is required for this route"


async def test_get_returns_404_until_the_listing_is_created(
    client: AsyncClient, state: AppState
) -> None:
    user = await _make_user(state, kind="specialist")

    response = await client.get("/api/v1/dentists/me", headers=_headers(state, user))

    assert response.status_code == 404
    assert response.json()["message"] == "Specialist listing not found"


async def test_create_then_read_the_callers_own_listing(
    client: AsyncClient, state: AppState
) -> None:
    user = await _make_user(state, kind="specialist")

    created = await _create_listing(client, state, user)

    assert created["name"] == "Dr. Test Own"
    assert created["slug"] == "dr-test-own"
    assert created["bio"] == "Gentle preventive care."
    assert [row["code"] for row in created["specialties"]] == ["orthodontics"]
    assert len(created["branches"]) == 1

    read = await client.get("/api/v1/dentists/me", headers=_headers(state, user))
    assert read.status_code == 200
    assert read.json()["id"] == created["id"]


async def test_create_refuses_a_second_listing(client: AsyncClient, state: AppState) -> None:
    user = await _make_user(state, kind="specialist")
    await _create_listing(client, state, user)
    branch = await _kenyan_branch(state)

    response = await client.post(
        "/api/v1/dentists/me",
        headers=_headers(state, user),
        json={
            "country_code": "KE",
            "subdivision_code": "NAIROBI",
            "specialty_codes": [],
            "branch_ids": [branch.id],
        },
    )

    assert response.status_code == 409
    assert response.json()["message"] == "This account already has a Specialist listing"


async def test_create_rejects_an_unknown_specialty(client: AsyncClient, state: AppState) -> None:
    user = await _make_user(state, kind="specialist")

    response = await client.post(
        "/api/v1/dentists/me",
        headers=_headers(state, user),
        json={
            "country_code": "KE",
            "subdivision_code": "NAIROBI",
            "specialty_codes": ["not-a-specialty"],
            "branch_ids": [],
        },
    )

    assert response.status_code == 400
    assert "Unknown Specialty" in response.json()["message"]


async def test_a_workplace_must_be_in_the_listings_country(
    client: AsyncClient, state: AppState
) -> None:
    user = await _make_user(state, kind="specialist")
    nigerian_branch = await _branch_in_country(state, "NG")

    response = await client.post(
        "/api/v1/dentists/me",
        headers=_headers(state, user),
        json={
            "country_code": "KE",
            "subdivision_code": "NAIROBI",
            "branch_ids": [nigerian_branch.id],
        },
    )

    assert response.status_code == 400
    assert response.json()["message"] == "Every Workplace must be in the listing's Country"


async def test_moving_a_listing_country_rejects_its_old_workplaces(
    client: AsyncClient, state: AppState
) -> None:
    user = await _make_user(state, kind="specialist")
    await _create_listing(client, state, user)
    kenyan_branch = await _kenyan_branch(state)

    response = await client.patch(
        "/api/v1/dentists/me",
        headers=_headers(state, user),
        json={
            "country_code": "NG",
            "subdivision_code": "LAGOS",
            "branch_ids": [kenyan_branch.id],
        },
    )

    assert response.status_code == 400
    assert response.json()["message"] == "Every Workplace must be in the listing's Country"


async def test_patch_changes_bio_specialties_and_workplaces_on_the_public_profile(
    client: AsyncClient, state: AppState
) -> None:
    user = await _make_user(state, kind="specialist")
    created = await _create_listing(client, state, user)

    response = await client.patch(
        "/api/v1/dentists/me",
        headers=_headers(state, user),
        json={
            "bio": "Now focused on children.",
            "specialty_codes": ["paediatric-dentistry"],
            "branch_ids": [],
        },
    )

    assert response.status_code == 200, response.text
    assert response.json()["bio"] == "Now focused on children."
    assert [row["code"] for row in response.json()["specialties"]] == ["paediatric-dentistry"]
    assert response.json()["branches"] == []

    public = await client.get(
        f"/api/v1/dentists/{created['id']}",
        headers={"Accept-Country": "KE"},
    )
    assert public.status_code == 200
    body = public.json()
    assert body["bio"] == "Now focused on children."
    assert [row["code"] for row in body["specialties"]] == ["paediatric-dentistry"]
    assert body["branches"] == []


async def test_moving_a_listing_country_keeps_workplaces_in_that_country(
    client: AsyncClient, state: AppState
) -> None:
    user = await _make_user(state, kind="specialist")
    await _create_listing(client, state, user)

    response = await client.patch(
        "/api/v1/dentists/me",
        headers=_headers(state, user),
        json={"country_code": "NG", "subdivision_code": "LAGOS"},
    )

    assert response.status_code == 400
    assert response.json()["message"] == "Every Workplace must be in the listing's Country"


async def test_another_users_listing_is_not_reachable_through_my_own_route(
    client: AsyncClient, state: AppState
) -> None:
    first = await _make_user(state, kind="specialist")
    first_listing = await _create_listing(client, state, first)
    second = await _make_user(state, kind="specialist")

    response = await client.get("/api/v1/dentists/me", headers=_headers(state, second))

    assert response.status_code == 404
    assert response.json()["message"] == "Specialist listing not found"
    assert first_listing["id"] != second.id


async def test_a_patient_cannot_write_a_specialist_listing(
    client: AsyncClient, state: AppState
) -> None:
    user = await _make_user(state)

    response = await client.patch(
        "/api/v1/dentists/me",
        headers=_headers(state, user),
        json={"bio": "Should not apply."},
    )

    assert response.status_code == 403
