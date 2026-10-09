"""Home API tests: the featured slice and the headline statistics.

The acceptance rule is that every number a patient reads on the Home page comes
from these two endpoints: the cards are the same ``DentistListing`` rows the
search pages return, and the counts are the active market's own - zeroes for a
country with nothing in it, not another market's numbers.
"""

from __future__ import annotations

from decimal import Decimal
from typing import Any

from httpx import AsyncClient

BASE = "/api/v1"
KE = {"Accept-Country": "KE"}
NG = {"Accept-Country": "NG"}


async def _featured(
    client: AsyncClient,
    headers: dict[str, str] | None = None,
    **params: str,
) -> dict[str, Any]:
    response = await client.get(f"{BASE}/home/featured", params=params, headers=headers or KE)
    assert response.status_code == 200
    return response.json()


async def _stats(
    client: AsyncClient,
    headers: dict[str, str] | None = None,
    **params: str,
) -> dict[str, Any]:
    response = await client.get(f"{BASE}/home/stats", params=params, headers=headers or KE)
    assert response.status_code == 200
    return response.json()


# --- /home/featured ------------------------------------------------------------


async def test_featured_returns_the_markets_ranked_cards(client: AsyncClient) -> None:
    body = await _featured(client)

    assert body["country_code"] == "KE"
    assert body["currency"] == "KES"
    # Ranked by rating, unrated last: the specialist (4.90) leads the clinic
    # (4.80), and the unrated clinic brings up the rear.
    assert [item["name"] for item in body["items"]] == [
        "Dr. Amina Otieno",
        "Smile Point Dental",
        "Nyali Coastal Dental",
    ]

    lead = body["items"][0]
    assert lead["listing_type"] == "specialist"
    assert Decimal(str(lead["rating"])) == Decimal("4.90")
    assert lead["clinic_name"] == "Smile Point Dental"

    clinic = body["items"][1]
    assert clinic["listing_type"] == "facility"
    assert Decimal(str(clinic["list_price"])) == Decimal("2500.00")
    assert clinic["verification_tier"] == "verified"


async def test_featured_respects_the_active_market(client: AsyncClient) -> None:
    body = await _featured(client, headers=NG)

    assert body["country_code"] == "NG"
    assert body["currency"] == "NGN"
    assert [item["name"] for item in body["items"]] == ["Lagos Pearl Dental", "Dr. Chidi Okafor"]


async def test_featured_is_short_and_bound_by_limit(client: AsyncClient) -> None:
    assert len((await _featured(client))["items"]) == 3

    body = await _featured(client, limit="2")
    assert [item["name"] for item in body["items"]] == ["Dr. Amina Otieno", "Smile Point Dental"]


async def test_featured_in_an_unknown_country_is_empty_not_an_error(
    client: AsyncClient,
) -> None:
    body = await _featured(client, country="ZZ")

    assert body["country_code"] == "ZZ"
    assert body["items"] == []


# --- /home/stats ---------------------------------------------------------------


async def test_stats_are_scoped_per_country(client: AsyncClient) -> None:
    ke = await _stats(client)
    assert ke == {
        "country_code": "KE",
        "clinics_listed": 2,
        "verified_clinics": 1,
        "specialists": 1,
        "counties_covered": 2,
    }

    # Kenya's "unverified" clinic does not count as verified; Nigeria's "basic"
    # one does - the tier, not the market, decides what "verified" means.
    ng = await _stats(client, headers=NG)
    assert ng == {
        "country_code": "NG",
        "clinics_listed": 1,
        "verified_clinics": 1,
        "specialists": 1,
        "counties_covered": 1,
    }


async def test_stats_query_country_beats_the_header(client: AsyncClient) -> None:
    body = await _stats(client, headers=NG, country="KE")

    assert body["country_code"] == "KE"
    assert body["clinics_listed"] == 2


async def test_stats_for_a_country_with_no_data_are_zeroes_not_nulls(
    client: AsyncClient,
) -> None:
    body = await _stats(client, country="ZZ")
    assert body == {
        "country_code": "ZZ",
        "clinics_listed": 0,
        "verified_clinics": 0,
        "specialists": 0,
        "counties_covered": 0,
    }