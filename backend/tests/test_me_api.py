"""Account settings: ``/me`` and ``/me/profiles`` (#119)."""

from __future__ import annotations

import uuid

from httpx import AsyncClient
from sqlalchemy import select

from app.logic.v1.auth import STAFF_SCOPE, create_access_token, hash_password
from app.repositories.country import Country
from app.repositories.profile import Profile
from app.repositories.user import User
from app.utils.state import AppState
from tests.factories import PATIENTS


async def _login(client: AsyncClient) -> str:
    response = await client.post(
        "/api/v1/auth/login",
        json={"email": PATIENTS[0]["email"], "password": "correct horse battery staple"},
    )
    assert response.status_code == 200
    return response.json()["access_token"]


def _headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


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


async def test_get_me_returns_the_callers_own_details(client: AsyncClient) -> None:
    response = await client.get("/api/v1/me", headers=_headers(await _login(client)))

    assert response.status_code == 200
    body = response.json()
    assert body["email"] == PATIENTS[0]["email"]
    assert body["full_name"] == PATIENTS[0]["full_name"]
    assert body["profiles"] == [{"kind": "patient"}]
    assert body["home_country_code"] is None


async def test_patch_me_updates_name_phone_and_home_country(client: AsyncClient) -> None:
    token = await _login(client)

    response = await client.patch(
        "/api/v1/me",
        headers=_headers(token),
        json={"full_name": "Amina Updated", "phone": "+254 700 000 000", "home_country_code": "ke"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["full_name"] == "Amina Updated"
    assert body["phone"] == "+254 700 000 000"
    assert body["home_country_code"] == "KE"

    # /auth/me is the same account shape, so it reflects the change too.
    me = await client.get("/api/v1/auth/me", headers=_headers(token))
    assert me.json()["full_name"] == "Amina Updated"
    assert me.json()["home_country_code"] == "KE"


async def test_patch_me_clears_optional_fields_with_null(client: AsyncClient) -> None:
    token = await _login(client)
    await client.patch(
        "/api/v1/me",
        headers=_headers(token),
        json={"phone": "+254 700 000 000", "home_country_code": "KE"},
    )

    response = await client.patch(
        "/api/v1/me",
        headers=_headers(token),
        json={"phone": None, "home_country_code": None},
    )

    assert response.status_code == 200
    assert response.json()["phone"] is None
    assert response.json()["home_country_code"] is None
    assert response.json()["full_name"] == PATIENTS[0]["full_name"]


async def test_patch_me_rejects_an_unknown_country(client: AsyncClient) -> None:
    response = await client.patch(
        "/api/v1/me",
        headers=_headers(await _login(client)),
        json={"home_country_code": "ZZ"},
    )

    assert response.status_code == 400
    assert response.json()["message"] == "Unknown or inactive home Country"


async def test_patch_me_rejects_a_blank_name(client: AsyncClient) -> None:
    response = await client.patch(
        "/api/v1/me",
        headers=_headers(await _login(client)),
        json={"full_name": "   "},
    )

    assert response.status_code == 400
    assert response.json()["message"] == "Name cannot be empty"


async def test_add_profile_keeps_role_and_refuses_a_duplicate(client: AsyncClient) -> None:
    token = await _login(client)

    response = await client.post(
        "/api/v1/me/profiles", headers=_headers(token), json={"kind": "specialist"}
    )

    assert response.status_code == 200
    body = response.json()
    assert body["role"] == "patient"
    assert body["profiles"] == [{"kind": "patient"}, {"kind": "specialist"}]

    duplicate = await client.post(
        "/api/v1/me/profiles", headers=_headers(token), json={"kind": "specialist"}
    )
    assert duplicate.status_code == 409
    assert duplicate.json()["message"] == "This account already holds that Profile"


async def test_a_staff_token_cannot_use_the_account_settings_surface(
    client: AsyncClient, state: AppState
) -> None:
    admin = await _make_user(state, "admin")

    response = await client.get(
        "/api/v1/me",
        headers=_headers(create_access_token(state, admin.id, admin.role, scope=STAFF_SCOPE)),
    )

    assert response.status_code == 403


async def test_a_new_profile_is_written_beside_the_old_role(
    client: AsyncClient, state: AppState
) -> None:
    token = await _login(client)
    await client.post("/api/v1/me/profiles", headers=_headers(token), json={"kind": "supplier"})

    async with state.db_session_maker() as session:
        user = (
            await session.execute(select(User).where(User.email == PATIENTS[0]["email"]))
        ).scalar_one()
        kinds = list(
            (
                await session.execute(select(Profile.kind).where(Profile.user_id == user.id))
            ).scalars()
        )

    assert user.role == "patient"
    assert sorted(kinds) == ["patient", "supplier"]


async def test_the_home_country_points_at_a_real_country(
    client: AsyncClient, state: AppState
) -> None:
    token = await _login(client)
    await client.patch("/api/v1/me", headers=_headers(token), json={"home_country_code": "NG"})

    async with state.db_session_maker() as session:
        user = (
            await session.execute(select(User).where(User.email == PATIENTS[0]["email"]))
        ).scalar_one()
        country = await session.get(Country, user.home_country_code)

    assert country is not None
    assert country.currency == "NGN"
