"""User database model and Repository layer.

Handles low-level persistence operations for users.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Literal, get_args

from sqlalchemy import Boolean, DateTime, ForeignKey, String, select
from sqlalchemy import Enum as SAEnum
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.repositories.database import Base

#: The Divisions a Platform Operator can be scoped to (``CONTEXT.md``
#: "Operator", PRD §2). One Operator belongs to exactly one of these.
OperatorDivision = Literal["jobs", "shop", "training", "dentist", "international", "suppliers"]
OPERATOR_DIVISIONS = get_args(OperatorDivision)

#: What an Operator may do inside their Division. A Lead writes; an Assistant
#: only reads.
OperatorTier = Literal["lead", "assistant"]
OPERATOR_TIERS = get_args(OperatorTier)


class User(Base):
    """User DB model."""

    __tablename__ = "users"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )
    full_name: Mapped[str] = mapped_column(String(100), nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(50), default="patient", nullable=False)
    account_status: Mapped[str] = mapped_column(String(20), default="active", nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    #: The Facility a facility-scoped account works at (owner, front office,
    #: facility dentist). Null for patients and every other role, and null for a
    #: facility user not yet linked to a listing (#81). SET NULL rather than
    #: RESTRICT: losing a clinic should not delete its people.
    facility_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey("facilities.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    #: The user's preferred/home country code (ISO-3166 alpha-2).
    #: Used for defaulting searches, pricing, and the specialist listing country.
    home_country_code: Mapped[str | None] = mapped_column(
        String(2),
        ForeignKey("countries.code", ondelete="SET NULL"),
        nullable=True,
    )

    #: A Platform Operator's one Division and their tier inside it (PRD §2,
    #: ``CONTEXT.md`` "Operator"). Both null for every non-operator, and the
    #: console reads them fresh per request so granting or revoking a Division
    #: takes effect at once. The pair is set by staff; it is never request input.
    operator_division: Mapped[OperatorDivision | None] = mapped_column(
        SAEnum(
            *OPERATOR_DIVISIONS,
            name="operator_division",
            native_enum=False,
            length=20,
        ),
        nullable=True,
    )
    operator_tier: Mapped[OperatorTier | None] = mapped_column(
        SAEnum(
            *OPERATOR_TIERS,
            name="operator_tier",
            native_enum=False,
            length=20,
        ),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


class UserRepository:
    """Repository for user persistence operations."""

    @staticmethod
    async def get_by_email(session: AsyncSession, email: str) -> User | None:
        """Retrieve user by email."""
        stmt = select(User).where(User.email == email)
        result = await session.execute(stmt)
        return result.scalar_one_or_none()

    @staticmethod
    async def get_by_id(session: AsyncSession, user_id: str) -> User | None:
        """Retrieve user by ID."""
        stmt = select(User).where(User.id == user_id)
        result = await session.execute(stmt)
        return result.scalar_one_or_none()

    @staticmethod
    async def create(session: AsyncSession, **kwargs: Any) -> User:
        """Create and persist a new user."""
        user = User(**kwargs)
        session.add(user)
        # Flush to generate IDs/timestamps before returning
        await session.flush()
        return user

    @staticmethod
    async def names_by_ids(session: AsyncSession, user_ids: list[str]) -> dict[str, str]:
        """Resolve full names for a batch of user ids, keyed by id (#84).

        One query for a whole page of Health Record entries; an id with no row is
        absent, which the caller renders as a deleted author.
        """
        if not user_ids:
            return {}

        stmt = select(User.id, User.full_name).where(User.id.in_(user_ids))
        rows = await session.execute(stmt)
        return {row.id: row.full_name for row in rows.all()}

    @staticmethod
    async def list_for_facility(session: AsyncSession, *, facility_id: str) -> list[User]:
        """The active users linked to a Facility — its staff, by name (#81)."""
        stmt = (
            select(User)
            .where(User.facility_id == facility_id, User.is_active)
            .order_by(User.full_name.asc())
        )
        result = await session.execute(stmt)
        return list(result.scalars().all())
