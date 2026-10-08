"""Listings: Facilities, Specialists, Branches, and their Opening Hours.

A listing is what search returns and what the UI renders as a card, so a clinic
and a dentist are deliberately the same shape (see ``DentistListing`` in
``app.logic.v1.listing``). Money, geography, and verification live on the
listing row; a Branch carries the address, contact, and Opening Hours that a
multi-site Facility has per location, because a clinic in two counties has two
sets of hours.

``country_code`` is a plain column rather than a foreign key, matching
``products``/``suppliers``: the catalog is scoped by market, and the country's
own currency, timezone, and labels are read from ``countries`` when a response
is built rather than denormalised onto every row.
"""

from __future__ import annotations

import uuid
from collections.abc import Sequence
from datetime import datetime, time
from decimal import Decimal
from typing import Any, Literal, get_args

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Time,
    UniqueConstraint,
    func,
    select,
)
from sqlalchemy import (
    Enum as SAEnum,
)
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Mapped, mapped_column, relationship, selectinload
from sqlalchemy.sql.expression import ColumnElement

from app.repositories.country import Specialty
from app.repositories.database import Base

#: The tiers a Facility is verified at. A Literal rather than a boolean because
#: the UI distinguishes at least three of them, and "verified" means different
#: things to a patient than "featured" means to the marketplace. The column type
#: below is built from this tuple so the two can never drift apart.
VerificationTier = Literal["unverified", "basic", "verified", "featured"]
VERIFICATION_TIERS = get_args(VerificationTier)


class Facility(Base):
    """A clinic or practice: one row per market-facing listing."""

    __tablename__ = "facilities"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )
    name: Mapped[str] = mapped_column(String(150), nullable=False, index=True)
    country_code: Mapped[str] = mapped_column(String(2), default="KE", index=True, nullable=False)
    subdivision_code: Mapped[str] = mapped_column(String(30), index=True, nullable=False)
    address: Mapped[str] = mapped_column(String(255), nullable=False)
    phone: Mapped[str | None] = mapped_column(String(30), nullable=True)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)

    verification_tier: Mapped[VerificationTier] = mapped_column(
        SAEnum(
            *VERIFICATION_TIERS,
            name="verification_tier",
            native_enum=False,
            length=20,
        ),
        default="unverified",
        nullable=False,
    )

    #: Every monetary record carries its own currency (root ``AGENTS.md``), so a
    #: price is never ambiguous even when the market's currency later changes.
    currency: Mapped[str] = mapped_column(String(3), nullable=False)
    #: The "from" price a card shows. Null when the Facility publishes none.
    list_price: Mapped[Decimal | None] = mapped_column(Numeric(12, 2), nullable=True)

    #: Seeded demo values until a reviews table exists; null means "no reviews
    #: yet", never a fabricated number.
    rating: Mapped[Decimal | None] = mapped_column(Numeric(3, 2), nullable=True)
    review_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    branches: Mapped[list[Branch]] = relationship(
        back_populates="facility",
        cascade="all, delete-orphan",
        order_by="Branch.name",
    )


class Specialist(Base):
    """An individual dental professional: a dentist, specialist, or intern."""

    __tablename__ = "specialists"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )
    name: Mapped[str] = mapped_column(String(150), nullable=False, index=True)
    #: The stable handle a profile URL carries, never the display name.
    slug: Mapped[str] = mapped_column(String(150), unique=True, index=True, nullable=False)
    country_code: Mapped[str] = mapped_column(String(2), default="KE", index=True, nullable=False)
    subdivision_code: Mapped[str] = mapped_column(String(30), index=True, nullable=False)

    currency: Mapped[str] = mapped_column(String(3), nullable=False)
    list_price: Mapped[Decimal | None] = mapped_column(Numeric(12, 2), nullable=True)

    rating: Mapped[Decimal | None] = mapped_column(Numeric(3, 2), nullable=True)
    review_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    specialties: Mapped[list[Specialty]] = relationship(secondary="specialist_specialties")
    branches: Mapped[list[Branch]] = relationship(secondary="dentist_branches")


