"""Jobs board: JobPostings, their salary ranges, and the specialty join.

A posting belongs to a real Branch (a Workplace, per ``CONTEXT.md``), never to a
typed-in employer name: the board can filter by company through the listing
tables and a card links to the Branch's Facility. Money lives in
``job_salary_ranges`` with a per-row ``currency``, so an amount is never
ambiguous even if the market's currency later changes.

``status`` defaults to ``published``; the public read paths only ever select
published rows, so a draft can never leak by guessing a URL.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import (
    DateTime,
    ForeignKey,
    Numeric,
    String,
    Text,
    delete,
    func,
    select,
)
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Mapped, mapped_column, relationship, selectinload
from sqlalchemy.sql.expression import ColumnElement

from app.repositories.country import Specialty
from app.repositories.database import Base
from app.repositories.listing import Branch


class JobPosting(Base):
    """A published job advert attached to the Branch that is hiring."""

    __tablename__ = "job_postings"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False, index=True)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    requirements: Mapped[str | None] = mapped_column(Text, nullable=True)

    country_code: Mapped[str] = mapped_column(String(2), default="KE", index=True, nullable=False)
    subdivision_code: Mapped[str] = mapped_column(String(30), index=True, nullable=False)
    branch_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("branches.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    employment_type: Mapped[str] = mapped_column(String(30), nullable=False, index=True)
    seniority: Mapped[str] = mapped_column(String(30), nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="published", nullable=False, index=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
    #: When the advert went, or goes, live. The card shows "Posted X days ago".
    posted_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), nullable=False, index=True
    )

    branch: Mapped[Branch] = relationship()
    salary_ranges: Mapped[list[JobSalaryRange]] = relationship(
        back_populates="posting",
        cascade="all, delete-orphan",
        order_by="JobSalaryRange.min_amount",
    )
    specialties: Mapped[list[Specialty]] = relationship(secondary="job_postings_specialties")


class JobPostingSpecialty(Base):
    """The join that makes "dentist jobs in orthodontics" a query."""

    __tablename__ = "job_postings_specialties"

    posting_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("job_postings.id", ondelete="CASCADE"),
        primary_key=True,
    )
    specialty_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("specialties.id", ondelete="CASCADE"),
        primary_key=True,
    )


class JobSalaryRange(Base):
    """One salary band for a posting, with its own currency.

    A posting may carry several bands; the public response shows the lowest
    minimum as the headline figure. ``min_amount`` and ``max_amount`` are both
    nullable only so a one-sided figure can exist; at least one of the two is
    always present (enforced in the logic layer and the seed), and the
    ``currency`` is required on every row.
    """

    __tablename__ = "job_salary_ranges"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )
    posting_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("job_postings.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    currency: Mapped[str] = mapped_column(String(3), nullable=False)
    min_amount: Mapped[Decimal | None] = mapped_column(Numeric(12, 2), nullable=True)
    max_amount: Mapped[Decimal | None] = mapped_column(Numeric(12, 2), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), nullable=False
    )

    posting: Mapped[JobPosting] = relationship(back_populates="salary_ranges")


class JobFilters:
    """Filter set shared by :meth:`JobsRepository.search` and ``count``.

    ``status`` is locked to ``published`` here: the public board never serves a
    draft, so a caller cannot ask the repository to hand one over.
    """

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
        clauses: list[ColumnElement[bool]] = [
            JobPosting.status == "published",
            JobPosting.country_code == self.country_code,
        ]

        if self.subdivision_code:
            clauses.append(JobPosting.subdivision_code == self.subdivision_code)

        return clauses


class JobsRepository:
    """Reads and writes for the jobs board."""

    @staticmethod
    async def search(
        session: AsyncSession,
        filters: JobFilters,
        *,
        limit: int,
        offset: int,
    ) -> list[JobPosting]:
        """One page of published postings, newest first, children eager-loaded."""
        stmt = (
            select(JobPosting)
            .options(
                selectinload(JobPosting.salary_ranges),
                selectinload(JobPosting.specialties),
                selectinload(JobPosting.branch).selectinload(Branch.facility),
            )
            .where(*filters.conditions())
            .order_by(JobPosting.posted_at.desc(), JobPosting.title.asc())
            .limit(limit)
            .offset(offset)
        )

        if filters.specialty_code:
            stmt = (
                stmt.join(JobPostingSpecialty, JobPostingSpecialty.posting_id == JobPosting.id)
                .join(Specialty, Specialty.id == JobPostingSpecialty.specialty_id)
                .where(Specialty.code == filters.specialty_code)
            )

        result = await session.execute(stmt)
        return list(result.scalars().unique().all())

    @staticmethod
    async def count(session: AsyncSession, filters: JobFilters) -> int:
        """Count published postings matching the same filters :meth:`search` applies."""
        stmt = select(func.count()).select_from(JobPosting).where(*filters.conditions())

        if filters.specialty_code:
            stmt = (
                stmt.join(JobPostingSpecialty, JobPostingSpecialty.posting_id == JobPosting.id)
                .join(Specialty, Specialty.id == JobPostingSpecialty.specialty_id)
                .where(Specialty.code == filters.specialty_code)
            )

        result = await session.execute(stmt)
        return int(result.scalar_one())

    @staticmethod
    async def get(session: AsyncSession, posting_id: str) -> JobPosting | None:
        """One published posting with its range, specialisms, and Workplace."""
        stmt = (
            select(JobPosting)
            .options(
                selectinload(JobPosting.salary_ranges),
                selectinload(JobPosting.specialties),
                selectinload(JobPosting.branch).selectinload(Branch.facility),
            )
            .where(
                JobPosting.id == posting_id,
                JobPosting.status == "published",
            )
        )
        result = await session.execute(stmt)
        return result.scalar_one_or_none()

    @staticmethod
    async def find(
        session: AsyncSession,
        *,
        title: str,
        branch_id: str,
    ) -> JobPosting | None:
        """Look a posting up by its natural key, for an idempotent seed."""
        stmt = select(JobPosting).where(
            JobPosting.title == title,
            JobPosting.branch_id == branch_id,
        )
        result = await session.execute(stmt)
        return result.scalar_one_or_none()

    @staticmethod
    async def create(session: AsyncSession, **kwargs: Any) -> JobPosting:
        """Create and persist a JobPosting."""
        posting = JobPosting(**kwargs)
        session.add(posting)
        await session.flush()
        return posting

    @staticmethod
    async def update(posting: JobPosting, **kwargs: Any) -> JobPosting:
        """Apply ``kwargs`` to an existing JobPosting (idempotent seed)."""
        for key, value in kwargs.items():
            setattr(posting, key, value)
        return posting

    @staticmethod
    async def add_salary_range(
        session: AsyncSession,
        posting: JobPosting,
        *,
        currency: str,
        min_amount: Decimal | None,
        max_amount: Decimal | None,
    ) -> None:
        """Attach a salary band to a posting, dropping a duplicate first."""
        if min_amount is None and max_amount is None:
            raise ValueError("A salary range needs at least one bound")

        existing = await session.execute(
            select(JobSalaryRange).where(
                JobSalaryRange.posting_id == posting.id,
                JobSalaryRange.currency == currency,
                JobSalaryRange.min_amount == min_amount,
                JobSalaryRange.max_amount == max_amount,
            )
        )

        if existing.scalar_one_or_none() is None:
            session.add(
                JobSalaryRange(
                    posting_id=posting.id,
                    currency=currency,
                    min_amount=min_amount,
                    max_amount=max_amount,
                )
            )
            await session.flush()

    @staticmethod
    async def replace_salary_ranges(
        session: AsyncSession,
        posting: JobPosting,
        ranges: list[JobSalaryRange],
    ) -> None:
        """Make ``ranges`` exactly the posting's salary rows (idempotent seed).

        Runs a delete on the posting's rows first so a re-seed converges on the
        intended set rather than accumulating stale bands.
        """
        await session.execute(delete(JobSalaryRange).where(JobSalaryRange.posting_id == posting.id))
        for row in ranges:
            if row.min_amount is None and row.max_amount is None:
                raise ValueError("A salary range needs at least one bound")
            session.add(
                JobSalaryRange(
                    posting_id=posting.id,
                    currency=row.currency,
                    min_amount=row.min_amount,
                    max_amount=row.max_amount,
                )
            )
        await session.flush()

    @staticmethod
    async def attach_specialty(
        session: AsyncSession,
        posting: JobPosting,
        specialty: Specialty,
    ) -> None:
        """Link a posting to a Specialty, if not already linked."""
        existing = await session.execute(
            select(JobPostingSpecialty).where(
                JobPostingSpecialty.posting_id == posting.id,
                JobPostingSpecialty.specialty_id == specialty.id,
            )
        )

        if existing.scalar_one_or_none() is None:
            session.add(JobPostingSpecialty(posting_id=posting.id, specialty_id=specialty.id))
            await session.flush()

    @staticmethod
    async def replace_specialties(
        session: AsyncSession,
        posting: JobPosting,
        specialties: list[Specialty],
    ) -> None:
        """Make ``specialties`` exactly the posting's links (idempotent seed)."""
        await session.execute(
            delete(JobPostingSpecialty).where(JobPostingSpecialty.posting_id == posting.id)
        )
        for specialty in specialties:
            session.add(JobPostingSpecialty(posting_id=posting.id, specialty_id=specialty.id))
        await session.flush()
