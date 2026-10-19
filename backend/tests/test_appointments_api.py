"""HTTP-level tests for booking, listing, cancelling, and rescheduling Appointments.

Booking is Patient-only and always for the caller (root AGENTS.md, "Auth and
security"): the Patient comes from the token, never the body. A booking is a
PENDING request against a Listing, and the patient's dashboard reads back what
they booked. A Patient may then cancel or reschedule their own booking while it
is PENDING or CONFIRMED (#88); anyone else — another Patient, or a non-patient
account — is refused.
"""

from __future__ import annotations

from typing import Any

from httpx import AsyncClient

from tests.factories import SEEDED_PASSWORD

PASSWORD = "correct horse battery staple"

#: Far enough ahead that no local clock reaches it, and far enough behind that
#: none is before it.
FUTURE = "2030-01-01T10:00:00"
FUTURE2 = "2030-02-01T10:00:00"
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


async def _my_appointments(client: AsyncClient, headers: dict[str, str]) -> list[dict[str, Any]]:
    """The caller's own page of Appointments."""
    response = await client.get("/api/v1/appointments", headers=headers)
    assert response.status_code == 200, response.text
    items: list[dict[str, Any]] = response.json()["items"]
    return items


async def _appointment_with_status(
    client: AsyncClient, headers: dict[str, str], status: str
) -> dict[str, Any]:
    """The caller's Appointment in a given state (the seed guarantees one)."""
    return next(
        item for item in await _my_appointments(client, headers) if item["status"] == status
    )


async def _appointments_by_id(
    client: AsyncClient, headers: dict[str, str]
) -> dict[str, dict[str, Any]]:
    """The caller's Appointments keyed by id, for asserting a change read back."""
    return {item["id"]: item for item in await _my_appointments(client, headers)}


async def _book(
    client: AsyncClient,
    headers: dict[str, str],
    *,
    facility_id: str,
    scheduled_at: str,
    note: str | None = None,
) -> dict[str, Any]:
    """Book a Facility and return the created Appointment."""
    response = await client.post(
        "/api/v1/appointments",
        headers=headers,
        json={
            "listing_type": "facility",
            "listing_id": facility_id,
            "scheduled_at": scheduled_at,
            "note": note,
        },
    )
    assert response.status_code == 200, response.text
    body: dict[str, Any] = response.json()
    return body


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


# --- #88: a Patient cancels or reschedules their own Appointment ------------------


async def test_a_patient_cancels_a_pending_appointment(client: AsyncClient) -> None:
    headers = await _login(client, "amina.patient@example.com", SEEDED_PASSWORD)
    pending = await _appointment_with_status(client, headers, "PENDING")

    response = await client.patch(
        f"/api/v1/appointments/{pending['id']}",
        headers=headers,
        json={"action": "cancel"},
    )

    assert response.status_code == 200, response.text
    assert response.json()["status"] == "CANCELLED"
    assert response.json()["id"] == pending["id"]

    # The dashboard reads the new state back.
    refreshed = await _appointments_by_id(client, headers)
    assert refreshed[pending["id"]]["status"] == "CANCELLED"


async def test_a_patient_cancels_a_confirmed_appointment(client: AsyncClient) -> None:
    headers = await _login(client, "amina.patient@example.com", SEEDED_PASSWORD)
    confirmed = await _appointment_with_status(client, headers, "CONFIRMED")

    response = await client.patch(
        f"/api/v1/appointments/{confirmed['id']}",
        headers=headers,
        json={"action": "cancel"},
    )

    assert response.status_code == 200, response.text
    assert response.json()["status"] == "CANCELLED"


async def test_a_completed_appointment_cannot_be_cancelled(client: AsyncClient) -> None:
    headers = await _login(client, "amina.patient@example.com", SEEDED_PASSWORD)
    completed = await _appointment_with_status(client, headers, "COMPLETED")

    response = await client.patch(
        f"/api/v1/appointments/{completed['id']}",
        headers=headers,
        json={"action": "cancel"},
    )

    assert response.status_code == 400
    assert response.json()["code"] == 400