class Branch(Base):
    """One physical location of a Facility.

    Opening hours and contact attach here, not to the Facility: a clinic with
    branches in two counties has two sets of hours, and "is it open" is asked
    about a place someone can drive to.
    """

    __tablename__ = "branches"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )
    facility_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("facilities.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    #: A label such as "Westlands"; null for a single-branch Facility.
    name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    subdivision_code: Mapped[str] = mapped_column(String(30), index=True, nullable=False)
    address: Mapped[str] = mapped_column(String(255), nullable=False)
    phone: Mapped[str | None] = mapped_column(String(30), nullable=True)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)

    facility: Mapped[Facility] = relationship(back_populates="branches")
    opening_hours: Mapped[list[OpeningHour]] = relationship(
        back_populates="branch",
        cascade="all, delete-orphan",
        order_by="OpeningHour.weekday",
    )


class OpeningHour(Base):
    """One weekday's hours for a Branch, with an explicit closed flag.

    Per ``CONTEXT.md`` "Opening Hours": stored per weekday rather than as a
    summary string, so "open now" is computed at read time in the Branch's
    Country instead of going stale in a column.
    """

    __tablename__ = "opening_hours"
    __table_args__ = (UniqueConstraint("branch_id", "weekday", name="uq_opening_hours_day"),)

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )
    branch_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("branches.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    #: Monday = 0 … Sunday = 6.
    weekday: Mapped[int] = mapped_column(Integer, nullable=False)
    #: Null when the Branch is closed that day.
    opens: Mapped[time | None] = mapped_column(Time, nullable=True)
    closes: Mapped[time | None] = mapped_column(Time, nullable=True)
    #: A day with no row at all is also closed; the flag exists so a Branch can
    #: publish "closed on Sunday" explicitly rather than by omission.
    is_closed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    branch: Mapped[Branch] = relationship(back_populates="opening_hours")


class DentistBranch(Base):
    """A Specialist works at more than one Branch."""

    __tablename__ = "dentist_branches"

    specialist_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("specialists.id", ondelete="CASCADE"),
        primary_key=True,
    )
    branch_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("branches.id", ondelete="CASCADE"),
        primary_key=True,
    )


class SpecialistSpecialty(Base):
    """The join that makes a Specialist's specialisms queryable."""

    __tablename__ = "specialist_specialties"

    specialist_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("specialists.id", ondelete="CASCADE"),
        primary_key=True,
    )
    specialty_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("specialties.id", ondelete="CASCADE"),
        primary_key=True,
    )


class FacilityFilters:
    """Filter set shared by :meth:`FacilityRepository.search` and ``count``."""

    def __init__(
        self,
        *,
        country_code: str,
        subdivision_code: str | None = None,
        verification_tier: VerificationTier | None = None,
    ) -> None:
        self.country_code = country_code
        self.subdivision_code = subdivision_code
        self.verification_tier = verification_tier

    def conditions(self) -> list[ColumnElement[bool]]:
        clauses: list[ColumnElement[bool]] = [Facility.country_code == self.country_code]

        if self.subdivision_code:
            clauses.append(Facility.subdivision_code == self.subdivision_code)

        if self.verification_tier:
            clauses.append(Facility.verification_tier == self.verification_tier)

        return clauses


class SpecialistFilters:
    """Filter set shared by :meth:`SpecialistRepository.search` and ``count``."""

    def __init__(
        self,
        *,
        country_code: str,
        subdivision_code: str | None = None,
        specialty_code: str | None = None,
    ) -> None:
        self.country_code = country_code
        self.subdivision_code = subdivision_code
        self.specialty_code = specialty_code

    def conditions(self) -> list[ColumnElement[bool]]:
        clauses: list[ColumnElement[bool]] = [Specialist.country_code == self.country_code]

        if self.subdivision_code:
            clauses.append(Specialist.subdivision_code == self.subdivision_code)

        return clauses


