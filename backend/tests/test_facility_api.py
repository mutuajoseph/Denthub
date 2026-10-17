"""HTTP-level tests for the facility dashboard and its appointment workflow (#81).

A facility-scoped account (owner, front office, facility dentist) is bound to one
Facility through ``users.facility_id``; every read and write is scoped to that
clinic. A patient or a facility user with no linked clinic is refused, an
Appointment belonging to another clinic is a 404 (never a 403, so the endpoint
does not confirm another clinic's booking exists), and only forward steps along
the documented workflow are allowed.
"""

from __future__ import annotations

from datetime import UTC, date, datetime, time
from zoneinfo import ZoneInfo

from httpx import AsyncClient

from app.logic.v1.auth import create_access_token, hash_password
from app.repositories.appointment import Appointment
from app.repositories.user import User
from app.utils.state import AppState

PASSWORD = "correct horse battery staple"
PASSWORD_HASH = hash_password(PASSWORD)

KE_TIMEZONE = "Africa/Nairobi"

#: The three roles that reach the facility dashboard (#81).
FACILITY_ROLES = ("facility_owner", "front_office", "facility_dentist")


def _today() -> date:
    """Today's date on the Kenyan clinic's own clock."""
    return datetime.now(UTC).astimezone(ZoneInfo(KE_TIMEZONE)).date()


async def _make_user(
    state: AppState,
    *,
    email: str,
    role: str,
    facility_id: str | None = None,
    full_name: str = "Clinic Staff",
) -> User:
    """Insert an active user directly, bypassing public-signup role limits."""
    async with state.db_session_maker() as session:
        user = User(
            full_name=full_name,
            email=email,
            role=role,
            password_hash=PASSWORD_HASH,
            is_active=True,
            account_status="active",
            facility_id=facility_id,
        )
        session.add(user)
        await session.commit()
        await session.refresh(user)
        return user


def _headers(state: AppState, user: User) -> dict[str, str]:
    return {"Authorization": f"Bearer {create_access_token(state, user.id, user.role)}"}


async def _make_appointment(
    state: AppState,
    *,
    patient: User,
    facility_id: str,
    status: str,
    scheduled_at: datetime,
) -> str:
    """Insert an Appointment directly so status, clinic, and time are exact."""
    async with state.db_session_maker() as session:
        appointment = Appointment(
            patient_id=patient.id,
            facility_id=facility_id,
            country_code="KE",
            scheduled_at=scheduled_at,
            status=status,
            note=None,
        )
        session.add(appointment)
        await session.commit()
        await session.refresh(appointment)
        return appointment.id


async def _facility_id_by_name(client: AsyncClient, name: str) -> str:
    response = await client.get("/api/v1/facilities", params={"country": "KE"})
    for item in response.json()["items"]:
        if item["name"] == name:
            return item["id"]
    raise AssertionError(f"facility {name!r} not found")


async def _patient(state: AppState, email: str) -> User:
    return await _make_user(state, email=email, role="patient", full_name="Test Patient")


async def test_facility_dashboard_shows_todays_appointments_and_pending(
    client: AsyncClient, state: AppState
) -> None:
    smile_point = await _facility_id_by_name(client, "Smile Point Dental")
    owner = await _make_user(
        state, email="owner@smile.test", role="facility_owner", facility_id=smile_point
    )
    patient = await _patient(state, "dash-patient@example.com")

    today_slot = datetime.combine(_today(), time(10, 0))
    await _make_appointment(
        state, patient=patient, facility_id=smile_point, status="PENDING", scheduled_at=today_slot
    )
    # A different day must not leak into "today".
    await _make_appointment(
        state,
        patient=patient,
        facility_id=smile_point,
        status="PENDING",
        scheduled_at=datetime(2030, 1, 1, 10, 0),
    )

    response = await client.get("/api/v1/facility/dashboard", headers=_headers(state, owner))

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["facility_id"] == smile_point
    assert body["facility_name"] == "Smile Point Dental"
    assert body["country_code"] == "KE"
    # The pending queue is the clinic's whole backlog, not just today's — so it
    # counts the off-day booking too while "today" does not.
    assert body["pending_count"] == 2
    assert len(body["today"]) == 1
    assert body["today"][0]["status"] == "PENDING"
    assert body["today"][0]["listing_name"] == "Smile Point Dental"
    assert [member["full_name"] for member in body["staff"]] == ["Clinic Staff"]
    assert body["staff"][0]["role"] == "facility_owner"


async def test_facility_dashboard_is_scoped_to_the_callers_own_clinic(
    client: AsyncClient, state: AppState
) -> None:
    smile_point = await _facility_id_by_name(client, "Smile Point Dental")
    nyali = await _facility_id_by_name(client, "Nyali Coastal Dental")
    owner = await _make_user(
        state, email="scoped@smile.test", role="facility_owner", facility_id=smile_point
    )
    patient = await _patient(state, "scoped-patient@example.com")

    # A booking at a *different* clinic, today, must not show up.
    await _make_appointment(
        state,
        patient=patient,
        facility_id=nyali,
        status="PENDING",
        scheduled_at=datetime.combine(_today(), time(11, 0)),
    )

    response = await client.get("/api/v1/facility/dashboard", headers=_headers(state, owner))

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["today"] == []
    assert body["pending_count"] == 0


