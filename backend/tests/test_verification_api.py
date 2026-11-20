"""Verification applications and staff decisions (#124)."""

from __future__ import annotations

import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy import select

from app.logic.v1.auth import STAFF_SCOPE, create_access_token, hash_password
from app.repositories.listing import Facility, Specialist
from app.repositories.product import Supplier
from app.repositories.profile import FacilityMembership, Profile
from app.repositories.training import TrainingProvider
from app.repositories.user import User
from app.utils.mailer import ConsoleMailer
from app.utils.state import AppState

PASSWORD = "correct horse battery staple"
PASSWORD_HASH = hash_password(PASSWORD)
DOCS = ["verification_document/private/licence.pdf"]


def _public_headers(state: AppState, user: User) -> dict[str, str]:
    return {"Authorization": f"Bearer {create_access_token(state, user.id, user.role)}"}


def _staff_headers(state: AppState, user: User) -> dict[str, str]:
    return {
        "Authorization": f"Bearer {create_access_token(state, user.id, user.role, scope=STAFF_SCOPE)}"
    }


async def _make_user(state: AppState, *, role: str, kind: str | None = None) -> User:
    async with state.db_session_maker() as session:
        user = User(
            full_name=f"{role.title()} Applicant",
            email=f"{role}-{uuid.uuid4().hex[:8]}@example.com",
            role=role,
            password_hash=PASSWORD_HASH,
        )
        session.add(user)
        await session.flush()
        if kind:
            session.add(Profile(user_id=user.id, kind=kind))
        await session.commit()
        await session.refresh(user)
        return user


async def _applicant(state: AppState, kind: str) -> tuple[User, str]:
    user = await _make_user(
        state,
        role={
            "specialist": "specialist",
            "facility": "facility_owner",
            "supplier": "supplier",
            "training_provider": "training_provider",
        }[kind],
        kind=None if kind == "facility" else kind,
    )
    async with state.db_session_maker() as session:
        if kind == "specialist":
            row = Specialist(
                name="Applicant Specialist",
                slug=f"applicant-{uuid.uuid4().hex[:8]}",
                user_id=user.id,
                country_code="KE",
                subdivision_code="NAIROBI",
                currency="KES",
            )
        elif kind == "facility":
            facility = (await session.execute(select(Facility).limit(1))).scalar_one()
            session.add(FacilityMembership(user_id=user.id, facility_id=facility.id, owner=True))
            await session.commit()
            return user, facility.id
        elif kind == "supplier":
            row = Supplier(
                name="Applicant Supplier",
                slug=f"supplier-{uuid.uuid4().hex[:8]}",
                country_code="KE",
                owner_user_id=user.id,
            )
        else:
            row = TrainingProvider(
                name="Applicant Training", country_code="KE", owner_user_id=user.id
            )
        session.add(row)
        await session.commit()
        return user, row.id


def _apply(kind: str) -> dict[str, object]:
    return {
        "subject_kind": kind,
        "licence_number": "LIC-12345",
        "issuing_body": "Dental Board",
        "document_keys": DOCS,
    }


async def _submit(client: AsyncClient, state: AppState, kind: str) -> tuple[User, str, str]:
    user, subject_id = await _applicant(state, kind)
    response = await client.post(
        "/api/v1/verifications", headers=_public_headers(state, user), json=_apply(kind)
    )
    assert response.status_code == 201, response.text
    return user, subject_id, response.json()["id"]


async def test_a_specialist_submits_and_sees_the_pending_application(
    client: AsyncClient, state: AppState
) -> None:
    user, subject_id, application_id = await _submit(client, state, "specialist")

    status = await client.get("/api/v1/me/verifications", headers=_public_headers(state, user))

    assert status.status_code == 200, status.text
    items = status.json()["items"]
    assert [item["id"] for item in items] == [application_id]
    assert items[0]["status"] == "pending"
    assert items[0]["subject_id"] == subject_id
    assert items[0]["document_keys"] == DOCS
    assert items[0]["rejection_reason"] is None


@pytest.mark.parametrize("kind", ["specialist", "facility", "supplier", "training_provider"])
async def test_each_profession_can_apply(client: AsyncClient, state: AppState, kind: str) -> None:
    _, _, application_id = await _submit(client, state, kind)

    assert application_id


async def test_a_patient_can_not_apply(client: AsyncClient, state: AppState) -> None:
    patient = await _make_user(state, role="patient", kind="patient")

    response = await client.post(
        "/api/v1/verifications", headers=_public_headers(state, patient), json=_apply("specialist")
    )

    assert response.status_code == 403


