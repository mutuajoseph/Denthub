"""Specialist dashboard appointments (#151)."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import async_sessionmaker

from app.logic.v1.auth import create_access_token, hash_password
from app.repositories.listing import Specialist
from app.repositories.user import User
from app.utils.state import AppState

PASSWORD = "correct horse battery staple"
PASSWORD_HASH = hash_password(PASSWORD)


async def _user(state: AppState, email: str, *, role: str = "specialist") -> User:
    async with state.db_session_maker() as session:
        user = User(
            full_name="Dr. Test",
            email=email,
            role=role,
            password_hash=PASSWORD_HASH,
            is_active=True,
            account_status="active",
        )
        session.add(user)
        await session.commit()
        await session.refresh(user)
        return user


async def _specialist(state: AppState, owner: User, name: str) -> str:
    async with state.db_session_maker() as session:
        specialist = Specialist(
            name=name,
            slug=f"{name.lower().replace(' ', '-')}-{uuid.uuid4().hex[:8]}",
            user_id=owner.id,
            country_code="KE",
            subdivision_code="NAIROBI",
            currency="KES",
        )
        session.add(specialist)
        await session.commit()
        await session.refresh(specialist)
        return specialist.id


async def _appointment(state: AppState, specialist_id: str) -> str:
    async with state.db_session_maker() as session:
        from app.repositories.appointment import Appointment

        appointment = Appointment(
            id=str(uuid.uuid4()),
            patient_id=str(uuid.uuid4()),
            specialist_id=specialist_id,
            facility_id=None,
            country_code="KE",
            scheduled_at=datetime.now(UTC).replace(tzinfo=None) + timedelta(days=1),
            status="PENDING",
            created_at=datetime.now(UTC).replace(tzinfo=None),
        )
        session.add(appointment)
        await session.commit()
        return appointment.id


def _headers(state: AppState, user: User) -> dict[str, str]:
    return {"Authorization": f"Bearer {create_access_token(state, user.id, user.role)}"}


async def test_specialist_sees_only_own_appointments(
    client: AsyncClient,
    state: AppState,
    session_maker: async_sessionmaker,  # noqa: ARG001
) -> None:
    owner = await _user(state, "owner@example.com")
    other = await _user(state, "other@example.com")
    own_id = await _specialist(state, owner, "Dr. Owner")
    other_id = await _specialist(state, other, "Dr. Other")
    own_appt = await _appointment(state, own_id)
    await _appointment(state, other_id)

    response = await client.get(
        "/api/v1/dentists/me/appointments",
        headers=_headers(state, owner),
    )

    assert response.status_code == 200
    body = response.json()
    assert len(body) == 1
    assert body[0]["id"] == own_appt
    assert body[0]["listing_name"] == "Dr. Owner"


async def test_specialist_without_listing_gets_empty_list(
    client: AsyncClient,
    state: AppState,
    session_maker: async_sessionmaker,  # noqa: ARG001
) -> None:
    user = await _user(state, "orphan@example.com")

    response = await client.get(
        "/api/v1/dentists/me/appointments",
        headers=_headers(state, user),
    )

    assert response.status_code == 200
    assert response.json() == []


async def test_non_specialist_role_is_forbidden(
    client: AsyncClient,
    state: AppState,
    session_maker: async_sessionmaker,  # noqa: ARG001
) -> None:
    user = await _user(state, "patient@example.com", role="patient")

    response = await client.get(
        "/api/v1/dentists/me/appointments",
        headers=_headers(state, user),
    )

    assert response.status_code == 403
