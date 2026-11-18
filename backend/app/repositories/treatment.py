"""Platform-wide treatment reference data.

A Treatment is the catalogue a Branch draws its Services from: "Root canal",
"Scale and polish", "Dental implant". Unlike Insurance Providers or Subdivisions
it is not scoped to a Country, because the clinical vocabulary is the same in
every market.

A retired Treatment is hidden from the public list but kept on every Service
that already names it, so a Branch's price history stays readable.
"""

from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy import Boolean, Integer, String, Text, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Mapped, mapped_column

from app.repositories.database import Base


class Treatment(Base):
    """A platform-wide dental treatment, chosen for a Branch's Services."""

    __tablename__ = "treatments"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    code: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    #: Presentation order in the Service picker; lower sorts first.
    display_order: Mapped[int] = mapped_column(Integer, default=100, nullable=False)
    #: A retired Treatment drops out of the public list but stays on Services.
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


class TreatmentRepository:
    """Reads and writes for the platform-wide treatment list."""

    @staticmethod
    async def list_all(
        session: AsyncSession,
        *,
        include_inactive: bool = False,
    ) -> list[Treatment]:
        """Every Treatment in display order, then alphabetically."""
        stmt = select(Treatment)
        if not include_inactive:
            stmt = stmt.where(Treatment.is_active.is_(True))
        result = await session.execute(
            stmt.order_by(Treatment.display_order.asc(), Treatment.name.asc())
        )
        return list(result.scalars().all())

    @staticmethod
    async def get(session: AsyncSession, treatment_id: str) -> Treatment | None:
        """Fetch one Treatment by id."""
        stmt = select(Treatment).where(Treatment.id == treatment_id)
        result = await session.execute(stmt)
        return result.scalar_one_or_none()

    @staticmethod
    async def get_by_code(session: AsyncSession, code: str) -> Treatment | None:
        """Fetch one Treatment by its stable code."""
        stmt = select(Treatment).where(Treatment.code == code)
        result = await session.execute(stmt)
        return result.scalar_one_or_none()

    @staticmethod
    async def create(session: AsyncSession, **kwargs: Any) -> Treatment:
        """Create and persist a Treatment."""
        treatment = Treatment(**kwargs)
        session.add(treatment)
        await session.flush()
        return treatment
