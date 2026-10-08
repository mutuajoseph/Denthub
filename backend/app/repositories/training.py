"""CPD training catalogue: providers, courses, and webinars.

Three tables rather than one with a discriminator, because a course and a
webinar share little beyond a provider and a description: a course runs on a
schedule (subdivision, delivery mode, a nullable price with a ``currency`` on
the same row) while a webinar is a dated event (a join URL and a real
``scheduled_start``). A provider is the organising body and lives in the market
it serves. Persistence and reads only; enrolment is explicitly out of scope.
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
    func,
    select,
)
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Mapped, mapped_column, relationship, selectinload
from sqlalchemy.sql.expression import ColumnElement

from app.repositories.database import Base


class TrainingProvider(Base):
    """The organising body behind courses and webinars, per market.

    ``is_verified`` distinguishes a known, vetted body from one a patient or
    dentist should treat with more care.
    """

    __tablename__ = "training_providers"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )
    name: Mapped[str] = mapped_column(String(120), nullable=False, index=True)
    country_code: Mapped[str] = mapped_column(String(2), nullable=False, index=True)
    is_verified: Mapped[bool] = mapped_column(nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), nullable=False
    )

    courses: Mapped[list[TrainingCourse]] = relationship(back_populates="provider")
    webinars: Mapped[list[TrainingWebinar]] = relationship(back_populates="provider")


class TrainingCourse(Base):
    """One accredited course offered by a provider in a market.

    ``price`` may be ``None`` - free CPD exists - and when it is set the row
    carries its own ``currency`` (``NUMERIC(12,2)``), per the root ``AGENTS.md``
    money rule. ``delivery_mode`` is ``in_person``, ``online``, or ``blended``.
    """

    __tablename__ = "training_courses"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False, index=True)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    provider_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("training_providers.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    country_code: Mapped[str] = mapped_column(String(2), nullable=False, index=True)
    subdivision_code: Mapped[str] = mapped_column(String(30), nullable=False, index=True)
    delivery_mode: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    price: Mapped[Decimal | None] = mapped_column(Numeric(12, 2), nullable=True)
    currency: Mapped[str | None] = mapped_column(String(3), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    provider: Mapped[TrainingProvider] = relationship(back_populates="courses")


class TrainingWebinar(Base):
    """A dated training event with a join URL, listed by its scheduled start."""

    __tablename__ = "training_webinars"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False, index=True)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    provider_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("training_providers.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    country_code: Mapped[str] = mapped_column(String(2), nullable=False, index=True)
    join_url: Mapped[str] = mapped_column(String(500), nullable=False)
    scheduled_start: Mapped[datetime] = mapped_column(DateTime, nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), nullable=False
    )

    provider: Mapped[TrainingProvider] = relationship(back_populates="webinars")


class TrainingCourseFilters:
    """Filter set shared by :meth:`TrainingRepository.search_courses` and ``count_courses``."""

    def __init__(
        self,
        *,
        country_code: str,
        subdivision_code: str | None = None,
        provider_name: str | None = None,
        delivery_mode: str | None = None,
    ) -> None:
        self.country_code = country_code
        self.subdivision_code = subdivision_code
        self.provider_name = provider_name
        self.delivery_mode = delivery_mode

    def conditions(self) -> list[ColumnElement[bool]]:
        clauses: list[ColumnElement[bool]] = [TrainingCourse.country_code == self.country_code]

        if self.subdivision_code:
            clauses.append(TrainingCourse.subdivision_code == self.subdivision_code)

        if self.delivery_mode:
            clauses.append(TrainingCourse.delivery_mode == self.delivery_mode)

        return clauses

    def provider_clause(self) -> ColumnElement[bool] | None:
        if not self.provider_name:
            return None
        return func.lower(TrainingProvider.name) == self.provider_name.lower()


class TrainingWebinarFilters:
    """Filter set shared by webinars ``search``/``count``.

    ``upcoming`` is tri-state: ``None`` keeps the whole timeline (a provider's
    archive is worth having), ``True`` serves only future webinars, ``False``
    only past ones.
    """

    def __init__(
        self,
        *,
        country_code: str,
        provider_name: str | None = None,
        upcoming: bool | None = None,
        now: datetime,
    ) -> None:
        self.country_code = country_code
        self.provider_name = provider_name
        self.upcoming = upcoming
        self.now = now

    def conditions(self) -> list[ColumnElement[bool]]:
        clauses: list[ColumnElement[bool]] = [TrainingWebinar.country_code == self.country_code]

        if self.upcoming is True:
            clauses.append(TrainingWebinar.scheduled_start >= self.now)
        elif self.upcoming is False:
            clauses.append(TrainingWebinar.scheduled_start < self.now)

        return clauses

    def provider_clause(self) -> ColumnElement[bool] | None:
        if not self.provider_name:
            return None
        return func.lower(TrainingProvider.name) == self.provider_name.lower()


class TrainingRepository:
    """Reads and writes for the CPD training catalogue."""

    # --- Courses ----------------------------------------------------------

    @staticmethod
    async def search_courses(
        session: AsyncSession,
        filters: TrainingCourseFilters,
        *,
        limit: int,
        offset: int,
    ) -> list[TrainingCourse]:
        """One page of a market's courses, newest first."""
        stmt = (
            select(TrainingCourse)
            .options(selectinload(TrainingCourse.provider))
            .where(*filters.conditions())
            .order_by(TrainingCourse.created_at.desc(), TrainingCourse.title.asc())
            .limit(limit)
            .offset(offset)
        )

        provider_clause = filters.provider_clause()
        if provider_clause is not None:
            stmt = stmt.join(TrainingCourse.provider).where(provider_clause)

        result = await session.execute(stmt)
        return list(result.scalars().unique().all())

    @staticmethod
    async def count_courses(session: AsyncSession, filters: TrainingCourseFilters) -> int:
        """Count courses matching the same filters :meth:`search_courses` applies."""
        stmt = select(func.count()).select_from(TrainingCourse).where(*filters.conditions())

        provider_clause = filters.provider_clause()
        if provider_clause is not None:
            stmt = stmt.join(TrainingCourse.provider).where(provider_clause)

        result = await session.execute(stmt)
        return int(result.scalar_one())

    @staticmethod
    async def get_course(session: AsyncSession, course_id: str) -> TrainingCourse | None:
        """One course with its provider loaded."""
        stmt = (
            select(TrainingCourse)
            .options(selectinload(TrainingCourse.provider))
            .where(TrainingCourse.id == course_id)
        )
        result = await session.execute(stmt)
        return result.scalar_one_or_none()

    @staticmethod
    async def find_course(
        session: AsyncSession,
        *,
        title: str,
        provider_id: str,
    ) -> TrainingCourse | None:
        """Look a course up by its natural key, for an idempotent seed."""
        stmt = select(TrainingCourse).where(
            TrainingCourse.title == title,
            TrainingCourse.provider_id == provider_id,
        )
        result = await session.execute(stmt)
        return result.scalar_one_or_none()

    @staticmethod
    async def create_course(session: AsyncSession, **kwargs: Any) -> TrainingCourse:
        """Create and persist a course."""
        price = kwargs.get("price")
        currency = kwargs.get("currency")
        if price is not None and currency is None:
            raise ValueError("A priced course needs a currency on the same row")

        course = TrainingCourse(**kwargs)
        session.add(course)
        await session.flush()
        return course

    @staticmethod
    async def update_course(course: TrainingCourse, **kwargs: Any) -> TrainingCourse:
        """Apply ``kwargs`` to an existing course (idempotent seed)."""
        for key, value in kwargs.items():
            setattr(course, key, value)
        return course

    # --- Webinars ----------------------------------------------------------

    @staticmethod
    async def search_webinars(
        session: AsyncSession,
        filters: TrainingWebinarFilters,
        *,
        limit: int,
        offset: int,
    ) -> list[TrainingWebinar]:
        """One page of a market's webinars, upcoming first then past, by start.

        Upcoming webinars come out ascending by start (the next thing on first),
        past webinars after them also ascending, so a provider's archive reads
        in historical order rather than vanishing from the API.
        """
        stmt = (
            select(TrainingWebinar)
            .options(selectinload(TrainingWebinar.provider))
            .where(*filters.conditions())
            .order_by(
                (TrainingWebinar.scheduled_start < filters.now).asc(),
                TrainingWebinar.scheduled_start.asc(),
            )
            .limit(limit)
            .offset(offset)
        )

        provider_clause = filters.provider_clause()
        if provider_clause is not None:
            stmt = stmt.join(TrainingWebinar.provider).where(provider_clause)

        result = await session.execute(stmt)
        return list(result.scalars().unique().all())

    @staticmethod
    async def count_webinars(session: AsyncSession, filters: TrainingWebinarFilters) -> int:
        """Count webinars matching the same filters :meth:`search_webinars` applies."""
        stmt = select(func.count()).select_from(TrainingWebinar).where(*filters.conditions())

        provider_clause = filters.provider_clause()
        if provider_clause is not None:
            stmt = stmt.join(TrainingWebinar.provider).where(provider_clause)

        result = await session.execute(stmt)
        return int(result.scalar_one())

    @staticmethod
    async def get_webinar(session: AsyncSession, webinar_id: str) -> TrainingWebinar | None:
        """One webinar with its provider loaded."""
        stmt = (
            select(TrainingWebinar)
            .options(selectinload(TrainingWebinar.provider))
            .where(TrainingWebinar.id == webinar_id)
        )
        result = await session.execute(stmt)
        return result.scalar_one_or_none()

    @staticmethod
    async def find_webinar(
        session: AsyncSession,
        *,
        title: str,
        provider_id: str,
    ) -> TrainingWebinar | None:
        """Look a webinar up by its natural key, for an idempotent seed."""
        stmt = select(TrainingWebinar).where(
            TrainingWebinar.title == title,
            TrainingWebinar.provider_id == provider_id,
        )
        result = await session.execute(stmt)
        return result.scalar_one_or_none()

    @staticmethod
    async def create_webinar(session: AsyncSession, **kwargs: Any) -> TrainingWebinar:
        """Create and persist a webinar."""
        webinar = TrainingWebinar(**kwargs)
        session.add(webinar)
        await session.flush()
        return webinar

    @staticmethod
    async def update_webinar(webinar: TrainingWebinar, **kwargs: Any) -> TrainingWebinar:
        """Apply ``kwargs`` to an existing webinar (idempotent seed)."""
        for key, value in kwargs.items():
            setattr(webinar, key, value)
        return webinar

    # --- Providers ----------------------------------------------------------

    @staticmethod
    async def find_provider(
        session: AsyncSession,
        *,
        name: str,
        country_code: str,
    ) -> TrainingProvider | None:
        """Look a provider up by name within its market (idempotent seed key)."""
        stmt = select(TrainingProvider).where(
            TrainingProvider.name == name,
            TrainingProvider.country_code == country_code,
        )
        result = await session.execute(stmt)
        return result.scalar_one_or_none()

    @staticmethod
    async def create_provider(
        session: AsyncSession,
        *,
        name: str,
        country_code: str,
        is_verified: bool,
    ) -> TrainingProvider:
        """Create and persist a provider."""
        provider = TrainingProvider(
            name=name,
            country_code=country_code,
            is_verified=is_verified,
        )
        session.add(provider)
        await session.flush()
        return provider
