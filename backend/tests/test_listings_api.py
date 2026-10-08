"""Listing API tests, plus the open-now rule they depend on.

The API cases assert the contract a client renders a card from - one shared
shape for a clinic and a specialist, exact money, filters, and ``open_now``.
The clock cases pin ``is_open_now`` with a fixed ``now_utc``, because an API
test can only assert the extremes (open every minute of the week, or closed on
every day) without freezing time.
"""

from __future__ import annotations

from datetime import UTC, datetime, time
from decimal import Decimal
from typing import Any

from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.logic.v1.listing import is_open_now
from app.repositories.listing import Branch, BranchRepository, OpeningHour

BASE = "/api/v1"
KE = {"Accept-Country": "KE"}
NG = {"Accept-Country": "NG"}

#: Wednesday 2026-10-07, 09:00 UTC = 12:00 in Nairobi, 10:00 in Lagos.
WEDNESDAY_MIDDAY_UTC = datetime(2026, 10, 7, 9, 0, tzinfo=UTC)
#: Wednesday 2026-10-07, 16:30 UTC = 19:30 in Nairobi: past closing there.
WEDNESDAY_EVENING_UTC = datetime(2026, 10, 7, 16, 30, tzinfo=UTC)
#: Tuesday 2026-10-06, 22:00 UTC = Wednesday 01:00 in Nairobi.
WEDNESDAY_SMALL_HOURS_UTC = datetime(2026, 10, 6, 22, 0, tzinfo=UTC)


async def _list_facilities(client: AsyncClient, **params: str) -> dict[str, Any]:
    response = await client.get(f"{BASE}/facilities", params=params, headers=KE)
    assert response.status_code == 200
    return response.json()


async def _facility_id(client: AsyncClient, name: str) -> str:
    body = await _list_facilities(client)
    return next(item["id"] for item in body["items"] if item["name"] == name)


async def _list_specialists(client: AsyncClient, **params: str) -> dict[str, Any]:
    response = await client.get(f"{BASE}/dentists", params=params, headers=KE)
    assert response.status_code == 200
    return response.json()


async def _specialist_id(client: AsyncClient, name: str) -> str:
    body = await _list_specialists(client)
    return next(item["id"] for item in body["items"] if item["name"] == name)


# --- /facilities ---------------------------------------------------------------


async def test_facility_list_reports_the_shared_card_contract(client: AsyncClient) -> None:
    body = await _list_facilities(client)

    assert body["country_code"] == "KE"
    assert body["currency"] == "KES"
    assert body["total"] == 2
    assert body["limit"] == 24
    assert body["offset"] == 0

    by_name = {item["name"]: item for item in body["items"]}
    smile_point = by_name["Smile Point Dental"]

    assert smile_point["listing_type"] == "facility"
    assert smile_point["specialty_codes"] == ["general-dentistry", "orthodontics"]
    assert smile_point["subdivision_code"] == "NAIROBI"
    assert smile_point["review_count"] == 37
    assert smile_point["currency"] == "KES"
    assert smile_point["open_now"] is True

    # Money stays exact: two decimal places, not float noise.
    assert Decimal(str(smile_point["list_price"])) == Decimal("2500.00")
    assert Decimal(str(smile_point["rating"])) == Decimal("4.80")

    nyali = by_name["Nyali Coastal Dental"]
    assert nyali["list_price"] is None
    assert nyali["rating"] is None
    assert nyali["review_count"] == 0
    assert nyali["open_now"] is False


async def test_facility_list_filters_by_subdivision(client: AsyncClient) -> None:
    body = await _list_facilities(client, subdivision_code="MOMBASA")

    assert body["total"] == 1
    assert body["items"][0]["name"] == "Nyali Coastal Dental"


async def test_facility_list_filters_by_verification_tier(client: AsyncClient) -> None:
    body = await _list_facilities(client, verification_tier="verified")

    assert body["total"] == 1
    assert body["items"][0]["name"] == "Smile Point Dental"


async def test_facility_list_query_country_beats_the_header(client: AsyncClient) -> None:
    """The query names the market being asked about; the header is ambient."""
    response = await client.get(
        f"{BASE}/facilities",
        params={"country": "KE"},
        headers=NG,
    )

    body = response.json()
    assert response.status_code == 200
    assert body["country_code"] == "KE"
    assert body["total"] == 2

    other = await client.get(f"{BASE}/facilities", headers=NG)
    assert other.json()["country_code"] == "NG"
    assert other.json()["currency"] == "NGN"
    assert other.json()["total"] == 1


