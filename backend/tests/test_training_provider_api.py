"""HTTP tests for the training-provider dashboard (#79).

A training-provider account self-serves its own provider and manages only its
own Courses and webinars; the dashboard reports derived stats and CPD points.
The role gate and every error the routes document are covered here.
"""

from __future__ import annotations

import uuid
from typing import Any

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import async_sessionmaker

from app.logic.v1.auth import create_access_token, hash_password
from app.repositories.user import UserRepository
from app.utils.state import AppState

_BASE = "/api/v1/training/me"

_PROVIDER = {"name": "Nairobi CPD Collective"}

_COURSE: dict[str, Any] = {
    "title": "Rotary Endo Refresher",
    "description": "A hands-on day of rotary endodontics.",
    "subdivision_code": "NAIROBI",
    "delivery_mode": "in_person",
    "price": "45000.00",
    "cpd_points": 6,
}

_WEBINAR: dict[str, Any] = {
    "title": "Infection Control Update",
    "description": "The year's sterilisation changes.",
    "join_url": "https://denthub.test/webinar/infection-control",
    "scheduled_start": "2026-11-01T10:00:00",
    "cpd_points": 2,
}


async def _account(
    state: AppState,
    session_maker: async_sessionmaker[Any],
    *,
    role: str = "training_provider",
    is_active: bool = True,
) -> dict[str, str]:
    """Create a user directly and return their bearer auth header."""
    async with session_maker() as session:
        user = await UserRepository.create(
            session,
            full_name="Provider Owner",
            email=f"{role}-{uuid.uuid4().hex[:8]}@example.com",
            password_hash=hash_password("correct horse battery staple"),
            role=role,
            is_active=is_active,
        )
        await session.commit()

    token = create_access_token(state, user.id, role)
    return {"Authorization": f"Bearer {token}"}


async def _create_provider(
    client: AsyncClient,
    headers: dict[str, str],
    *,
    name: str = "Nairobi CPD Collective",
    country: str = "KE",
) -> Any:
    return await client.post(
        _BASE,
        headers={**headers, "Accept-Country": country},
        json={"name": name},
    )


async def _add_course(
    client: AsyncClient,
    headers: dict[str, str],
    **overrides: Any,
) -> Any:
    payload = {**_COURSE, **overrides}
    return await client.post(f"{_BASE}/courses", headers=headers, json=payload)


async def _add_webinar(
    client: AsyncClient,
    headers: dict[str, str],
    **overrides: Any,
) -> Any:
    payload = {**_WEBINAR, **overrides}
    return await client.post(f"{_BASE}/webinars", headers=headers, json=payload)


# --- The dashboard's own state -----------------------------------------------


async def test_dashboard_is_404_until_a_provider_is_created(
    client: AsyncClient,
    state: AppState,
    session_maker: async_sessionmaker[Any],
) -> None:
    headers = await _account(state, session_maker)

    response = await client.get(_BASE, headers=headers)

    assert response.status_code == 404
    assert response.json()["message"] == "Training provider not found"


async def test_create_provider_uses_the_header_country_and_starts_unverified(
    client: AsyncClient,
    state: AppState,
    session_maker: async_sessionmaker[Any],
) -> None:
    headers = await _account(state, session_maker)

    response = await _create_provider(client, headers, country="ng")

    assert response.status_code == 200
    body = response.json()
    assert body["provider"]["name"] == "Nairobi CPD Collective"
    assert body["provider"]["country_code"] == "NG"
    assert body["provider"]["is_verified"] is False
    assert body["stats"] == {
        "course_count": 0,
        "webinar_count": 0,
        "upcoming_webinar_count": 0,
        "total_cpd_points": 0,
    }


async def test_a_second_provider_for_one_account_is_a_conflict(
    client: AsyncClient,
    state: AppState,
    session_maker: async_sessionmaker[Any],
) -> None:
    headers = await _account(state, session_maker)
    assert (await _create_provider(client, headers)).status_code == 200

    response = await _create_provider(client, headers)

    assert response.status_code == 409
    assert response.json()["message"] == "This account already has a training provider"


async def test_create_provider_rejects_a_non_iso_country(
    client: AsyncClient,
    state: AppState,
    session_maker: async_sessionmaker[Any],
) -> None:
    headers = await _account(state, session_maker)

    response = await _create_provider(client, headers, country="Kenya")

    assert response.status_code == 400
    assert response.json()["message"] == "Country must be a 2-letter ISO code"


async def test_create_provider_requires_a_name(
    client: AsyncClient,
    state: AppState,
    session_maker: async_sessionmaker[Any],
) -> None:
    headers = await _account(state, session_maker)

    response = await client.post(_BASE, headers=headers, json={})

    assert response.status_code == 422