async def test_an_invalid_application_is_refused(client: AsyncClient, state: AppState) -> None:
    user, _ = await _applicant(state, "specialist")
    headers = _public_headers(state, user)

    no_documents = await client.post(
        "/api/v1/verifications", headers=headers, json={**_apply("specialist"), "document_keys": []}
    )
    blank_key = await client.post(
        "/api/v1/verifications",
        headers=headers,
        json={**_apply("specialist"), "document_keys": ["  "]},
    )

    assert no_documents.status_code == 422
    assert blank_key.status_code == 400


async def test_a_subject_can_not_have_two_pending_applications(
    client: AsyncClient, state: AppState
) -> None:
    user, _ = await _applicant(state, "specialist")
    headers = _public_headers(state, user)
    assert (
        await client.post("/api/v1/verifications", headers=headers, json=_apply("specialist"))
    ).status_code == 201

    duplicate = await client.post(
        "/api/v1/verifications", headers=headers, json=_apply("specialist")
    )

    assert duplicate.status_code == 409


async def test_admin_approval_verifies_the_public_listing(
    client: AsyncClient, state: AppState
) -> None:
    _, subject_id, application_id = await _submit(client, state, "specialist")
    admin = await _make_user(state, role="admin")
    headers = _staff_headers(state, admin)

    decision = await client.post(
        f"/api/v1/admin/verifications/{application_id}/approve", headers=headers, json={}
    )

    assert decision.status_code == 200, decision.text
    assert decision.json()["status"] == "verified"
    profile = await client.get(f"/api/v1/dentists/{subject_id}")
    assert profile.json()["listing"]["verification_tier"] == "verified"
    assert "document_keys" not in profile.json()


async def test_approval_verifies_a_supplier_boolean(client: AsyncClient, state: AppState) -> None:
    _, subject_id, application_id = await _submit(client, state, "supplier")
    admin = await _make_user(state, role="admin")

    decision = await client.post(
        f"/api/v1/admin/verifications/{application_id}/approve",
        headers=_staff_headers(state, admin),
        json={},
    )

    assert decision.status_code == 200, decision.text
    async with state.db_session_maker() as session:
        supplier = await session.get(Supplier, subject_id)
        assert supplier is not None and supplier.is_verified is True


async def test_rejection_needs_a_reason_and_blocks_approval(
    client: AsyncClient, state: AppState
) -> None:
    applicant, _, application_id = await _submit(client, state, "specialist")
    admin = await _make_user(state, role="admin")
    headers = _staff_headers(state, admin)

    no_reason = await client.post(
        f"/api/v1/admin/verifications/{application_id}/reject", headers=headers, json={}
    )
    assert no_reason.status_code == 400

    rejected = await client.post(
        f"/api/v1/admin/verifications/{application_id}/reject",
        headers=headers,
        json={"reason": "Unreadable licence"},
    )
    assert rejected.status_code == 200, rejected.text
    assert rejected.json()["status"] == "rejected"

    approve_after = await client.post(
        f"/api/v1/admin/verifications/{application_id}/approve", headers=headers, json={}
    )
    assert approve_after.status_code == 409

    mine = await client.get("/api/v1/me/verifications", headers=_public_headers(state, applicant))
    assert mine.json()["items"][0]["rejection_reason"] == "Unreadable licence"


async def test_revocation_needs_a_reason_and_drops_verification(
    client: AsyncClient, state: AppState
) -> None:
    _, subject_id, application_id = await _submit(client, state, "specialist")
    admin = await _make_user(state, role="admin")
    headers = _staff_headers(state, admin)
    assert (
        await client.post(
            f"/api/v1/admin/verifications/{application_id}/approve", headers=headers, json={}
        )
    ).status_code == 200

    no_reason = await client.post(
        f"/api/v1/admin/verifications/{application_id}/revoke", headers=headers, json={}
    )
    assert no_reason.status_code == 400

    revoked = await client.post(
        f"/api/v1/admin/verifications/{application_id}/revoke",
        headers=headers,
        json={"reason": "Licence withdrawn"},
    )
    assert revoked.status_code == 200, revoked.text
    assert revoked.json()["status"] == "revoked"
    async with state.db_session_maker() as session:
        listing = await session.get(Specialist, subject_id)
        assert listing is not None and listing.verification_tier == "unverified"


