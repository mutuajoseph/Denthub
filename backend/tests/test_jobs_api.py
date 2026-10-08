"""Jobs board API tests.

The board is public and per-market. These assert the read contract a card and a
detail page render from - only published postings, exact money, filters, the
Workplace the posting belongs to - and the two capability answers: an unknown
market and a market with the board disabled both 503 explicitly rather than
pretend there are no jobs.
"""

from __future__ import annotations

from decimal import Decimal
from typing import Any

from httpx import AsyncClient
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.repositories.country import CountryFeature
from app.repositories.job import JobPosting

BASE = "/api/v1"
KE = {"Accept-Country": "KE"}
NG = {"Accept-Country": "NG"}


async def _list_jobs(
    client: AsyncClient,
    *,
    headers: dict[str, str] = KE,
    **params: str,
) -> dict[str, Any]:
    response = await client.get(f"{BASE}/jobs", params=params, headers=headers)
    assert response.status_code == 200
    return response.json()


async def _posting_id(client: AsyncClient, title: str) -> str:
    body = await _list_jobs(client)
    return next(item["id"] for item in body["items"] if item["title"] == title)


# --- /jobs list ----------------------------------------------------------------


async def test_job_list_serves_only_published_for_the_market(client: AsyncClient) -> None:
    body = await _list_jobs(client)

    assert body["country_code"] == "KE"
    assert body["currency"] == "KES"
    assert body["total"] == 3
    assert body["limit"] == 12
    assert body["offset"] == 0

    # Newest first (posted_at is fixed in the factory data).
    titles = [item["title"] for item in body["items"]]
    assert titles == ["Associate Dentist", "Dental Nurse", "Practice Manager"]
    # The draft row is created but must never surface.
    assert "Draft Role" not in titles


async def test_job_list_reports_the_card_contract(client: AsyncClient) -> None:
    body = await _list_jobs(client)
    associate = next(item for item in body["items"] if item["title"] == "Associate Dentist")

    assert associate["employment_type"] == "Full Time"
    assert associate["seniority"] == "Mid Level"
    assert associate["specialty_codes"] == ["general-dentistry", "orthodontics"]
    assert associate["workplace"]["facility_name"] == "Smile Point Dental"
    assert associate["workplace"]["branch_name"] == "Westlands"
    assert associate["workplace"]["subdivision_code"] == "NAIROBI"
    assert associate["workplace"]["address"] == "Kileleshwa Road, Nairobi"
    assert associate["workplace"]["phone"] == "+254 711 000 111"

    # Money stays exact: two decimal places, and the currency is always present.
    salary = associate["salary_range"]
    assert salary is not None
    assert salary["currency"] == "KES"
    assert Decimal(str(salary["min_amount"])) == Decimal("120000.00")
    assert Decimal(str(salary["max_amount"])) == Decimal("180000.00")


async def test_job_list_handles_one_sided_and_missing_salary(client: AsyncClient) -> None:
    body = await _list_jobs(client)
    by_title = {item["title"]: item for item in body["items"]}

    nurse = by_title["Dental Nurse"]
    nurse_salary = nurse["salary_range"]
    assert nurse_salary is not None
    assert nurse_salary["currency"] == "KES"
    assert Decimal(str(nurse_salary["min_amount"])) == Decimal("40000.00")
    assert nurse_salary["max_amount"] is None

    manager = by_title["Practice Manager"]
    assert manager["salary_range"] is None


async def test_job_list_filters_by_subdivision(client: AsyncClient) -> None:
    body = await _list_jobs(client, subdivision_code="MOMBASA")

    assert body["total"] == 1
    assert body["items"][0]["title"] == "Practice Manager"


async def test_job_list_filters_by_specialty(client: AsyncClient) -> None:
    body = await _list_jobs(client, specialty_code="orthodontics")

    assert body["total"] == 1
    assert body["items"][0]["title"] == "Associate Dentist"


async def test_job_list_combined_filters_predate_to_an_empty_page(client: AsyncClient) -> None:
    """A specialty with no posts in a subdivision is an empty page, not a 404."""
    response = await client.get(
        f"{BASE}/jobs",
        params={"subdivision_code": "MOMBASA", "specialty_code": "orthodontics"},
        headers=KE,
    )

    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 0
    assert body["items"] == []


