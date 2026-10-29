"""HTTP-level tests for the caller's own data export and account deletion (#128).

The export is the caller's own User, Profiles, Facility Memberships, Health
Record, Appointments, and sent Messages, and nothing belonging to anyone else.
Deletion anonymises the account at once: the User row stays so the clinic rows
that reference it (appointments, clinician entries) keep their foreign keys, but
every identity field is scrubbed, the caller's own Profiles and Memberships are
removed, and their own Health Record entries are deleted. Clinician-authored
entries are retained, attached only to the anonymised account.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta

from httpx import AsyncClient
from sqlalchemy import select

from app.logic.v1.auth import STAFF_SCOPE, create_access_token, hash_password
from app.repositories.appointment import Appointment
from app.repositories.deletion import DeletionRequest
from app.repositories.health_record import HealthRecordEntry, PatientHealthRecord
from app.repositories.listing import Facility, Specialist
from app.repositories.message import Conversation, Message
from app.repositories.profile import FacilityMembership, Profile
from app.repositories.user import User
from app.utils.state import AppState
from tests.factories import SEEDED_PASSWORD

PASSWORD = SEEDED_PASSWORD
PASSWORD_HASH = hash_password(PASSWORD)


async def _make_user(
    state: AppState,
    *,
    email: str,
    full_name: str = "Test Subject",
    role: str = "patient",
    phone: str | None = None,
    facility_id: str | None = None,
) -> User:
    async with state.db_session_maker() as session:
        user = User(
            full_name=full_name,
            email=email,
            phone=phone,
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


async def _facility(state: AppState, name: str) -> Facility:
    async with state.db_session_maker() as session:
        facility = (
            await session.execute(select(Facility).where(Facility.name == name))
        ).scalar_one()
        return facility


async def _add_patient_data(
    state: AppState,
    *,
    patient: User,
    clinician: User,
    facility_id: str,
    patient_entry: str,
    clinician_entry: str,
) -> None:
    async with state.db_session_maker() as session:
        session.add(Profile(user_id=patient.id, kind="patient"))
        session.add(Profile(user_id=clinician.id, kind="specialist"))
        session.add(
            FacilityMembership(
                user_id=patient.id,
                facility_id=facility_id,
                front_office=True,
            )
        )
        session.add(
            PatientHealthRecord(
                patient_id=patient.id,
                maternal_status="pregnant",
                entries=[
                    HealthRecordEntry(
                        category="allergy",
                        body=patient_entry,
                        author_id=patient.id,
                        author_kind="patient",
                        created_at=datetime(2026, 2, 1, 9, 0, 0),
                    ),
                    HealthRecordEntry(
                        category="dental_history",
                        body=clinician_entry,
                        author_id=clinician.id,
                        author_kind="clinician",
                        created_at=datetime(2026, 2, 1, 10, 0, 0),
                    ),
                ],
            )
        )
        session.add(
            Appointment(
                patient_id=patient.id,
                facility_id=facility_id,
                country_code="KE",
                scheduled_at=datetime(2026, 11, 3, 8, 15, 0),
                status="PENDING",
                note="Morning slot",
            )
        )
        await session.commit()


async def _add_thread(
    state: AppState,
    *,
    first: User,
    second: User,
    first_body: str,
    second_body: str,
) -> str:
    async with state.db_session_maker() as session:
        a_id, b_id = sorted([first.id, second.id])
        conversation = Conversation(
            kind="patient-patient", participant_a_id=a_id, participant_b_id=b_id
        )
        session.add(conversation)
        await session.flush()
        session.add(
            Message(
                conversation_id=conversation.id,
                sender_id=first.id,
                body=first_body,
                created_at=datetime(2026, 2, 2, 9, 0, 0),
            )
        )
        session.add(
            Message(
                conversation_id=conversation.id,
                sender_id=second.id,
                body=second_body,
                created_at=datetime(2026, 2, 2, 10, 0, 0),
            )
        )
        await session.commit()
        return conversation.id


async def test_export_requires_authentication(client: AsyncClient) -> None:
    response = await client.get("/api/v1/me/export")

    assert response.status_code == 401


async def test_export_contains_only_the_callers_own_data(
    client: AsyncClient,
    state: AppState,
) -> None:
    amina = await _make_user(
        state,
        email="amina.export@example.com",
        full_name="Amina Export",
        phone="+254700000001",
    )
    chidi = await _make_user(
        state,
        email="chidi.export@example.com",
        full_name="Chidi Export",
    )
    clinician = await _make_user(
        state,
        email="clinician.export@example.com",
        full_name="Dr. Export",
        role="facility_dentist",
    )
    facility = await _facility(state, "Smile Point Dental")

    await _add_patient_data(
        state,
        patient=amina,
        clinician=clinician,
        facility_id=facility.id,
        patient_entry="Penicillin allergy",
        clinician_entry="Composite restoration",
    )
    async with state.db_session_maker() as session:
        session.add(Profile(user_id=chidi.id, kind="patient"))
        session.add(
            PatientHealthRecord(
                patient_id=chidi.id,
                entries=[
                    HealthRecordEntry(
                        category="allergy",
                        body="Chidi private allergy",
                        author_id=chidi.id,
                        author_kind="patient",
                    )
                ],
            )
        )
        await session.commit()

    conversation_id = await _add_thread(
        state,
        first=amina,
        second=chidi,
        first_body="Amina's message",
        second_body="Chidi's message",
    )

    response = await client.get("/api/v1/me/export", headers=_headers(state, amina))

    assert response.status_code == 200, response.text
    body = response.json()

    assert body["user"]["id"] == amina.id
    assert body["user"]["email"] == "amina.export@example.com"
    assert body["user"]["phone"] == "+254700000001"
    assert body["profiles"] == [{"kind": "patient"}]
    assert body["memberships"] == [
        {
            "facility_id": facility.id,
            "facility_name": "Smile Point Dental",
            "permissions": ["front_office"],
        }
    ]

    record = body["health_record"]
    assert record["patient_id"] == amina.id
    assert record["maternal_status"] == "pregnant"
    assert [entry["body"] for entry in record["entries"]] == [
        "Penicillin allergy",
        "Composite restoration",
    ]
    assert record["entries"][0]["author_name"] == "Amina Export"
    assert record["entries"][1]["author_name"] == "Dr. Export"

    assert len(body["appointments"]) == 1
    appointment = body["appointments"][0]
    assert appointment["listing_type"] == "facility"
    assert appointment["listing_name"] == "Smile Point Dental"
    assert appointment["note"] == "Morning slot"

    assert len(body["messages"]) == 1
    assert body["messages"][0]["body"] == "Amina's message"
    assert body["messages"][0]["conversation_id"] == conversation_id

    text = response.text
    assert "chidi.export@example.com" not in text
    assert "Chidi Export" not in text
    assert "Chidi private allergy" not in text
    assert "Chidi's message" not in text


async def test_export_returns_a_null_health_record_when_none_exists(
    client: AsyncClient,
    state: AppState,
) -> None:
    user = await _make_user(state, email="no-record.export@example.com")

    response = await client.get("/api/v1/me/export", headers=_headers(state, user))

    assert response.status_code == 200
    assert response.json()["health_record"] is None


async def test_delete_requires_authentication(client: AsyncClient) -> None:
    response = await client.delete("/api/v1/me")

    assert response.status_code == 401


async def test_delete_refuses_a_staff_token(
    client: AsyncClient,
    state: AppState,
) -> None:
    staff = await _make_user(
        state,
        email="staff.delete@example.com",
        full_name="Staff Delete",
        role="admin",
    )
    staff_token = create_access_token(state, staff.id, staff.role, scope=STAFF_SCOPE)

    response = await client.delete(
        "/api/v1/me",
        headers={"Authorization": f"Bearer {staff_token}"},
    )

    assert response.status_code == 403


async def test_delete_anonymises_identity_and_keeps_clinical_entries(
    client: AsyncClient,
    state: AppState,
) -> None:
    patient = await _make_user(
        state,
        email="delete.me@example.com",
        full_name="Delete Me",
        phone="+254700000002",
    )
    clinician = await _make_user(
        state,
        email="clinician.keep@example.com",
        full_name="Dr. Keep",
        role="facility_dentist",
    )
    facility = await _facility(state, "Smile Point Dental")
    await _add_patient_data(
        state,
        patient=patient,
        clinician=clinician,
        facility_id=facility.id,
        patient_entry="Delete this entry",
        clinician_entry="Keep this clinical entry",
    )

    response = await client.delete(
        "/api/v1/me",
        headers=_headers(state, patient),
    )

    assert response.status_code == 204

    async with state.db_session_maker() as session:
        stored = await session.get(User, patient.id)
        assert stored is not None
        assert stored.full_name == "Deleted user"
        assert stored.email == f"deleted+{patient.id}@deleted.invalid"
        assert stored.phone is None
        assert stored.password_hash == "!"
        assert stored.is_active is False
        assert stored.facility_id is None

        assert (
            await session.execute(select(Profile).where(Profile.user_id == patient.id))
        ).scalar_one_or_none() is None
        assert (
            await session.execute(
                select(FacilityMembership).where(FacilityMembership.user_id == patient.id)
            )
        ).scalar_one_or_none() is None

        record = (
            await session.execute(
                select(PatientHealthRecord).where(PatientHealthRecord.patient_id == patient.id)
            )
        ).scalar_one()
        assert record.maternal_status == "none"
        entries = list(
            (
                await session.execute(
                    select(HealthRecordEntry).where(HealthRecordEntry.record_id == record.id)
                )
            )
            .scalars()
            .all()
        )
        assert [entry.body for entry in entries] == ["Keep this clinical entry"]
        assert entries[0].author_id == clinician.id

        appointment = (
            await session.execute(select(Appointment).where(Appointment.patient_id == patient.id))
        ).scalar_one()
        assert appointment.status == "PENDING"

        deletion = (
            await session.execute(
                select(DeletionRequest).where(DeletionRequest.user_id == patient.id)
            )
        ).scalar_one()
        assert deletion.status == "completed"
        assert deletion.completed_at is not None
        assert deletion.retention_until - deletion.requested_at == timedelta(days=2555)

    # The old token stops working at once, and the old email cannot sign in.
    denied = await client.get("/api/v1/me/export", headers=_headers(state, patient))
    assert denied.status_code == 403

    login = await client.post(
        "/api/v1/auth/login",
        json={"email": "delete.me@example.com", "password": PASSWORD},
    )
    assert login.status_code == 401


async def test_delete_detaches_an_owned_listing(
    client: AsyncClient,
    state: AppState,
) -> None:
    owner = await _make_user(
        state,
        email="listing.owner@example.com",
        full_name="Listing Owner",
        role="specialist",
    )
    async with state.db_session_maker() as session:
        specialist = Specialist(
            name="Dr. Listing Owner",
            slug=f"listing-owner-{uuid.uuid4().hex[:8]}",
            user_id=owner.id,
            country_code="KE",
            subdivision_code="NAIROBI",
            currency="KES",
        )
        session.add(specialist)
        await session.commit()
        specialist_id = specialist.id

    response = await client.delete(
        "/api/v1/me",
        headers=_headers(state, owner),
    )

    assert response.status_code == 204

    async with state.db_session_maker() as session:
        stored = await session.get(Specialist, specialist_id)
        assert stored is not None
        assert stored.user_id is None


async def test_deletion_request_uses_the_configured_retention(
    client: AsyncClient,
    state: AppState,
) -> None:
    user = await _make_user(state, email="retention@example.com")

    before = datetime.now(UTC).replace(tzinfo=None)
    response = await client.delete("/api/v1/me", headers=_headers(state, user))
    after = datetime.now(UTC).replace(tzinfo=None)

    assert response.status_code == 204

    async with state.db_session_maker() as session:
        deletion = (
            await session.execute(select(DeletionRequest).where(DeletionRequest.user_id == user.id))
        ).scalar_one()
        assert before <= deletion.requested_at <= after
        assert deletion.retention_until == deletion.requested_at + timedelta(
            days=state.settings.clinical_retention_days
        )
