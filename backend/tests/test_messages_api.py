"""HTTP-level tests for the messaging inbox and threads (PRD §3.9).

Participants are real accounts registered through the API, because a thread's
``kind`` is derived from the two account roles: the roles are the fixture.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

import pytest
from httpx import AsyncClient
from sqlalchemy import or_, update
from sqlalchemy.ext.asyncio import async_sessionmaker

from app.logic.v1.auth import create_access_token, hash_password
from app.repositories.message import Conversation
from app.repositories.user import UserRepository
from app.utils.state import AppState

PASSWORD = "correct horse battery staple"


async def _register(
    client: AsyncClient,
    *,
    account_type: str,
    full_name: str,
) -> dict[str, Any]:
    """Register an account and return its id plus an Authorization header."""
    body: dict[str, Any] = {
        "full_name": full_name,
        "email": f"{uuid.uuid4().hex[:12]}@example.com",
        "password": PASSWORD,
        "account_type": account_type,
    }
    if account_type == "facility_owner":
        body["facility"] = {
            "name": full_name,
            "subdivision_code": "NAIROBI",
            "address": "Waiyaki Way, Westlands",
        }
    response = await client.post("/api/v1/auth/register", json=body)
    assert response.status_code == 200, response.text
    body = response.json()
    return {
        "id": body["user"]["id"],
        "headers": {"Authorization": f"Bearer {body['access_token']}"},
    }


async def _direct_user(
    state: AppState,
    session_maker: async_sessionmaker[Any],
    *,
    role: str,
    is_active: bool = True,
) -> dict[str, Any]:
    """A user public signup cannot create (a staff or facility-side role), plus a token."""
    async with session_maker() as session:
        user = await UserRepository.create(
            session,
            full_name=f"Direct {role}",
            email=f"{role}-{uuid.uuid4().hex[:8]}@example.com",
            password_hash=hash_password(PASSWORD),
            role=role,
            is_active=is_active,
        )
        await session.commit()
        user_id = user.id
    token = create_access_token(state, user_id, role)
    return {"id": user_id, "headers": {"Authorization": f"Bearer {token}"}}


async def _start(client: AsyncClient, sender: dict[str, Any], recipient_id: str, body: str):
    return await client.post(
        "/api/v1/messages/conversations",
        headers=sender["headers"],
        json={"recipient_id": recipient_id, "body": body},
    )


async def test_a_patient_and_a_facility_open_a_thread_and_read_it_back(
    client: AsyncClient,
) -> None:
    patient = await _register(client, account_type="patient", full_name="Amina Wanjiku")
    facility = await _register(client, account_type="facility_owner", full_name="Westlands Dental")

    opened = await _start(client, patient, facility["id"], "Do you have a Saturday slot?")
    assert opened.status_code == 200, opened.text
    conversation = opened.json()
    assert conversation["kind"] == "patient_facility"
    assert conversation["unread_count"] == 0  # the sender's own counter never moves
    assert conversation["other_participant"]["id"] == facility["id"]
    assert conversation["last_message"]["body"] == "Do you have a Saturday slot?"
    assert conversation["last_message"]["sender_name"] == "Amina Wanjiku"

    thread = await client.get(
        f"/api/v1/messages/conversations/{conversation['id']}",
        headers=facility["headers"],
    )
    assert thread.status_code == 200, thread.text
    page = thread.json()
    assert page["conversation"]["unread_count"] == 1
    assert page["conversation"]["other_participant"]["full_name"] == "Amina Wanjiku"
    assert page["total"] == 1
    assert page["messages"][0]["body"] == "Do you have a Saturday slot?"
    assert page["messages"][0]["sender_name"] == "Amina Wanjiku"


@pytest.mark.parametrize(
    ("role_a", "role_b", "kind"),
    [
        ("patient", "facility_owner", "patient_facility"),
        ("patient", "dentist", "patient_dentist"),
        ("dentist", "supplier", "dentist_supplier"),
        ("patient", "supplier", "patient_shop"),
        ("facility_owner", "supplier", "clinic_shop_bulk"),
        ("dentist", "training_provider", "dentist_training"),
    ],
)
async def test_every_documented_pairing_derives_its_kind(
    client: AsyncClient,
    role_a: str,
    role_b: str,
    kind: str,
) -> None:
    sender = await _register(client, account_type=role_a, full_name="Sender One")
    recipient = await _register(client, account_type=role_b, full_name="Recipient Two")

    response = await _start(client, sender, recipient["id"], "Hello")
    assert response.status_code == 200, response.text
    assert response.json()["kind"] == kind


async def test_roles_without_a_pairing_cannot_open_a_thread(client: AsyncClient) -> None:
    patient = await _register(client, account_type="patient", full_name="Patient One")
    other_patient = await _register(client, account_type="patient", full_name="Patient Two")
    facility = await _register(client, account_type="facility_owner", full_name="A Clinic")
    trainer = await _register(client, account_type="training_provider", full_name="A Trainer")

    same_role = await _start(client, patient, other_patient["id"], "Hello")
    assert same_role.status_code == 400
    assert same_role.json()["message"] == "These accounts cannot message each other"

    unsupported = await _start(client, trainer, facility["id"], "Hello")
    assert unsupported.status_code == 400
    assert unsupported.json()["message"] == "These accounts cannot message each other"


async def test_the_inbox_only_serves_the_callers_conversations(client: AsyncClient) -> None:
    sender = await _register(client, account_type="patient", full_name="Sender One")
    recipient = await _register(client, account_type="facility_owner", full_name="A Clinic")
    stranger = await _register(client, account_type="patient", full_name="Stranger Here")

    opened = await _start(client, sender, recipient["id"], "Hello")
    conversation_id = opened.json()["id"]

    listed = await client.get("/api/v1/messages/conversations", headers=stranger["headers"])
    assert listed.status_code == 200
    assert listed.json()["items"] == []
    assert listed.json()["total"] == 0

    # A stranger's thread and an unknown id answer the same 404, so thread ids
    # cannot be probed for existence.
    read = await client.get(
        f"/api/v1/messages/conversations/{conversation_id}",
        headers=stranger["headers"],
    )
    assert read.status_code == 404
    assert read.json()["message"] == "Conversation not found"

    unknown = await client.get(
        f"/api/v1/messages/conversations/{uuid.uuid4()}",
        headers=stranger["headers"],
    )
    assert unknown.status_code == 404
    assert unknown.json()["message"] == "Conversation not found"

    write = await client.post(
        f"/api/v1/messages/conversations/{conversation_id}/messages",
        headers=stranger["headers"],
        json={"body": "Not mine"},
    )
    assert write.status_code == 404


async def test_unread_counts_accumulate_for_the_recipient_and_clear_on_read(
    client: AsyncClient,
) -> None:
    patient = await _register(client, account_type="patient", full_name="Amina Wanjiku")
    facility = await _register(client, account_type="facility_owner", full_name="A Clinic")

    first = await _start(client, patient, facility["id"], "One")
    conversation_id = first.json()["id"]

    # Messaging the same person again continues the thread instead of forking one.
    second = await _start(client, patient, facility["id"], "Two")
    assert second.json()["id"] == conversation_id

    send = await client.post(
        f"/api/v1/messages/conversations/{conversation_id}/messages",
        headers=patient["headers"],
        json={"body": "Three"},
    )
    assert send.status_code == 200, send.text

    listed = await client.get("/api/v1/messages/conversations", headers=facility["headers"])
    items = listed.json()["items"]
    assert listed.json()["total"] == 1
    assert items[0]["unread_count"] == 3

    mine = await client.get("/api/v1/messages/conversations", headers=patient["headers"])
    assert mine.json()["items"][0]["unread_count"] == 0

    # Reading the thread is not marking it read; only the read endpoint is.
    thread = await client.get(
        f"/api/v1/messages/conversations/{conversation_id}",
        headers=facility["headers"],
    )
    assert thread.json()["conversation"]["unread_count"] == 3

    marked = await client.post(
        f"/api/v1/messages/conversations/{conversation_id}/read",
        headers=facility["headers"],
    )
    assert marked.status_code == 200
    assert marked.json()["unread_count"] == 0

    listed_again = await client.get("/api/v1/messages/conversations", headers=facility["headers"])
    assert listed_again.json()["items"][0]["unread_count"] == 0


async def test_the_inbox_lists_newest_activity_first(
    client: AsyncClient,
    session_maker: async_sessionmaker[Any],
) -> None:
    patient = await _register(client, account_type="patient", full_name="Amina Wanjiku")
    first_clinic = await _register(client, account_type="facility_owner", full_name="First Clinic")
    second_clinic = await _register(
        client, account_type="facility_owner", full_name="Second Clinic"
    )

    started_first = await _start(client, patient, first_clinic["id"], "Hello first")
    await _start(client, patient, second_clinic["id"], "Hello second")

    # Timestamps are second-precision, so the ordering key is set explicitly
    # rather than racing the clock within one test.
    async with session_maker() as session:
        for recipient_id, moment in (
            (first_clinic["id"], datetime(2026, 1, 2, 10, 0, 0)),
            (second_clinic["id"], datetime(2026, 1, 3, 10, 0, 0)),
        ):
            await session.execute(
                update(Conversation)
                .where(
                    or_(
                        Conversation.participant_a_id == recipient_id,
                        Conversation.participant_b_id == recipient_id,
                    )
                )
                .values(last_message_at=moment)
            )
        await session.commit()

    # Give the first thread the newest activity, and it should move to the top.
    async with session_maker() as session:
        await session.execute(
            update(Conversation)
            .where(Conversation.id == started_first.json()["id"])
            .values(last_message_at=datetime(2026, 1, 4, 10, 0, 0))
        )
        await session.commit()

    listed = await client.get("/api/v1/messages/conversations", headers=patient["headers"])
    items = listed.json()["items"]
    assert [item["other_participant"]["id"] for item in items] == [
        first_clinic["id"],
        second_clinic["id"],
    ]


async def test_messaging_requires_a_token(client: AsyncClient) -> None:
    response = await client.get("/api/v1/messages/conversations")
    assert response.status_code == 401


async def test_a_staff_account_cannot_use_messaging(
    client: AsyncClient,
    state: AppState,
    session_maker: async_sessionmaker[Any],
) -> None:
    admin = await _direct_user(state, session_maker, role="admin")
    patient = await _register(client, account_type="patient", full_name="Amina Wanjiku")

    listed = await client.get("/api/v1/messages/conversations", headers=admin["headers"])
    assert listed.status_code == 403
    assert listed.json()["message"] == "Messaging is available to marketplace accounts only"

    # Staff are not a pairing side either: the recipient check runs after the
    # caller's own gate and reports the pairing, not the role.
    to_staff = await _start(client, patient, admin["id"], "Hello")
    assert to_staff.status_code == 400
    assert to_staff.json()["message"] == "These accounts cannot message each other"


async def test_a_deactivated_account_cannot_message(
    client: AsyncClient,
    state: AppState,
    session_maker: async_sessionmaker[Any],
) -> None:
    deactivated = await _direct_user(state, session_maker, role="patient", is_active=False)

    listed = await client.get("/api/v1/messages/conversations", headers=deactivated["headers"])
    assert listed.status_code == 403
    assert listed.json()["message"] == "User account is deactivated"


async def test_starting_a_thread_with_yourself_is_rejected(client: AsyncClient) -> None:
    patient = await _register(client, account_type="patient", full_name="Amina Wanjiku")

    response = await _start(client, patient, patient["id"], "Dear diary")
    assert response.status_code == 400
    assert response.json()["message"] == "You cannot message yourself"


async def test_a_recipient_that_does_not_exist_is_404(client: AsyncClient) -> None:
    patient = await _register(client, account_type="patient", full_name="Amina Wanjiku")

    response = await _start(client, patient, str(uuid.uuid4()), "Hello?")
    assert response.status_code == 404
    assert response.json()["message"] == "Recipient not found"


async def test_a_message_body_over_the_cap_is_422(client: AsyncClient) -> None:
    patient = await _register(client, account_type="patient", full_name="Amina Wanjiku")
    facility = await _register(client, account_type="facility_owner", full_name="A Clinic")

    response = await _start(client, patient, facility["id"], "x" * 4001)
    assert response.status_code == 422


async def test_the_message_body_cap_boundary_is_accepted(client: AsyncClient) -> None:
    patient = await _register(client, account_type="patient", full_name="Amina Wanjiku")
    facility = await _register(client, account_type="facility_owner", full_name="A Clinic")

    response = await _start(client, patient, facility["id"], "x" * 4000)
    assert response.status_code == 200, response.text


@pytest.mark.parametrize("role", ["front_office", "facility_dentist"])
async def test_facility_side_roles_pair_as_patient_facility(
    client: AsyncClient,
    state: AppState,
    session_maker: async_sessionmaker[Any],
    role: str,
) -> None:
    """Roles public signup cannot create still message: they are facility-side."""
    patient = await _register(client, account_type="patient", full_name="Amina Wanjiku")
    facility_staff = await _direct_user(state, session_maker, role=role)

    response = await _start(client, patient, facility_staff["id"], "Hello")
    assert response.status_code == 200, response.text
    assert response.json()["kind"] == "patient_facility"