class FacilityRepository:
    """Reads and writes for Facilities."""

    @staticmethod
    async def search(
        session: AsyncSession,
        filters: FacilityFilters,
        *,
        limit: int,
        offset: int,
    ) -> list[Facility]:
        """One page of Facilities, ordered by name, branches eager-loaded."""
        stmt = (
            select(Facility)
            .options(
                selectinload(Facility.branches).selectinload(Branch.opening_hours),
            )
            .where(*filters.conditions())
            .order_by(Facility.name.asc())
            .limit(limit)
            .offset(offset)
        )
        result = await session.execute(stmt)
        return list(result.scalars().all())

    @staticmethod
    async def count(session: AsyncSession, filters: FacilityFilters) -> int:
        """Count Facilities matching the same filters :meth:`search` applies."""
        stmt = select(func.count()).select_from(Facility).where(*filters.conditions())
        result = await session.execute(stmt)
        return int(result.scalar_one())

    @staticmethod
    async def specialty_codes_by_facility(
        session: AsyncSession,
        facility_ids: list[str],
    ) -> dict[str, list[str]]:
        """Specialty codes for the Facilities that ``facility_ids`` name.

        A Facility has no specialism table of its own: what a clinic offers is
        exactly what its Specialists offer, so the codes are read through
        ``dentist_branches`` and never stored twice to drift apart.
        """
        if not facility_ids:
            return {}

        stmt = (
            select(Branch.facility_id, Specialty.code)
            .join(DentistBranch, DentistBranch.branch_id == Branch.id)
            .join(Specialist, Specialist.id == DentistBranch.specialist_id)
            .join(SpecialistSpecialty, SpecialistSpecialty.specialist_id == Specialist.id)
            .join(Specialty, Specialty.id == SpecialistSpecialty.specialty_id)
            .where(Branch.facility_id.in_(facility_ids))
            .order_by(Specialty.display_order.asc(), Specialty.name.asc())
        )
        result = await session.execute(stmt)

        mapped: dict[str, list[str]] = {facility_id: [] for facility_id in facility_ids}

        for facility_id, code in result.all():
            if code not in mapped[facility_id]:
                mapped[facility_id].append(code)

        return mapped

    @staticmethod
    async def get(session: AsyncSession, facility_id: str) -> Facility | None:
        """One Facility with its Branches and hours eagerly loaded."""
        stmt = (
            select(Facility)
            .options(selectinload(Facility.branches).selectinload(Branch.opening_hours))
            .where(Facility.id == facility_id)
        )
        result = await session.execute(stmt)
        return result.scalar_one_or_none()

    @staticmethod
    async def find(
        session: AsyncSession,
        *,
        name: str,
        country_code: str,
    ) -> Facility | None:
        """Look a Facility up by its natural key, for an idempotent seed."""
        stmt = select(Facility).where(
            Facility.name == name,
            Facility.country_code == country_code,
        )
        result = await session.execute(stmt)
        return result.scalar_one_or_none()

    @staticmethod
    async def create(session: AsyncSession, **kwargs: Any) -> Facility:
        """Create and persist a Facility."""
        facility = Facility(**kwargs)
        session.add(facility)
        await session.flush()
        return facility

    @staticmethod
    async def update(facility: Facility, **kwargs: Any) -> Facility:
        """Apply ``kwargs`` to an existing Facility (idempotent seed)."""
        for key, value in kwargs.items():
            setattr(facility, key, value)
        return facility