async def test_decisions_are_audited_and_emailed(client: AsyncClient, state: AppState) -> None:
    applicant, _, application_id = await _submit(client, state, "specialist")
    admin = await _make_user(state, role="admin")
    assert isinstance(state.mailer, ConsoleMailer)
    state.mailer.outbox.clear()

    await client.post(
        f"/api/v1/admin/verifications/{application_id}/approve",
        headers=_staff_headers(state, admin),
        json={},
    )

    audit = await client.get("/api/v1/admin/audit", headers=_staff_headers(state, admin))
    assert audit.json()["items"][0]["action"] == "verification.approve"
    assert len(state.mailer.outbox) == 1
    assert state.mailer.outbox[0].to == applicant.email
    assert "verified" in state.mailer.outbox[0].subject


async def test_operators_see_only_their_division_and_leads_decide(
    client: AsyncClient, state: AppState
) -> None:
    from tests.factories import build_operator

    _, _, dentist_application = await _submit(client, state, "specialist")
    await _submit(client, state, "supplier")
    lead = build_operator(division="dentist", tier="lead")
    assistant = build_operator(division="dentist", tier="assistant")
    async with state.db_session_maker() as session:
        session.add_all([lead, assistant])
        await session.commit()

    mine = await client.get("/api/v1/operations/verifications", headers=_staff_headers(state, lead))
    assert mine.status_code == 200, mine.text
    assert [row["subject_kind"] for row in mine.json()["items"]] == ["specialist"]

    assistant_try = await client.post(
        f"/api/v1/operations/verifications/{dentist_application}/approve",
        headers=_staff_headers(state, assistant),
        json={},
    )
    assert assistant_try.status_code == 403

    decision = await client.post(
        f"/api/v1/operations/verifications/{dentist_application}/approve",
        headers=_staff_headers(state, lead),
        json={},
    )
    assert decision.status_code == 200, decision.text


async def test_rejection_after_approval_is_refused(
    client: AsyncClient, state: AppState
) -> None:
    _, _, application_id = await _submit(client, state, "specialist")
    admin = await _make_user(state, role="admin")
    headers = _staff_headers(state, admin)
    assert (await client.post(
        f"/api/v1/admin/verifications/{application_id}/approve", headers=headers, json={}
    )).status_code == 200

    rejected = await client.post(
        f"/api/v1/admin/verifications/{application_id}/reject",
        headers=headers,
        json={"reason": "Too late"},
    )

    assert rejected.status_code == 409


async def test_a_terminal_application_can_be_reapplied_but_not_redecided(
    client: AsyncClient, state: AppState
) -> None:
    user, _, application_id = await _submit(client, state, "specialist")
    admin = await _make_user(state, role="admin")
    headers = _staff_headers(state, admin)
    public = _public_headers(state, user)

    assert (
        await client.post(
            f"/api/v1/admin/verifications/{application_id}/reject",
            headers=headers,
            json={"reason": "Incomplete"},
        )
    ).status_code == 200
    assert (
        await client.post(
            f"/api/v1/admin/verifications/{application_id}/approve", headers=headers, json={}
        )
    ).status_code == 409
    reapplied = await client.post(
        "/api/v1/verifications", headers=public, json=_apply("specialist")
    )
    assert reapplied.status_code == 201, reapplied.text
    mine = await client.get("/api/v1/me/verifications", headers=public)
    assert mine.json()["items"][0]["status"] == "pending"


async def test_an_operator_can_not_decide_another_divisions_application(
    client: AsyncClient, state: AppState
) -> None:
    from tests.factories import build_operator

    _, _, supplier_application = await _submit(client, state, "supplier")
    lead = build_operator(division="dentist", tier="lead")
    assistant = build_operator(division="dentist", tier="assistant")
    async with state.db_session_maker() as session:
        session.add_all([lead, assistant])
        await session.commit()

    read = await client.get(
        "/api/v1/operations/verifications", headers=_staff_headers(state, assistant)
    )
    assert read.status_code == 200, read.text
    assert read.json()["items"] == []

    decision = await client.post(
        f"/api/v1/operations/verifications/{supplier_application}/approve",
        headers=_staff_headers(state, lead),
        json={},
    )
    assert decision.status_code == 403


async def test_an_admin_sees_every_application(client: AsyncClient, state: AppState) -> None:
    await _submit(client, state, "specialist")
    await _submit(client, state, "supplier")
    admin = await _make_user(state, role="admin")

    response = await client.get(
        "/api/v1/admin/verifications/applications", headers=_staff_headers(state, admin)
    )

    assert response.status_code == 200, response.text
    assert {row["subject_kind"] for row in response.json()["items"]} == {
        "specialist",
        "supplier",
    }