async def test_an_already_cancelled_appointment_cannot_be_cancelled_again(
    client: AsyncClient,
) -> None:
    headers = await _login(client, "amina.patient@example.com", SEEDED_PASSWORD)
    pending = await _appointment_with_status(client, headers, "PENDING")
    path = f"/api/v1/appointments/{pending['id']}"

    first = await client.patch(path, headers=headers, json={"action": "cancel"})
    assert first.status_code == 200, first.text

    second = await client.patch(path, headers=headers, json={"action": "cancel"})

    assert second.status_code == 400
    assert second.json()["code"] == 400


async def test_an_unknown_appointment_is_404(client: AsyncClient) -> None:
    headers = await _login(client, "amina.patient@example.com", SEEDED_PASSWORD)

    response = await client.patch(
        "/api/v1/appointments/does-not-exist",
        headers=headers,
        json={"action": "cancel"},
    )

    assert response.status_code == 404
    assert response.json()["code"] == 404


async def test_a_patient_cannot_change_another_patients_appointment(
    client: AsyncClient,
) -> None:
    owner = await _register(client, email="owner@example.com")
    facility_id = await _first_facility_id(client)
    booked = await _book(client, owner, facility_id=facility_id, scheduled_at=FUTURE)

    intruder = await _register(client, email="intruder@example.com")

    response = await client.patch(
        f"/api/v1/appointments/{booked['id']}",
        headers=intruder,
        json={"action": "cancel"},
    )

    # A non-owner gets the same 404 as a missing id: the endpoint never confirms
    # that another account's Appointment exists.
    assert response.status_code == 404

    # And the owner's Appointment is untouched.
    mine = await _appointments_by_id(client, owner)
    assert mine[booked["id"]]["status"] == "PENDING"


async def test_cancelling_needs_a_token(client: AsyncClient) -> None:
    headers = await _login(client, "amina.patient@example.com", SEEDED_PASSWORD)
    pending = await _appointment_with_status(client, headers, "PENDING")

    response = await client.patch(
        f"/api/v1/appointments/{pending['id']}",
        json={"action": "cancel"},
    )

    assert response.status_code == 401


async def test_a_non_patient_cannot_cancel(client: AsyncClient) -> None:
    patient_headers = await _login(client, "amina.patient@example.com", SEEDED_PASSWORD)
    pending = await _appointment_with_status(client, patient_headers, "PENDING")

    supplier_headers = await _register(
        client, email="supplier-cancel@example.com", account_type="supplier"
    )

    response = await client.patch(
        f"/api/v1/appointments/{pending['id']}",
        headers=supplier_headers,
        json={"action": "cancel"},
    )

    assert response.status_code == 403


async def test_a_patient_reschedules_to_a_new_slot(client: AsyncClient) -> None:
    headers = await _register(client, email="rescheduler@example.com")
    facility_id = await _first_facility_id(client)
    booked = await _book(client, headers, facility_id=facility_id, scheduled_at=FUTURE)

    response = await client.patch(
        f"/api/v1/appointments/{booked['id']}",
        headers=headers,
        json={"action": "reschedule", "scheduled_at": FUTURE2, "note": "Moved to February"},
    )

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["status"] == "PENDING"
    assert "2030-02-01T10:00:00" in body["scheduled_at"]
    assert body["note"] == "Moved to February"

    refreshed = await _appointments_by_id(client, headers)
    assert "2030-02-01T10:00:00" in refreshed[booked["id"]]["scheduled_at"]


async def test_rescheduling_onto_the_same_slot_is_allowed(client: AsyncClient) -> None:
    headers = await _register(client, email="noop-reschedule@example.com")
    facility_id = await _first_facility_id(client)
    booked = await _book(client, headers, facility_id=facility_id, scheduled_at=FUTURE)

    response = await client.patch(
        f"/api/v1/appointments/{booked['id']}",
        headers=headers,
        json={"action": "reschedule", "scheduled_at": FUTURE},
    )

    # The Appointment is excluded from its own duplicate scan, so this is a no-op
    # rather than a conflict with itself.
    assert response.status_code == 200, response.text