async def test_facility_list_in_an_unknown_country_is_empty_not_an_error(
    client: AsyncClient,
) -> None:
    """A stale client degrades to an empty market rather than another market's clinics."""
    body = await _list_facilities(client, country="ZZ")

    assert body["country_code"] == "ZZ"
    assert body["total"] == 0
    assert body["items"] == []


async def test_facility_detail_nests_the_card_and_resolves_hours(client: AsyncClient) -> None:
    facility_id = await _facility_id(client, "Smile Point Dental")
    response = await client.get(f"{BASE}/facilities/{facility_id}", headers=KE)

    assert response.status_code == 200
    body = response.json()

    assert body["listing"]["listing_type"] == "facility"
    assert body["listing"]["open_now"] is True
    assert body["verification_tier"] == "verified"
    assert body["address"] == "Kileleshwa Road, Nairobi"
    assert body["email"] == "hello@smilepoint.test"

    branches = {branch["name"]: branch for branch in body["branches"]}
    assert set(branches) == {"Westlands", "24-Hour Emergency"}
    assert branches["24-Hour Emergency"]["open_now"] is True

    westlands = branches["Westlands"]
    assert westlands["facility_name"] == "Smile Point Dental"
    assert [hour["weekday"] for hour in westlands["hours"]] == list(range(7))
    assert westlands["hours"][0]["opens"] == "08:00"
    assert westlands["hours"][0]["closes"] == "17:00"
    assert westlands["hours"][5]["opens"] == "09:00"
    assert westlands["hours"][6]["opens"] is None
    assert westlands["hours"][6]["is_closed"] is True


async def test_closed_facility_detail_reports_its_explicit_closed_day(
    client: AsyncClient,
) -> None:
    facility_id = await _facility_id(client, "Nyali Coastal Dental")
    response = await client.get(f"{BASE}/facilities/{facility_id}", headers=KE)

    assert response.status_code == 200
    body = response.json()

    assert body["listing"]["open_now"] is False
    assert len(body["branches"]) == 1
    branch = body["branches"][0]
    assert branch["name"] is None
    assert branch["open_now"] is False
    assert branch["hours"] == [
        {
            "weekday": 6,
            "opens": None,
            "closes": None,
            "is_closed": True,
        }
    ]


async def test_unknown_facility_returns_404_envelope(client: AsyncClient) -> None:
    response = await client.get(f"{BASE}/facilities/does-not-exist", headers=KE)

    assert response.status_code == 404
    body = response.json()
    assert body["code"] == 404
    assert body["message"] == "Facility not found"
    assert "detail" in body


# --- /dentists -----------------------------------------------------------------


async def test_specialist_list_reuses_the_same_card(client: AsyncClient) -> None:
    body = await _list_specialists(client)

    assert body["country_code"] == "KE"
    assert body["currency"] == "KES"
    assert body["total"] == 1

    item = body["items"][0]
    assert item["listing_type"] == "specialist"
    assert item["name"] == "Dr. Amina Otieno"
    assert item["specialty_codes"] == ["general-dentistry", "orthodontics"]
    assert item["open_now"] is True
    assert Decimal(str(item["list_price"])) == Decimal("3500.00")
    assert Decimal(str(item["rating"])) == Decimal("4.90")


async def test_specialist_list_filters_by_specialty(client: AsyncClient) -> None:
    matched = await _list_specialists(client, specialty_code="orthodontics")
    assert matched["total"] == 1
    assert matched["items"][0]["name"] == "Dr. Amina Otieno"

    empty = await _list_specialists(client, specialty_code="paediatric-dentistry")
    assert empty["total"] == 0
    assert empty["items"] == []


async def test_specialist_list_reads_the_markets_own_rows(client: AsyncClient) -> None:
    response = await client.get(f"{BASE}/dentists", headers=NG)

    body = response.json()
    assert body["country_code"] == "NG"
    assert body["currency"] == "NGN"
    assert body["total"] == 1
    # Lagos Pearl's branch publishes no hours, so nobody is open there.
    assert body["items"][0]["open_now"] is False


async def test_specialist_detail_carries_specialties_and_branches(client: AsyncClient) -> None:
    specialist_id = await _specialist_id(client, "Dr. Amina Otieno")
    response = await client.get(f"{BASE}/dentists/{specialist_id}", headers=KE)

    assert response.status_code == 200
    body = response.json()

    assert body["slug"] == "amina-otieno"
    assert [row["code"] for row in body["specialties"]] == [
        "general-dentistry",
        "orthodontics",
    ]
    assert body["listing"]["specialty_codes"] == ["general-dentistry", "orthodontics"]

    assert len(body["branches"]) == 1
    assert body["branches"][0]["facility_name"] == "Smile Point Dental"
    assert body["branches"][0]["open_now"] is True