async def test_every_facility_role_reaches_the_dashboard(
    client: AsyncClient, state: AppState
) -> None:
    smile_point = await _facility_id_by_name(client, "Smile Point Dental")
    for role in FACILITY_ROLES:
        user = await _make_user(
            state, email=f"{role}@smile.test", role=role, facility_id=smile_point
        )
        response = await client.get("/api/v1/facility/dashboard", headers=_headers(state, user))
        assert response.status_code == 200, (role, response.text)


async def test_a_patient_cannot_reach_the_facility_dashboard(
    client: AsyncClient, state: AppState
) -> None:
    smile_point = await _facility_id_by_name(client, "Smile Point Dental")
    patient = await _make_user(
        state, email="nope@example.com", role="patient", facility_id=smile_point
    )

    response = await client.get("/api/v1/facility/dashboard", headers=_headers(state, patient))

    assert response.status_code == 403, response.text


async def test_a_facility_user_with_no_linked_clinic_is_refused(
    client: AsyncClient, state: AppState
) -> None:
    user = await _make_user(
        state, email="unlinked@smile.test", role="facility_owner", facility_id=None
    )

    response = await client.get("/api/v1/facility/dashboard", headers=_headers(state, user))

    assert response.status_code == 403, response.text
    assert "not linked" in response.json()["message"]


async def test_the_dashboard_is_unauthenticated_without_a_token(client: AsyncClient) -> None:
    response = await client.get("/api/v1/facility/dashboard")
    assert response.status_code in (401, 403)


async def test_facility_advances_an_appointment_through_the_workflow(
    client: AsyncClient, state: AppState
) -> None:
    smile_point = await _facility_id_by_name(client, "Smile Point Dental")
    owner = await _make_user(
        state, email="flow@smile.test", role="facility_owner", facility_id=smile_point
    )
    patient = await _patient(state, "flow-patient@example.com")
    appointment_id = await _make_appointment(
        state,
        patient=patient,
        facility_id=smile_point,
        status="PENDING",
        scheduled_at=datetime(2030, 1, 1, 10, 0),
    )
    headers = _headers(state, owner)

    for step in ("CONFIRMED", "IN_PROGRESS", "COMPLETED"):
        response = await client.patch(
            f"/api/v1/facility/appointments/{appointment_id}",
            headers=headers,
            json={"status": step},
        )
        assert response.status_code == 200, (step, response.text)
        assert response.json()["status"] == step


async def test_an_invalid_transition_is_rejected(client: AsyncClient, state: AppState) -> None:
    smile_point = await _facility_id_by_name(client, "Smile Point Dental")
    owner = await _make_user(
        state, email="invalid@smile.test", role="facility_owner", facility_id=smile_point
    )
    patient = await _patient(state, "invalid-patient@example.com")
    headers = _headers(state, owner)

    # Skipping a step forward.
    skipping = await _make_appointment(
        state,
        patient=patient,
        facility_id=smile_point,
        status="PENDING",
        scheduled_at=datetime(2030, 2, 1, 10, 0),
    )
    response = await client.patch(
        f"/api/v1/facility/appointments/{skipping}", headers=headers, json={"status": "IN_PROGRESS"}
    )
    assert response.status_code == 400, response.text

    # Going backwards.
    ahead = await _make_appointment(
        state,
        patient=patient,
        facility_id=smile_point,
        status="IN_PROGRESS",
        scheduled_at=datetime(2030, 2, 2, 10, 0),
    )
    response = await client.patch(
        f"/api/v1/facility/appointments/{ahead}", headers=headers, json={"status": "CONFIRMED"}
    )
    assert response.status_code == 400, response.text

    # Touching a terminal state.
    done = await _make_appointment(
        state,
        patient=patient,
        facility_id=smile_point,
        status="COMPLETED",
        scheduled_at=datetime(2030, 3, 1, 10, 0),
    )
    response = await client.patch(
        f"/api/v1/facility/appointments/{done}", headers=headers, json={"status": "CONFIRMED"}
    )
    assert response.status_code == 400, response.text


async def test_a_facility_cannot_touch_another_clinics_appointment(
    client: AsyncClient, state: AppState
) -> None:
    smile_point = await _facility_id_by_name(client, "Smile Point Dental")
    nyali = await _facility_id_by_name(client, "Nyali Coastal Dental")
    owner = await _make_user(
        state, email="cross@smile.test", role="facility_owner", facility_id=smile_point
    )
    patient = await _patient(state, "cross-patient@example.com")
    appointment_id = await _make_appointment(
        state,
        patient=patient,
        facility_id=nyali,
        status="PENDING",
        scheduled_at=datetime(2030, 4, 1, 10, 0),
    )

    response = await client.patch(
        f"/api/v1/facility/appointments/{appointment_id}",
        headers=_headers(state, owner),
        json={"status": "CONFIRMED"},
    )

    assert response.status_code == 404, response.text


async def test_a_patient_cannot_advance_an_appointment(
    client: AsyncClient, state: AppState
) -> None:
    smile_point = await _facility_id_by_name(client, "Smile Point Dental")
    patient = await _patient(state, "cannot@example.com")
    appointment_id = await _make_appointment(
        state,
        patient=patient,
        facility_id=smile_point,
        status="PENDING",
        scheduled_at=datetime(2030, 5, 1, 10, 0),
    )

    response = await client.patch(
        f"/api/v1/facility/appointments/{appointment_id}",
        headers=_headers(state, patient),
        json={"status": "CONFIRMED"},
    )

    assert response.status_code == 403, response.text