async def test_rescheduling_to_the_past_is_400(client: AsyncClient) -> None:
    headers = await _register(client, email="past-reschedule@example.com")
    facility_id = await _first_facility_id(client)
    booked = await _book(client, headers, facility_id=facility_id, scheduled_at=FUTURE)

    response = await client.patch(
        f"/api/v1/appointments/{booked['id']}",
        headers=headers,
        json={"action": "reschedule", "scheduled_at": PAST},
    )

    assert response.status_code == 400
    assert response.json()["code"] == 400


async def test_rescheduling_onto_a_held_slot_is_409(client: AsyncClient) -> None:
    headers = await _register(client, email="clash-reschedule@example.com")
    facility_id = await _first_facility_id(client)
    first = await _book(client, headers, facility_id=facility_id, scheduled_at=FUTURE)
    await _book(client, headers, facility_id=facility_id, scheduled_at=FUTURE2)

    response = await client.patch(
        f"/api/v1/appointments/{first['id']}",
        headers=headers,
        json={"action": "reschedule", "scheduled_at": FUTURE2},
    )

    assert response.status_code == 409
    assert response.json()["code"] == 409


async def test_an_omitted_note_is_kept_and_null_clears_it(client: AsyncClient) -> None:
    headers = await _register(client, email="note-reschedule@example.com")
    facility_id = await _first_facility_id(client)
    booked = await _book(
        client, headers, facility_id=facility_id, scheduled_at=FUTURE, note="Original note"
    )
    path = f"/api/v1/appointments/{booked['id']}"

    # Reschedule with no note at all: the existing note survives (PATCH semantics).
    kept = await client.patch(
        path,
        headers=headers,
        json={"action": "reschedule", "scheduled_at": FUTURE2},
    )
    assert kept.status_code == 200, kept.text
    assert kept.json()["note"] == "Original note"

    # An explicit null clears it.
    cleared = await client.patch(
        path,
        headers=headers,
        json={"action": "reschedule", "scheduled_at": FUTURE, "note": None},
    )
    assert cleared.status_code == 200, cleared.text
    assert cleared.json()["note"] is None


async def test_a_completed_appointment_cannot_be_rescheduled(client: AsyncClient) -> None:
    headers = await _login(client, "amina.patient@example.com", SEEDED_PASSWORD)
    completed = await _appointment_with_status(client, headers, "COMPLETED")

    response = await client.patch(
        f"/api/v1/appointments/{completed['id']}",
        headers=headers,
        json={"action": "reschedule", "scheduled_at": FUTURE},
    )

    assert response.status_code == 400


async def test_cancelling_frees_the_slot_for_rebooking(client: AsyncClient) -> None:
    headers = await _register(client, email="rebook-after-cancel@example.com")
    facility_id = await _first_facility_id(client)
    booked = await _book(client, headers, facility_id=facility_id, scheduled_at=FUTURE)

    cancel = await client.patch(
        f"/api/v1/appointments/{booked['id']}",
        headers=headers,
        json={"action": "cancel"},
    )
    assert cancel.status_code == 200, cancel.text

    # The cancelled row no longer blocks its own slot.
    rebooked = await client.post(
        "/api/v1/appointments",
        headers=headers,
        json={
            "listing_type": "facility",
            "listing_id": facility_id,
            "scheduled_at": FUTURE,
        },
    )

    assert rebooked.status_code == 200, rebooked.text


async def test_a_malformed_update_is_422(client: AsyncClient) -> None:
    headers = await _register(client, email="malformed-update@example.com")
    facility_id = await _first_facility_id(client)
    booked = await _book(client, headers, facility_id=facility_id, scheduled_at=FUTURE)
    path = f"/api/v1/appointments/{booked['id']}"

    # An unknown action, a reschedule with no slot, and an empty body.
    for payload in (
        {"action": "destroy"},
        {"action": "reschedule"},
        {},
    ):
        response = await client.patch(path, headers=headers, json=payload)
        assert response.status_code == 422, (payload, response.text)
