"""CPD training API tests.

The catalogue is public and per-market, and a Course's country is set by the
server, never the caller. These assert the read contract a course card, a
webinar rail, and two detail pages render from - exact money with a currency on
every priced row, a free course with a null price, the delivery-mode and
subdivision filters, the webinars' upcoming/archive behaviour - and the two
capability answers: an unknown or disabled market 503s explicitly rather than
pretend there is no training (Nigeria is seeded disabled).
"""

from __future__ import annotations

from decimal import Decimal
from typing import Any

from httpx import AsyncClient
from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.repositories.country import CountryFeature

BASE = "/api/v1"
KE = {"Accept-Country": "KE"}
NG = {"Accept-Country": "NG"}


async def _list_courses(
    client: AsyncClient,
    *,
    headers: dict[str, str] = KE,
    **params: str,
) -> dict[str, Any]:
    response = await client.get(f"{BASE}/training/courses", params=params, headers=headers)
    assert response.status_code == 200
    return response.json()


async def _list_webinars(
    client: AsyncClient,
    *,
    headers: dict[str, str] = KE,
    **params: str,
) -> dict[str, Any]:
    response = await client.get(f"{BASE}/training/webinars", params=params, headers=headers)
    assert response.status_code == 200
    return response.json()


async def _course_id(client: AsyncClient, title: str) -> str:
    body = await _list_courses(client)
    return next(item["id"] for item in body["items"] if item["title"] == title)


# --- /training/courses list ------------------------------------------------------


async def test_course_list_serves_the_market(client: AsyncClient) -> None:
    body = await _list_courses(client)

    assert body["country_code"] == "KE"
    assert body["currency"] == "KES"
    assert body["total"] == 5
    assert body["limit"] == 12
    assert body["offset"] == 0

    titles = [item["title"] for item in body["items"]]
    assert len(titles) == 5
    assert "Rotative Endodontics Essentials" in titles
    assert "Hands-on Suturing Refresher" in titles


async def test_course_list_reports_the_card_contract(client: AsyncClient) -> None:
    body = await _list_courses(client)
    endo = next(
        item for item in body["items"] if item["title"] == "Rotative Endodontics Essentials"
    )

    assert endo["provider"]["name"] == "Nairobi Dental Academy"
    assert endo["provider"]["is_verified"] is True
    assert endo["subdivision_code"] == "NAIROBI"
    assert endo["delivery_mode"] == "in_person"

    # Money stays exact and carries its currency (root AGENTS.md rule).
    assert Decimal(str(endo["price"])) == Decimal("45000.00")
    assert endo["currency"] == "KES"


async def test_course_price_is_nullable_for_free_cpd(client: AsyncClient) -> None:
    body = await _list_courses(client)
    free = next(
        item for item in body["items"] if item["title"] == "Hands-on Suturing Refresher"
    )

    assert free["price"] is None
    assert free["currency"] is None


async def test_course_list_filters_by_subdivision(client: AsyncClient) -> None:
    body = await _list_courses(client, subdivision_code="MOMBASA")

    assert body["total"] == 1
    assert body["items"][0]["title"] == "Clear Aligner Case Planning"


async def test_course_list_filters_by_delivery_mode(client: AsyncClient) -> None:
    body = await _list_courses(client, delivery_mode="online")

    assert body["total"] == 2
    assert {item["title"] for item in body["items"]} == {
        "Implant Planning for the General Dentist",
        "Digital Impressions & CAD/CAM",
    }


async def test_course_list_filters_by_provider(client: AsyncClient) -> None:
    body = await _list_courses(client, provider="nairobi dental academy")

    assert body["total"] == 2
    assert {item["title"] for item in body["items"]} == {
        "Rotative Endodontics Essentials",
        "Clear Aligner Case Planning",
    }


async def test_course_combined_filters_predate_to_an_empty_page(client: AsyncClient) -> None:
    """A mode with no courses in a subdivision is an empty page, not a 404."""
    response = await client.get(
        f"{BASE}/training/courses",
        params={"subdivision_code": "MOMBASA", "delivery_mode": "online"},
        headers=KE,
    )

    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 0
    assert body["items"] == []


async def test_course_list_query_country_beats_the_header(client: AsyncClient) -> None:
    """The query names the market being asked about; the header is ambient.

    NG has training switched off, so this also proves the query resolves KE even
    when the ambient header names a disabled market.
    """
    response = await client.get(
        f"{BASE}/training/courses",
        params={"country": "KE"},
        headers=NG,
    )

    assert response.status_code == 200
    body = response.json()
    assert body["country_code"] == "KE"
    assert body["currency"] == "KES"


async def test_course_list_paginates(client: AsyncClient) -> None:
    first = await _list_courses(client, limit="2")
    assert first["total"] == 5
    assert first["limit"] == 2
    assert first["items"][0]["title"] != first["items"][1]["title"]

    second = await _list_courses(client, limit="2", offset="2")
    assert len(second["items"]) == 2

    combined = {first["items"][i]["title"] for i in range(2)} | {
        second["items"][i]["title"] for i in range(2)
    }
    assert len(combined) == 4