# --- Role gate ---------------------------------------------------------------


async def test_only_training_provider_accounts_may_use_the_dashboard(
    client: AsyncClient,
    state: AppState,
    session_maker: async_sessionmaker[Any],
) -> None:
    for role in ("patient", "dentist", "admin"):
        headers = await _account(state, session_maker, role=role)
        response = await client.get(_BASE, headers=headers)
        assert response.status_code == 403
        assert (
            response.json()["message"]
            == "Only training provider accounts may manage a training dashboard"
        )


async def test_a_deactivated_account_is_forbidden(
    client: AsyncClient,
    state: AppState,
    session_maker: async_sessionmaker[Any],
) -> None:
    headers = await _account(state, session_maker, is_active=False)

    response = await client.get(_BASE, headers=headers)

    assert response.status_code == 403
    assert response.json()["message"] == "User account is deactivated"


async def test_the_dashboard_requires_a_token(client: AsyncClient) -> None:
    for path in (_BASE, f"{_BASE}/courses", f"{_BASE}/webinars"):
        response = await client.get(path)
        assert response.status_code == 401, path


# --- Courses -----------------------------------------------------------------


async def test_courses_are_empty_before_any_are_added(
    client: AsyncClient,
    state: AppState,
    session_maker: async_sessionmaker[Any],
) -> None:
    headers = await _account(state, session_maker)
    await _create_provider(client, headers)

    response = await client.get(f"{_BASE}/courses", headers=headers)

    assert response.status_code == 200
    assert response.json() == {"items": [], "total": 0, "limit": 48, "offset": 0}


async def test_a_created_course_keeps_money_exact_and_inherits_the_market(
    client: AsyncClient,
    state: AppState,
    session_maker: async_sessionmaker[Any],
) -> None:
    headers = await _account(state, session_maker)
    await _create_provider(client, headers, country="KE")

    response = await _add_course(client, headers)

    assert response.status_code == 200
    body = response.json()
    assert body["title"] == "Rotary Endo Refresher"
    assert body["delivery_mode"] == "in_person"
    assert body["price"] == "45000.00"
    assert body["currency"] == "KES"
    assert body["country_code"] == "KE"
    assert body["cpd_points"] == 6


async def test_a_free_course_has_no_price_or_currency(
    client: AsyncClient,
    state: AppState,
    session_maker: async_sessionmaker[Any],
) -> None:
    headers = await _account(state, session_maker)
    await _create_provider(client, headers)

    response = await _add_course(client, headers, price=None, cpd_points=2)

    assert response.status_code == 200
    body = response.json()
    assert body["price"] is None
    assert body["currency"] is None
    assert body["cpd_points"] == 2


async def test_a_course_price_quantizes_to_two_places(
    client: AsyncClient,
    state: AppState,
    session_maker: async_sessionmaker[Any],
) -> None:
    headers = await _account(state, session_maker)
    await _create_provider(client, headers)

    response = await _add_course(client, headers, price="349.9")

    assert response.status_code == 200
    assert response.json()["price"] == "349.90"


async def test_course_currency_follows_the_accept_currency_header(
    client: AsyncClient,
    state: AppState,
    session_maker: async_sessionmaker[Any],
) -> None:
    headers = await _account(state, session_maker)
    await _create_provider(client, headers)

    response = await client.post(
        f"{_BASE}/courses",
        headers={**headers, "Accept-Currency": "usd"},
        json=_COURSE,
    )

    assert response.status_code == 200
    assert response.json()["currency"] == "USD"


# --- Stats and CPD -----------------------------------------------------------


async def test_stats_count_own_courses_and_split_webinars(
    client: AsyncClient,
    state: AppState,
    session_maker: async_sessionmaker[Any],
) -> None:
    headers = await _account(state, session_maker)
    await _create_provider(client, headers)
    await _add_course(client, headers, cpd_points=6)
    await _add_course(client, headers, price=None, cpd_points=2)
    # One upcoming (2026-11-01) and one already past.
    await _add_webinar(client, headers, scheduled_start="2026-11-01T10:00:00", cpd_points=2)
    await _add_webinar(client, headers, scheduled_start="2020-01-01T10:00:00", cpd_points=1)

    response = await client.get(_BASE, headers=headers)

    assert response.status_code == 200
    assert response.json()["stats"] == {
        "course_count": 2,
        "webinar_count": 2,
        "upcoming_webinar_count": 1,
        "total_cpd_points": 11,
    }


# --- Webinars ----------------------------------------------------------------