class SpecialistRepository:
    """Reads and writes for Specialists."""

    @staticmethod
    async def search(
        session: AsyncSession,
        filters: SpecialistFilters,
        *,
        limit: int,
        offset: int,
    ) -> list[Specialist]:
        """One page of Specialists, ordered by name, children eager-loaded."""
        stmt = (
            select(Specialist)
            .options(
                selectinload(Specialist.specialties),
                selectinload(Specialist.branches).selectinload(Branch.opening_hours),
                # The card carries the Branch's Facility (clinic name), so the
                # rows are loaded here too: the response is built detached.
                selectinload(Specialist.branches).selectinload(Branch.facility),
            )
            .where(*filters.conditions())
            .order_by(Specialist.name.asc())
            .limit(limit)
            .offset(offset)
        )

        if filters.specialty_code:
            stmt = (
                stmt.join(SpecialistSpecialty, SpecialistSpecialty.specialist_id == Specialist.id)
                .join(Specialty, Specialty.id == SpecialistSpecialty.specialty_id)
                .where(Specialty.code == filters.specialty_code)
            )

        result = await session.execute(stmt)
        return list(result.scalars().unique().all())

    @staticmethod
    async def count(session: AsyncSession, filters: SpecialistFilters) -> int:
        """Count Specialists matching the same filters :meth:`search` applies."""
        stmt = select(func.count()).select_from(Specialist).where(*filters.conditions())

        if filters.specialty_code:
            stmt = (
                stmt.join(SpecialistSpecialty, SpecialistSpecialty.specialist_id == Specialist.id)
                .join(Specialty, Specialty.id == SpecialistSpecialty.specialty_id)
                .where(Specialty.code == filters.specialty_code)
            )

        result = await session.execute(stmt)
        return int(result.scalar_one())

    @staticmethod
    async def get(session: AsyncSession, specialist_id: str) -> Specialist | None:
        """One Specialist with specialisms and Branches eagerly loaded."""
        stmt = (
            select(Specialist)
            .options(
                selectinload(Specialist.specialties),
                selectinload(Specialist.branches).selectinload(Branch.opening_hours),
                selectinload(Specialist.branches).selectinload(Branch.facility),
            )
            .where(Specialist.id == specialist_id)
        )
        result = await session.execute(stmt)
        return result.scalar_one_or_none()

    @staticmethod
    async def find_by_slug(session: AsyncSession, slug: str) -> Specialist | None:
        """Look a Specialist up by slug, for an idempotent seed."""
        stmt = select(Specialist).where(Specialist.slug == slug)
        result = await session.execute(stmt)
        return result.scalar_one_or_none()

    @staticmethod
    async def create(session: AsyncSession, **kwargs: Any) -> Specialist:
        """Create and persist a Specialist."""
        specialist = Specialist(**kwargs)
        session.add(specialist)
        await session.flush()
        return specialist

    @staticmethod
    async def update(specialist: Specialist, **kwargs: Any) -> Specialist:
        """Apply ``kwargs`` to an existing Specialist (idempotent seed)."""
        for key, value in kwargs.items():
            setattr(specialist, key, value)
        return specialist

    @staticmethod
    async def attach_branch(
        session: AsyncSession,
        specialist: Specialist,
        branch: Branch,
    ) -> None:
        """Link a Specialist to a Branch where they work, if not already linked.

        A query rather than ``specialist.branches``: the seed writes from a
        session that has not loaded that collection, and a lazy load cannot be
        awaited on an async session.
        """
        existing = await session.execute(
            select(DentistBranch).where(
                DentistBranch.specialist_id == specialist.id,
                DentistBranch.branch_id == branch.id,
            )
        )

        if existing.scalar_one_or_none() is None:
            session.add(DentistBranch(specialist_id=specialist.id, branch_id=branch.id))
            await session.flush()

    @staticmethod
    async def attach_specialty(
        session: AsyncSession,
        specialist: Specialist,
        specialty: Specialty,
    ) -> None:
        """Link a Specialist to a Specialty, if not already linked."""
        existing = await session.execute(
            select(SpecialistSpecialty).where(
                SpecialistSpecialty.specialist_id == specialist.id,
                SpecialistSpecialty.specialty_id == specialty.id,
            )
        )

        if existing.scalar_one_or_none() is None:
            session.add(SpecialistSpecialty(specialist_id=specialist.id, specialty_id=specialty.id))
            await session.flush()


class BranchRepository:
    """Reads and writes for Branches and their Opening Hours."""

    @staticmethod
    async def find(
        session: AsyncSession,
        *,
        facility_id: str,
        address: str,
    ) -> Branch | None:
        """Look a Branch up by its natural key, for an idempotent seed."""
        stmt = select(Branch).where(
            Branch.facility_id == facility_id,
            Branch.address == address,
        )
        result = await session.execute(stmt)
        return result.scalar_one_or_none()

    @staticmethod
    async def create(session: AsyncSession, **kwargs: Any) -> Branch:
        """Create and persist a Branch."""
        branch = Branch(**kwargs)
        session.add(branch)
        await session.flush()
        return branch

    @staticmethod
    async def update(branch: Branch, **kwargs: Any) -> Branch:
        """Apply ``kwargs`` to an existing Branch (idempotent seed)."""
        for key, value in kwargs.items():
            setattr(branch, key, value)
        return branch

    @staticmethod
    async def replace_hours(
        session: AsyncSession,
        branch_id: str,
        hours: Sequence[tuple[int, time | None, time | None, bool]],
    ) -> None:
        """Replace a Branch's whole week with ``hours``.

        Rows are given as ``(weekday, opens, closes, is_closed)`` and the old
        week is dropped first, so a day that was open and is now closed cannot
        survive as a stale row. Idempotent: re-running with the same week
        leaves the same rows.
        """
        existing = await session.execute(
            select(OpeningHour).where(OpeningHour.branch_id == branch_id)
        )

        for row in existing.scalars().all():
            await session.delete(row)

        # Flush the deletes first: a delete and an insert of the same unique
        # (branch_id, weekday) in one flush can execute insert-first and trip
        # the unique constraint.
        await session.flush()

        for weekday, opens, closes, is_closed in hours:
            session.add(
                OpeningHour(
                    branch_id=branch_id,
                    weekday=weekday,
                    opens=opens,
                    closes=closes,
                    is_closed=is_closed,
                )
            )

        await session.flush()