async def test_job_list_is_exactly_one_market(client: AsyncClient) -> None:
    body = await _list_jobs(client, headers=NG)

    assert body["country_code"] == "NG"
    assert body["currency"] == "NGN"
    assert body["total"] == 1

    orthodontist = body["items"][0]
    assert orthodontist["title"] == "Orthodontist"
    assert orthodontist["workplace"]["facility_name"] == "Lagos Pearl Dental"
    assert orthodontist["workplace"]["branch_name"] == "Victoria Island"
    salary = orthodontist["salary_range"]
    assert salary is not None
    assert salary["currency"] == "NGN"
    assert Decimal(str(salary["min_amount"])) == Decimal("600000.00")


async def test_job_list_query_country_beats_the_header(client: AsyncClient) -> None:
    """The query names the market being asked about; the header is ambient."""
    response = await client.get(
        f"{BASE}/jobs",
        params={"country": "KE"},
        headers=NG,
    )

    body = response.json()
    assert response.status_code == 200
    assert body["country_code"] == "KE"
    assert body["currency"] == "KES"


async def test_job_list_paginates(client: AsyncClient) -> None:
    first = await _list_jobs(client, limit="2")
    assert first["total"] == 3
    assert first["limit"] == 2
    assert [item["title"] for item in first["items"]] == ["Associate Dentist", "Dental Nurse"]

    second = await _list_jobs(client, limit="2", offset="2")
    assert [item["title"] for item in second["items"]] == ["Practice Manager"]


# --- /jobs/{id} ----------------------------------------------------------------


async def test_job_detail_returns_the_posting(client: AsyncClient) -> None:
    posting_id = await _posting_id(client, "Associate Dentist")

    response = await client.get(f"{BASE}/jobs/{posting_id}", headers=KE)
    assert response.status_code == 200

    body = response.json()
    assert body["title"] == "Associate Dentist"
    assert body["description"]
    assert body["requirements"].startswith("BDS")
    assert body["workplace"]["facility_name"] == "Smile Point Dental"
    assert [code for code in body["specialty_codes"]] == [
        "general-dentistry",
        "orthodontics",
    ]


async def test_job_detail_never_serves_a_draft(
    client: AsyncClient,
    session_maker: async_sessionmaker[AsyncSession],
) -> None:
    async with session_maker() as session:
        draft = (
            (await session.execute(select(JobPosting).where(JobPosting.status == "draft")))
            .scalars()
            .first()
        )
        assert draft is not None

    response = await client.get(f"{BASE}/jobs/{draft.id}", headers=KE)

    assert response.status_code == 404
    assert response.json()["code"] == 404


async def test_job_detail_unknown_id_is_a_404(client: AsyncClient) -> None:
    response = await client.get(f"{BASE}/jobs/does-not-exist", headers=KE)

    assert response.status_code == 404
    assert response.json()["code"] == 404


# --- capability answers ---------------------------------------------------------


async def test_jobs_unknown_market_503s_explicitly(client: AsyncClient) -> None:
    response = await client.get(
        f"{BASE}/jobs",
        headers={"Accept-Country": "XX"},
    )

    assert response.status_code == 503
    body = response.json()
    assert body["code"] == 503
    assert body["message"] == "Country configuration is unavailable"


async def test_jobs_disabled_market_503s_explicitly(
    client: AsyncClient,
    session_maker: async_sessionmaker[AsyncSession],
) -> None:
    """A market that switched the board off says so instead of looking empty."""
    async with session_maker() as session:
        await session.execute(
            update(CountryFeature)
            .where(
                CountryFeature.country_code == "KE",
                CountryFeature.feature == "JOBS_BOARD",
            )
            .values(is_enabled=False)
        )
        await session.commit()

    response = await client.get(f"{BASE}/jobs", headers=KE)

    assert response.status_code == 503
    body = response.json()
    assert body["code"] == 503
    assert body["message"] == "The jobs board is not available in this country"