async def test_webinar_list_keeps_the_archive(
    client: AsyncClient,
    state: AppState,
    session_maker: async_sessionmaker[Any],
) -> None:
    headers = await _account(state, session_maker)
    await _create_provider(client, headers)
    await _add_webinar(client, headers, scheduled_start="2020-01-01T10:00:00")
    await _add_webinar(client, headers, scheduled_start="2026-11-01T10:00:00")

    response = await client.get(f"{_BASE}/webinars", headers=headers)

    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 2
    assert body["limit"] == 48
    # Soonest scheduled first, so the past one leads.
    assert body["items"][0]["cpd_points"] == 2


# --- Scoping -----------------------------------------------------------------


async def test_one_provider_cannot_see_or_edit_anothers_records(
    client: AsyncClient,
    state: AppState,
    session_maker: async_sessionmaker[Any],
) -> None:
    owner = await _account(state, session_maker)
    rival = await _account(state, session_maker)
    await _create_provider(client, owner, name="Owner CPD")
    await _create_provider(client, rival, name="Rival CPD")

    created = await _add_course(client, owner)
    course_id = created.json()["id"]

    rival_list = await client.get(f"{_BASE}/courses", headers=rival)
    rival_patch = await client.patch(
        f"{_BASE}/courses/{course_id}", headers=rival, json={"cpd_points": 9}
    )
    owner_list = await client.get(f"{_BASE}/courses", headers=owner)

    assert rival_list.json()["total"] == 0
    assert rival_patch.status_code == 404
    assert rival_patch.json()["message"] == "Training course not found"
    assert owner_list.json()["total"] == 1


# --- Update ------------------------------------------------------------------


async def test_patch_changes_only_the_fields_sent(
    client: AsyncClient,
    state: AppState,
    session_maker: async_sessionmaker[Any],
) -> None:
    headers = await _account(state, session_maker)
    await _create_provider(client, headers)
    course_id = (await _add_course(client, headers)).json()["id"]

    response = await client.patch(
        f"{_BASE}/courses/{course_id}",
        headers=headers,
        json={"cpd_points": 9},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["cpd_points"] == 9
    assert body["title"] == "Rotary Endo Refresher"
    assert body["price"] == "45000.00"


async def test_patch_cannot_blank_a_required_field(
    client: AsyncClient,
    state: AppState,
    session_maker: async_sessionmaker[Any],
) -> None:
    headers = await _account(state, session_maker)
    await _create_provider(client, headers)
    course_id = (await _add_course(client, headers)).json()["id"]

    response = await client.patch(
        f"{_BASE}/courses/{course_id}",
        headers=headers,
        json={"title": None, "description": None},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["title"] == "Rotary Endo Refresher"
    assert body["description"] == "A hands-on day of rotary endodontics."


async def test_patch_making_a_course_free_clears_the_currency(
    client: AsyncClient,
    state: AppState,
    session_maker: async_sessionmaker[Any],
) -> None:
    headers = await _account(state, session_maker)
    await _create_provider(client, headers)
    course_id = (await _add_course(client, headers)).json()["id"]

    response = await client.patch(
        f"{_BASE}/courses/{course_id}",
        headers=headers,
        json={"price": None},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["price"] is None
    assert body["currency"] is None


async def test_patching_an_unknown_course_is_404(
    client: AsyncClient,
    state: AppState,
    session_maker: async_sessionmaker[Any],
) -> None:
    headers = await _account(state, session_maker)
    await _create_provider(client, headers)

    response = await client.patch(f"{_BASE}/courses/{uuid.uuid4().hex}", headers=headers, json={})

    assert response.status_code == 404
    assert response.json()["message"] == "Training course not found"


# --- Requires a provider first ----------------------------------------------


async def test_records_need_a_provider_first(
    client: AsyncClient,
    state: AppState,
    session_maker: async_sessionmaker[Any],
) -> None:
    headers = await _account(state, session_maker)

    course = await _add_course(client, headers)
    webinar = await _add_webinar(client, headers)

    assert course.status_code == 404
    assert course.json()["message"] == "Training provider not found"
    assert webinar.status_code == 404
    assert webinar.json()["message"] == "Training provider not found"


async def test_invalid_course_bodies_are_rejected(
    client: AsyncClient,
    state: AppState,
    session_maker: async_sessionmaker[Any],
) -> None:
    headers = await _account(state, session_maker)
    await _create_provider(client, headers)

    cases: list[dict[str, Any]] = [
        {"title": ""},
        {"delivery_mode": "hybrid"},
        {"delivery_mode": None},
        {"cpd_points": -1},
        {"cpd_points": 10_000},
        {"price": "0"},
        {"price": "not-a-number"},
        {"subdivision_code": ""},
    ]

    for overrides in cases:
        response = await _add_course(client, headers, **overrides)
        assert response.status_code == 422, overrides