async def test_unknown_specialist_returns_404_envelope(client: AsyncClient) -> None:
    response = await client.get(f"{BASE}/dentists/does-not-exist", headers=KE)

    assert response.status_code == 404
    body = response.json()
    assert body["code"] == 404
    assert body["message"] == "Specialist not found"
    assert "detail" in body


# --- open now ------------------------------------------------------------------


def _weekday_hours(weekday: int, opens: str, closes: str) -> list[OpeningHour]:
    """One day's hours, with the numbering ``datetime.weekday()`` uses."""
    return [
        OpeningHour(
            weekday=weekday,
            opens=datetime.strptime(opens, "%H:%M").time(),
            closes=datetime.strptime(closes, "%H:%M").time(),
            is_closed=False,
        )
    ]


def test_open_now_reads_the_local_clock_not_utc() -> None:
    """16:30 UTC is 19:30 in Nairobi: past a 17:00 close."""
    hours = _weekday_hours(2, "08:00", "17:00")

    assert (
        is_open_now(hours, timezone_name="Africa/Nairobi", now_utc=WEDNESDAY_MIDDAY_UTC) is True
    )
    assert (
        is_open_now(hours, timezone_name="Africa/Nairobi", now_utc=WEDNESDAY_EVENING_UTC) is False
    )


def test_open_now_closes_on_a_day_with_no_row() -> None:
    """Wednesday's hours say nothing about Thursday, so Thursday is closed."""
    hours = _weekday_hours(2, "08:00", "17:00")
    thursday_midday = datetime(2026, 10, 8, 9, 0, tzinfo=UTC)

    assert is_open_now(hours, timezone_name="Africa/Nairobi", now_utc=thursday_midday) is False


def test_open_now_treats_an_explicit_closed_row_as_closed() -> None:
    hours = [OpeningHour(weekday=2, opens=None, closes=None, is_closed=True)]

    assert (
        is_open_now(hours, timezone_name="Africa/Nairobi", now_utc=WEDNESDAY_MIDDAY_UTC) is False
    )


def test_open_now_handles_a_shift_that_crosses_midnight() -> None:
    """A 20:00-02:00 row is open at 21:00 today and at 01:00 tomorrow's morning."""
    hours = _weekday_hours(2, "20:00", "02:00")

    # Wednesday 18:00 UTC = Wednesday 21:00 in Nairobi: the shift has started.
    assert (
        is_open_now(
            hours,
            timezone_name="Africa/Nairobi",
            now_utc=datetime(2026, 10, 7, 18, 0, tzinfo=UTC),
        )
        is True
    )
    # Wednesday 01:00 in Nairobi, with no Tuesday row: nothing is running.
    assert (
        is_open_now(hours, timezone_name="Africa/Nairobi", now_utc=WEDNESDAY_SMALL_HOURS_UTC)
        is False
    )


def test_open_now_extends_yesterdays_midnight_crossing_shift_into_today() -> None:
    """Tuesday's 20:00-02:00 shift is still running at 01:00 on Wednesday."""
    hours = _weekday_hours(1, "20:00", "02:00")

    assert (
        is_open_now(hours, timezone_name="Africa/Nairobi", now_utc=WEDNESDAY_SMALL_HOURS_UTC)
        is True
    )


# --- replace hours --------------------------------------------------------------


async def test_replace_hours_is_idempotent(
    session_maker: async_sessionmaker[AsyncSession],
) -> None:
    """Re-running the same week must not trip the (branch_id, weekday) constraint.

    The seed calls ``replace_hours`` on every run, so a branch that already has
    hours has to lose its old rows before the new ones land: a delete and an
    insert of the same weekday in one flush can execute insert-first.
    """
    week = [
        (0, time(9, 0), time(17, 0), False),
        (1, time(9, 0), time(17, 0), False),
        (2, None, None, True),
    ]

    async with session_maker() as session:
        branch = (await session.execute(select(Branch).limit(1))).scalars().first()
        assert branch is not None

        await BranchRepository.replace_hours(session, branch.id, week)
        await BranchRepository.replace_hours(session, branch.id, week)
        await session.commit()

        rows = (
            await session.execute(
                select(OpeningHour).where(OpeningHour.branch_id == branch.id)
            )
        ).scalars().all()

    assert sorted(row.weekday for row in rows) == [0, 1, 2]
