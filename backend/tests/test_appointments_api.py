"""HTTP-level tests for booking and listing Appointments.

Booking is Patient-only and always for the caller (root AGENTS.md, "Auth and
security"): the Patient comes from the token, never the body. A booking is a
PENDING request against a Listing, and the patient's dashboard reads back what
they booked.
"""

from __future__ import annotations

from typing import Any

from httpx import AsyncClient

from tests.factories import SEEDED_PASSWORD

PASSWORD = "correct horse battery staple"

#: Far enough ahead that no local clock reaches it, and far enough behind that
#: none is before it.
FUTURE = "2030-01-01T10:00:00"
PAST = "2000-01-01T10:00:00"


async def _register(
    client: AsyncClient,
    *,
    email: str,
    account_type: str = "patient",
) -> dict[str, str]:
    """Register an account and return its bearer header."""
    response = await client.post(
        "/api/v1/auth/register",
        json={
            "full_name": "Test Patient",
            "email": email,
            "password": PASSWORD,
            "account_type": account_type,
        },
    )
    assert response.status_code == 200, response.text
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


async def _login(client: AsyncClient, email: str, password: str) -> dict[str, str]:
    response = await client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": password},
    )
    assert response.status_code == 200, response.text
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


async def _first_facility_id(client: AsyncClient) -> str:
    response = await client.get("/api/v1/facilities", params={"country": "KE"})
    items: list[dict[str, Any]] = response.json()["items"]
    return items[0]["id"]


async def test_a_patient_books_a_listing_and_reads_it_back(client: AsyncClient) -> None:
    headers = await _register(client, email="booker@example.com")
    facility_id = await _first_facility_id(client)

    book = await client.post(
        "/api/v1/appointments",
        headers=headers,
        json={
            "listing_type": "facility",
            "listing_id": facility_id,
            "scheduled_at": FUTURE,
            "note": "First visit",
        },
    )

    assert book.status_code == 200, book.text
    body = book.json()
    assert body["listing_type"] == "facility"
    assert body["listing_id"] == facility_id
    assert body["listing_name"]
    assert body["status"] == "PENDING"
    assert body["note"] == "First visit"
    assert body["country_code"] == "KE"
    assert "T10:00:00" in body["scheduled_at"]

    listing = await client.get("/api/v1/appointments", headers=headers)

    assert listing.status_code == 200, listing.text
    page = listing.json()
    assert page["total"] == 1
    assert page["items"][0]["id"] == body["id"]
    assert page["items"][0]["listing_name"] == body["listing_name"]


async def test_a_patient_books_a_specialist(client: AsyncClient) -> None:
    headers = await _register(client, email="specialist-booker@example.com")
    response = await client.get("/api/v1/dentists", params={"country": "KE"})
    specialist_id = response.json()["items"][0]["id"]

    book = await client.post(
        "/api/v1/appointments",
        headers=headers,
        json={
            "listing_type": "specialist",
            "listing_id": specialist_id,
            "scheduled_at": FUTURE,
        },
    )

    assert book.status_code == 200, book.text
    assert book.json()["listing_type"] == "specialist"
    assert book.json()["listing_id"] == specialist_id


async def test_booking_an_unknown_listing_is_404(client: AsyncClient) -> None:
    headers = await _register(client, email="notfound@example.com")

    response = await client.post(
        "/api/v1/appointments",
        headers=headers,
        json={
            "listing_type": "facility",
            "listing_id": "does-not-exist",
            "scheduled_at": FUTURE,
        },
    )

    assert response.status_code == 404
    assert response.json()["code"] == 404


async def test_a_listing_id_under_the_wrong_type_is_404(client: AsyncClient) -> None:
    headers = await _register(client, email="mismatch@example.com")
    response = await client.get("/api/v1/dentists", params={"country": "KE"})
    specialist_id = response.json()["items"][0]["id"]

    # A Specialist id sent as a Facility is not a Facility.
    mismatch = await client.post(
        "/api/v1/appointments",
        headers=headers,
        json={
            "listing_type": "facility",
            "listing_id": specialist_id,
            "scheduled_at": FUTURE,
        },
    )

    assert mismatch.status_code == 404


