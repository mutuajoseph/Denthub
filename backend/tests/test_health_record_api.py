"""HTTP-level tests for the Patient Health Record (#84).

A Health Record is Patient-owned: the Patient reads and writes their own, and a
Verified Medic treating them may write as well. "Treating" is proven through an
accepted Facility Appointment (see ``logic/v1/health_records.py``), so a clinician
at another clinic, a clinician with no clinic, and a booking that is still
``PENDING`` are all refused. Every entry carries an author badge — patient vs
clinician — snapshotted at write time.
"""

from __future__ import annotations

import uuid
from datetime import datetime

from httpx import AsyncClient

from app.logic.v1.auth import create_access_token, hash_password
from app.repositories.appointment import Appointment, AppointmentStatus
from app.repositories.user import User, UserRepository
from app.utils.state import AppState

PASSWORD = "correct horse battery staple"
PASSWORD_HASH = hash_password(PASSWORD)


async def _make_user(
    state: AppState,
    *,
    email: str,
    role: str,
    full_name: str = "Test Subject",
    facility_id: str | None = None,
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


async def _facility_id_by_name(client: AsyncClient, name: str) -> str:
    response = await client.get("/api/v1/facilities", params={"country": "KE"})
    for item in response.json()["items"]:
        if item["name"] == name:
            return item["id"]
    raise AssertionError(f"facility {name!r} not found")


async def _make_appointment(
    state: AppState,
    *,
    patient: User,
    facility_id: str,
    status: AppointmentStatus,
) -> str:
    """Insert an Appointment directly so status and clinic are exact."""
    async with state.db_session_maker() as session:
        appointment = Appointment(
            patient_id=patient.id,
            facility_id=facility_id,
            country_code="KE",
            scheduled_at=datetime(2026, 12, 1, 9, 0),
            status=status,
            note=None,
        )
        session.add(appointment)
        await session.commit()
        await session.refresh(appointment)
        return appointment.id


async def test_a_patient_reads_their_own_empty_record(client: AsyncClient, state: AppState) -> None:
    patient = await _make_user(
        state, email="empty@example.com", role="patient", full_name="Amina Yusuf"
    )

    response = await client.get(
        f"/api/v1/health-records/{patient.id}", headers=_headers(state, patient)
    )

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["patient_id"] == patient.id
    assert body["maternal_status"] == "none"
    assert body["entries"] == []


async def test_the_seeded_record_surfaces_both_author_badges(
    client: AsyncClient, state: AppState
) -> None:
    async with state.db_session_maker() as session:
        amina = await UserRepository.get_by_email(session, "amina.patient@example.com")
    assert amina is not None

    response = await client.get(
        f"/api/v1/health-records/{amina.id}", headers=_headers(state, amina)
    )

    assert response.status_code == 200, response.text
    entries = response.json()["entries"]
    # Oldest first: the Patient's allergy before the clinician's dental history.
    assert [(entry["category"], entry["author_kind"]) for entry in entries] == [
        ("allergy", "patient"),
        ("dental_history", "clinician"),
    ]
    assert entries[0]["author_name"] == "Amina Yusuf"
    assert entries[1]["author_name"] == "Dr. Wanjiku Kamau"


async def test_a_treating_clinician_reads_and_writes(client: AsyncClient, state: AppState) -> None:
    facility_id = await _facility_id_by_name(client, "Smile Point Dental")
    clinician = await _make_user(
        state,
        email="dentist@smile.test",
        role="facility_dentist",
        full_name="Dr. Njeri",
        facility_id=facility_id,
    )
    patient = await _make_user(
        state, email="treated@example.com", role="patient", full_name="Peter Mwangi"
    )
    await _make_appointment(state, patient=patient, facility_id=facility_id, status="CONFIRMED")

    read = await client.get(
        f"/api/v1/health-records/{patient.id}", headers=_headers(state, clinician)
    )
    assert read.status_code == 200, read.text

    write = await client.post(
        f"/api/v1/health-records/{patient.id}/entries",
        headers=_headers(state, clinician),
        json={"category": "prescription", "body": "Amoxicillin 500mg TDS for 5 days."},
    )
    assert write.status_code == 201, write.text
    entry = write.json()
    assert entry["author_kind"] == "clinician"
    assert entry["author_name"] == "Dr. Njeri"

    # The Patient sees the clinician's entry on their own record.
    patient_read = await client.get(
        f"/api/v1/health-records/{patient.id}", headers=_headers(state, patient)
    )
    assert [row["id"] for row in patient_read.json()["entries"]] == [entry["id"]]


async def test_a_patient_entry_carries_a_patient_badge(
    client: AsyncClient, state: AppState
) -> None:
    patient = await _make_user(
        state, email="writes-own@example.com", role="patient", full_name="Grace Wambui"
    )

    response = await client.post(
        f"/api/v1/health-records/{patient.id}/entries",
        headers=_headers(state, patient),
        json={"category": "medical_history", "body": "Asthma since childhood."},
    )

    assert response.status_code == 201, response.text
    body = response.json()
    assert body["author_kind"] == "patient"
    assert body["author_name"] == "Grace Wambui"


async def test_a_clinician_without_a_treating_appointment_is_forbidden(
    client: AsyncClient, state: AppState
) -> None:
    smile_point = await _facility_id_by_name(client, "Smile Point Dental")
    nyali = await _facility_id_by_name(client, "Nyali Coastal Dental")
    clinician = await _make_user(
        state, email="other@smile.test", role="facility_dentist", facility_id=smile_point
    )
    patient = await _make_user(state, email="untreated@example.com", role="patient")
    # An Appointment at a different clinic is not a treating link.
    await _make_appointment(state, patient=patient, facility_id=nyali, status="CONFIRMED")
    headers = _headers(state, clinician)

    read = await client.get(f"/api/v1/health-records/{patient.id}", headers=headers)
    assert read.status_code == 403, read.text

    write = await client.post(
        f"/api/v1/health-records/{patient.id}/entries",
        headers=headers,
        json={"category": "allergy", "body": "Sulfa drugs."},
    )
    assert write.status_code == 403, write.text


async def test_a_pending_appointment_is_not_yet_treating(
    client: AsyncClient, state: AppState
) -> None:
    facility_id = await _facility_id_by_name(client, "Smile Point Dental")
    clinician = await _make_user(
        state, email="pending@smile.test", role="facility_dentist", facility_id=facility_id
    )
    patient = await _make_user(state, email="pending-patient@example.com", role="patient")
    await _make_appointment(state, patient=patient, facility_id=facility_id, status="PENDING")

    response = await client.post(
        f"/api/v1/health-records/{patient.id}/entries",
        headers=_headers(state, clinician),
        json={"category": "allergy", "body": "Latex."},
    )

    assert response.status_code == 403, response.text


async def test_a_clinician_with_no_linked_clinic_is_forbidden(
    client: AsyncClient, state: AppState
) -> None:
    facility_id = await _facility_id_by_name(client, "Smile Point Dental")
    clinician = await _make_user(
        state, email="floating@example.com", role="specialist", facility_id=None
    )
    patient = await _make_user(state, email="care@example.com", role="patient")
    await _make_appointment(state, patient=patient, facility_id=facility_id, status="CONFIRMED")

    response = await client.get(
        f"/api/v1/health-records/{patient.id}", headers=_headers(state, clinician)
    )

    assert response.status_code == 403, response.text


async def test_a_patient_cannot_read_another_patients_record(
    client: AsyncClient, state: AppState
) -> None:
    alice = await _make_user(state, email="alice@example.com", role="patient")
    bob = await _make_user(state, email="bob@example.com", role="patient")

    response = await client.get(f"/api/v1/health-records/{bob.id}", headers=_headers(state, alice))

    assert response.status_code == 403, response.text


async def test_an_unknown_patient_is_a_404(client: AsyncClient, state: AppState) -> None:
    patient = await _make_user(state, email="404@example.com", role="patient")

    response = await client.get(
        f"/api/v1/health-records/{uuid.uuid4()}", headers=_headers(state, patient)
    )

    assert response.status_code == 404, response.text


async def test_a_non_patient_id_is_a_404(client: AsyncClient, state: AppState) -> None:
    clinician = await _make_user(state, email="not-a-patient@example.com", role="dentist")
    patient = await _make_user(state, email="asker@example.com", role="patient")

    response = await client.get(
        f"/api/v1/health-records/{clinician.id}", headers=_headers(state, patient)
    )

    assert response.status_code == 404, response.text


async def test_a_patient_sets_their_maternal_status(client: AsyncClient, state: AppState) -> None:
    patient = await _make_user(state, email="maternal@example.com", role="patient")

    response = await client.patch(
        f"/api/v1/health-records/{patient.id}",
        headers=_headers(state, patient),
        json={"maternal_status": "pregnant"},
    )

    assert response.status_code == 200, response.text
    assert response.json()["maternal_status"] == "pregnant"


async def test_an_unknown_maternal_status_is_a_422(client: AsyncClient, state: AppState) -> None:
    patient = await _make_user(state, email="bad-status@example.com", role="patient")

    response = await client.patch(
        f"/api/v1/health-records/{patient.id}",
        headers=_headers(state, patient),
        json={"maternal_status": "expecting"},
    )

    assert response.status_code == 422, response.text


async def test_a_clinician_cannot_set_the_maternal_status(
    client: AsyncClient, state: AppState
) -> None:
    facility_id = await _facility_id_by_name(client, "Smile Point Dental")
    clinician = await _make_user(
        state, email="maternal-dentist@smile.test", role="facility_dentist", facility_id=facility_id
    )
    patient = await _make_user(state, email="maternal-patient@example.com", role="patient")
    await _make_appointment(state, patient=patient, facility_id=facility_id, status="CONFIRMED")

    response = await client.patch(
        f"/api/v1/health-records/{patient.id}",
        headers=_headers(state, clinician),
        json={"maternal_status": "lactating"},
    )

    assert response.status_code == 403, response.text


async def test_the_record_is_unauthenticated_without_a_token(
    client: AsyncClient, state: AppState
) -> None:
    patient = await _make_user(state, email="no-token@example.com", role="patient")

    response = await client.get(f"/api/v1/health-records/{patient.id}")

    assert response.status_code in (401, 403)
