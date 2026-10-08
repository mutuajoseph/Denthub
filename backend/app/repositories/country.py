"""Country reference data: models and repository queries.

A Country is a market DentHub operates in, carrying its own currency,
Subdivision label, locale, phone prefix, and feature flags. Everything else in
the catalog is scoped by ``country_code``, so these rows are the vocabulary the
rest of the schema is written against.

Feature flags and insurance providers are child rows rather than columns or
JSON blobs: both are queried (a listing search filters on accepted insurance),
and a flag carries a per-country primary scheme that the UI renders.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
    select,
)
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Mapped, mapped_column, relationship, selectinload

from app.repositories.database import Base


class Country(Base):
    """A market DentHub operates in.

    ``code`` is the ISO-3166 alpha-2 code and doubles as the primary key: it is
    what ``Accept-Country`` carries and what every catalog table's
    ``country_code`` column points at.
    """

    __tablename__ = "countries"

    code: Mapped[str] = mapped_column(String(2), primary_key=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    brand_suffix: Mapped[str | None] = mapped_column(String(50), nullable=True)

    currency: Mapped[str] = mapped_column(String(3), nullable=False)
    currency_symbol: Mapped[str] = mapped_column(String(8), nullable=False)

    #: The locale this market formats money and dates in (``en-KE``, ``tr-TR``).
    #: It is the market's locale, not the site's: a Turkish market formatting in
    #: ``tr-TR`` is what makes a price read the way a local expects.
    locale: Mapped[str] = mapped_column(String(16), nullable=False)

    #: The locale the site falls back to when a visitor has expressed no language
    #: preference. Distinct from :attr:`locale` because they differ exactly where
    #: it matters: Turkey's market locale is ``tr-TR`` while its fallback is
    #: ``en``, and collapsing the two would either mistranslate prices or leave a
    #: new visitor with no language to read.
    default_locale: Mapped[str] = mapped_column(String(16), nullable=False)

    domain: Mapped[str] = mapped_column(String(120), nullable=False)
    phone_prefix: Mapped[str] = mapped_column(String(8), nullable=False)

    #: "County" in Kenya, "State" in the US, "Province" in South Africa. The
    #: plural is stored rather than derived so languages that inflect
    #: irregularly ("Emirate"/"Emirates") are not guessed at.
    subdivision_label: Mapped[str] = mapped_column(String(30), nullable=False)
    subdivision_label_plural: Mapped[str] = mapped_column(String(40), nullable=False)
    city_label: Mapped[str] = mapped_column(String(30), default="City", nullable=False)

    #: IANA zone used to compute "open now" for a Branch. Stored per country
    #: because a listing's hours are meaningless without the local clock.
    timezone: Mapped[str] = mapped_column(String(64), nullable=False)

    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), nullable=False
    )

    subdivisions: Mapped[list[Subdivision]] = relationship(
        back_populates="country", cascade="all, delete-orphan"
    )
    features: Mapped[list[CountryFeature]] = relationship(
        back_populates="country", cascade="all, delete-orphan"
    )
    insurance_providers: Mapped[list[InsuranceProvider]] = relationship(
        back_populates="country", cascade="all, delete-orphan"
    )


class Subdivision(Base):
    """The administrative area below a Country (county, state, province).

    Keyed by ``(country_code, code)`` because subdivision codes are only unique
    inside a country, and the client filters on a pair, never a bare code.
    """

    __tablename__ = "subdivisions"
    __table_args__ = (UniqueConstraint("country_code", "code", name="uq_subdivision_country_code"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    country_code: Mapped[str] = mapped_column(
        String(2), ForeignKey("countries.code", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    code: Mapped[str] = mapped_column(String(30), nullable=False)

    country: Mapped[Country] = relationship(back_populates="subdivisions")


class CountryFeature(Base):
    """A per-Country feature flag, with the market's primary scheme.

    A configured market carries a row for every feature key, so "this market
    does not offer that module" is recorded as ``is_enabled=False`` rather than
    as an absent row. The two are different facts: a disabled flag says the
    market was considered and switched off, while a missing row says nobody has
    configured it yet. Clients read both as off, so a partially configured
    market degrades to the feature being unavailable rather than erroring.
    """

    __tablename__ = "country_features"
    __table_args__ = (UniqueConstraint("country_code", "feature", name="uq_country_feature_key"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    country_code: Mapped[str] = mapped_column(
        String(2), ForeignKey("countries.code", ondelete="CASCADE"), nullable=False, index=True
    )
    feature: Mapped[str] = mapped_column(String(50), nullable=False)
    is_enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    #: e.g. ``primary_scheme="NHIF"`` for Kenya's insurance feature. Null when
    #: the feature has no country-specific scheme.
    primary_scheme: Mapped[str | None] = mapped_column(String(100), nullable=True)

    country: Mapped[Country] = relationship(back_populates="features")


class InsuranceProvider(Base):
    """A commercial or national insurance plan a listing may accept."""

    __tablename__ = "insurance_providers"
    __table_args__ = (UniqueConstraint("country_code", "name", name="uq_insurance_provider_name"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    country_code: Mapped[str] = mapped_column(
        String(2), ForeignKey("countries.code", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    #: True for a nationwide scheme (NHIF, NHS), false for a commercial panel.
    is_national: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    country: Mapped[Country] = relationship(back_populates="insurance_providers")


class Specialty(Base):
    """A dental specialty, shared by listings, Courses, and search filters.

    Canonical across the platform: the fixtures spelled one specialty
    ``Pediatric`` and another ``Paediatric``, which broke exact-match filtering.
    ``name`` is the display label; ``code`` is the stable slug used in query
    strings and the client cache key.
    """

    __tablename__ = "specialties"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    code: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    #: Presentation order in filter menus; lower sorts first.
    display_order: Mapped[int] = mapped_column(Integer, default=100, nullable=False)


class CountryRepository:
    """Reads for the country reference data."""

    @staticmethod
    async def get(
        session: AsyncSession,
        code: str,
    ) -> Country | None:
        """Fetch one Country with features and insurance eagerly loaded.

        Subdivisions are deliberately *not* eager-loaded: they are a separate
        endpoint with their own cache lifetime, and loading them here would
        make every country read scale with subdivision count.
        """
        stmt = (
            select(Country)
            .options(
                selectinload(Country.features),
                selectinload(Country.insurance_providers),
            )
            .where(Country.code == code.upper())
        )
        result = await session.execute(stmt)
        return result.scalar_one_or_none()

    @staticmethod
    async def list_active(session: AsyncSession) -> list[Country]:
        """Every active Country, alphabetical, with children eager-loaded."""
        stmt = (
            select(Country)
            .options(
                selectinload(Country.features),
                selectinload(Country.insurance_providers),
            )
            .where(Country.is_active.is_(True))
            .order_by(Country.name.asc())
        )
        result = await session.execute(stmt)
        return list(result.scalars().all())

    @staticmethod
    async def create_country(session: AsyncSession, **kwargs: Any) -> Country:
        """Create and persist a Country."""
        country = Country(**kwargs)
        session.add(country)
        await session.flush()
        return country


class SubdivisionRepository:
    @staticmethod
    async def list_all(session: AsyncSession, *, country_code: str) -> list[Subdivision]:
        """Every Subdivision in a Country, alphabetical by name."""
        stmt = (
            select(Subdivision)
            .where(Subdivision.country_code == country_code.upper())
            .order_by(Subdivision.name.asc())
        )
        result = await session.execute(stmt)
        return list(result.scalars().all())

    @staticmethod
    async def create(session: AsyncSession, **kwargs: Any) -> Subdivision:
        """Create and persist a Subdivision."""
        subdivision = Subdivision(**kwargs)
        session.add(subdivision)
        await session.flush()
        return subdivision


class SpecialtyRepository:
    @staticmethod
    async def list_all(session: AsyncSession) -> list[Specialty]:
        """Every Specialty in display order, then alphabetically."""
        stmt = select(Specialty).order_by(Specialty.display_order.asc(), Specialty.name.asc())
        result = await session.execute(stmt)
        return list(result.scalars().all())

    @staticmethod
    async def create(session: AsyncSession, **kwargs: Any) -> Specialty:
        """Create and persist a Specialty."""
        specialty = Specialty(**kwargs)
        session.add(specialty)
        await session.flush()
        return specialty