async def test_a_time_in_the_past_is_400(client: AsyncClient) -> None:
    headers = await _register(client, email="past@example.com")
    facility_id = await _first_facility_id(client)

    response = await client.post(
        "/api/v1/appointments",
        headers=headers,
        json={
            "listing_type": "facility",
            "listing_id": facility_id,
            "scheduled_at": PAST,
        },
    )

    assert response.status_code == 400
    assert response.json()["code"] == 400


async def test_the_same_slot_for_the_same_listing_is_409(client: AsyncClient) -> None:
    headers = await _register(client, email="duplicate@example.com")
    facility_id = await _first_facility_id(client)
    payload = {
        "listing_type": "facility",
        "listing_id": facility_id,
        "scheduled_at": FUTURE,
    }

    first = await client.post("/api/v1/appointments", headers=headers, json=payload)
    assert first.status_code == 200, first.text

    second = await client.post("/api/v1/appointments", headers=headers, json=payload)

    assert second.status_code == 409
    assert second.json()["code"] == 409


async def test_a_malformed_booking_is_422(client: AsyncClient) -> None:
    headers = await _register(client, email="malformed@example.com")
    facility_id = await _first_facility_id(client)

    response = await client.post(
        "/api/v1/appointments",
        headers=headers,
        json={
            "listing_type": "clinic",  # not a Listing type
            "listing_id": facility_id,
            "scheduled_at": "not-a-date",
        },
    )

    assert response.status_code == 422


async def test_a_note_over_the_cap_is_422(client: AsyncClient) -> None:
    headers = await _register(client, email="longnote@example.com")
    facility_id = await _first_facility_id(client)

    response = await client.post(
        "/api/v1/appointments",
        headers=headers,
        json={
            "listing_type": "facility",
            "listing_id": facility_id,
            "scheduled_at": FUTURE,
            "note": "x" * 2001,
        },
    )

    assert response.status_code == 422


async def test_the_note_cap_boundary_is_accepted(client: AsyncClient) -> None:
    headers = await _register(client, email="boundarynote@example.com")
    facility_id = await _first_facility_id(client)

    response = await client.post(
        "/api/v1/appointments",
        headers=headers,
        json={
            "listing_type": "facility",
            "listing_id": facility_id,
            "scheduled_at": FUTURE,
            "note": "x" * 2000,
        },
    )

    assert response.status_code == 200, response.text
    assert response.json()["note"] == "x" * 2000


async def test_booking_needs_a_token(client: AsyncClient) -> None:
    facility_id = await _first_facility_id(client)

    response = await client.post(
        "/api/v1/appointments",
        json={
            "listing_type": "facility",
            "listing_id": facility_id,
            "scheduled_at": FUTURE,
        },
    )

    assert response.status_code == 401


async def test_a_non_patient_cannot_book(client: AsyncClient) -> None:
    headers = await _register(client, email="dentist@example.com", account_type="dentist")
    facility_id = await _first_facility_id(client)

    response = await client.post(
        "/api/v1/appointments",
        headers=headers,
        json={
            "listing_type": "facility",
            "listing_id": facility_id,
            "scheduled_at": FUTURE,
        },
    )

    assert response.status_code == 403


async def test_a_non_patient_cannot_read_the_list(client: AsyncClient) -> None:
    headers = await _register(client, email="supplier@example.com", account_type="supplier")

    response = await client.get("/api/v1/appointments", headers=headers)

    assert response.status_code == 403


async def test_the_list_is_scoped_to_the_caller_and_soonest_first(
    client: AsyncClient,
) -> None:
    headers = await _login(client, "amina.patient@example.com", SEEDED_PASSWORD)

    response = await client.get("/api/v1/appointments", headers=headers)

    assert response.status_code == 200, response.text
    page = response.json()

    # Amina owns three of the four seeded Appointments; the fourth belongs to
    # the other Patient and must not leak into her list.
    assert page["total"] == 3
    assert [item["status"] for item in page["items"]] == [
        "COMPLETED",
        "CONFIRMED",
        "PENDING",
    ]
    assert [item["listing_name"] for item in page["items"]] == [
        "Smile Point Dental",
        "Dr. Amina Otieno",
        "Nyali Coastal Dental",
    ]
    assert [item["scheduled_at"] for item in page["items"]] == sorted(
        item["scheduled_at"] for item in page["items"]
    )