# --- /training/courses/{id} ------------------------------------------------------


async def test_course_detail_returns_the_course(client: AsyncClient) -> None:
    course_id = await _course_id(client, "Implant Planning for the General Dentist")

    response = await client.get(f"{BASE}/training/courses/{course_id}", headers=KE)
    assert response.status_code == 200

    body = response.json()
    assert body["title"] == "Implant Planning for the General Dentist"
    assert body["description"]
    assert body["provider"]["name"] == "DentHub Learning"
    assert body["subdivision_code"] == "NAIROBI"
    assert body["delivery_mode"] == "online"
    assert Decimal(str(body["price"])) == Decimal("32000.00")
    assert body["currency"] == "KES"


async def test_course_detail_unknown_id_is_a_404(client: AsyncClient) -> None:
    response = await client.get(f"{BASE}/training/courses/does-not-exist", headers=KE)

    assert response.status_code == 404
    assert response.json()["code"] == 404


# --- /training/webinars list ------------------------------------------------------


async def test_webinar_list_keeps_the_archive_by_default(client: AsyncClient) -> None:
    """A past webinar must not vanish: the default serves the whole timeline."""
    body = await _list_webinars(client)

    assert body["country_code"] == "KE"
    assert body["total"] == 3

    # Upcoming first (ascending by start), then the past one.
    assert [item["title"] for item in body["items"]] == [
        "Infection Control Update 2026",
        "Running a Modern Dental Practice",
        "Articulation in Complete Dentures",
    ]

    # The card contract for the upcoming webinar.
    webinar = body["items"][0]
    assert webinar["provider"]["name"] == "Nairobi Dental Academy"
    assert webinar["join_url"]
    assert "scheduled_start" in webinar


async def test_webinar_list_upcoming_and_past_filters(client: AsyncClient) -> None:
    upcoming = await _list_webinars(client, upcoming="upcoming")
    assert upcoming["total"] == 2
    assert {item["title"] for item in upcoming["items"]} == {
        "Infection Control Update 2026",
        "Running a Modern Dental Practice",
    }

    past = await _list_webinars(client, upcoming="past")
    assert past["total"] == 1
    assert past["items"][0]["title"] == "Articulation in Complete Dentures"


async def test_webinar_list_filters_by_provider(client: AsyncClient) -> None:
    body = await _list_webinars(client, provider="denthub learning")

    assert body["total"] == 1
    assert body["items"][0]["title"] == "Running a Modern Dental Practice"


# --- /training/webinars/{id} ------------------------------------------------------


async def test_webinar_detail_returns_the_webinar(client: AsyncClient) -> None:
    body = await _list_webinars(client)
    webinar_id = body["items"][0]["id"]

    response = await client.get(f"{BASE}/training/webinars/{webinar_id}", headers=KE)
    assert response.status_code == 200

    detail = response.json()
    assert detail["title"] == "Infection Control Update 2026"
    assert detail["provider"]["name"] == "Nairobi Dental Academy"
    assert detail["join_url"] == "https://denthub.test/webinar/infection-control"


async def test_webinar_detail_unknown_id_is_a_404(client: AsyncClient) -> None:
    response = await client.get(f"{BASE}/training/webinars/does-not-exist", headers=KE)

    assert response.status_code == 404
    assert response.json()["code"] == 404


# --- capability answers ------------------------------------------------------------


async def test_training_unknown_market_503s_explicitly(client: AsyncClient) -> None:
    response = await client.get(
        f"{BASE}/training/courses",
        headers={"Accept-Country": "XX"},
    )

    assert response.status_code == 503
    body = response.json()
    assert body["code"] == 503
    assert body["message"] == "Country configuration is unavailable"


async def test_training_nigeria_is_seeded_disabled(client: AsyncClient) -> None:
    """The seeded disabled market says so instead of pretending training exists."""
    response = await client.get(f"{BASE}/training/courses", headers=NG)

    assert response.status_code == 503
    body = response.json()
    assert body["code"] == 503
    assert body["message"] == "CPD training is not available in this country"


async def test_training_disabled_market_503s_explicitly(
    client: AsyncClient,
    session_maker: async_sessionmaker[AsyncSession],
) -> None:
    """A market that switches training off says so instead of looking empty."""
    async with session_maker() as session:
        await session.execute(
            update(CountryFeature)
            .where(
                CountryFeature.country_code == "KE",
                CountryFeature.feature == "CPD_TRAINING",
            )
            .values(is_enabled=False)
        )
        await session.commit()

    response = await client.get(f"{BASE}/training/webinars", headers=KE)

    assert response.status_code == 503
    body = response.json()
    assert body["code"] == 503
    assert body["message"] == "CPD training is not available in this country"