"""Product database model and Repository layer.

Holds low-level persistence for the oral-care catalog. Pricing *rules* live in
``app.logic.v1.products``; this layer only stores the raw price columns.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    func,
    or_,
    select,
)
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Mapped, mapped_column, relationship, selectinload
from sqlalchemy.sql.expression import ColumnElement

from app.repositories.database import Base


class Supplier(Base):
    """Supplier DB model.

    Introduced alongside ``Product`` because a product is always sold by exactly
    one supplier, and the storefront pages need the supplier's display fields.
    """

    __tablename__ = "suppliers"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    slug: Mapped[str] = mapped_column(String(150), unique=True, index=True, nullable=False)
    country_code: Mapped[str] = mapped_column(String(2), default="KE", nullable=False)
    scope: Mapped[str] = mapped_column(String(20), default="local", nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), nullable=False
    )

    products: Mapped[list[Product]] = relationship(back_populates="supplier")


class Product(Base):
    """Product DB model.

    Money is stored as ``Numeric`` (never float) so retail and wholesale prices
    stay exact. Both price columns are denominated in ``currency``.
    """

    __tablename__ = "products"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )
    supplier_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("suppliers.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False, index=True)
    brand: Mapped[str | None] = mapped_column(String(120), nullable=True)
    category: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    image_url: Mapped[str | None] = mapped_column(String(500), nullable=True)

    currency: Mapped[str] = mapped_column(String(3), default="KES", nullable=False)
    retail_price: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    wholesale_price: Mapped[Decimal | None] = mapped_column(Numeric(12, 2), nullable=True)
    wholesale_min_qty: Mapped[int] = mapped_column(Integer, default=12, nullable=False)

    dentist_recommended: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    in_stock: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    country_code: Mapped[str] = mapped_column(String(2), default="KE", nullable=False, index=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    supplier: Mapped[Supplier] = relationship(back_populates="products")


class ProductFilters:
    """Normalized filter set shared by :meth:`ProductRepository.search` and
    :meth:`ProductRepository.count` so paging can never disagree with totals."""

    def __init__(
        self,
        *,
        country_code: str,
        query: str | None = None,
        category: str | None = None,
        supplier_id: str | None = None,
        dentist_recommended: bool | None = None,
        in_stock: bool = True,
    ) -> None:
        self.country_code = country_code
        self.query = query
        self.category = category
        self.supplier_id = supplier_id
        self.dentist_recommended = dentist_recommended
        self.in_stock = in_stock

    def conditions(self) -> list[ColumnElement[bool]]:
        clauses: list[ColumnElement[bool]] = [Product.country_code == self.country_code]

        if self.query:
            pattern = f"%{self.query.strip().lower()}%"
            clauses.append(
                or_(
                    func.lower(Product.name).like(pattern),
                    func.lower(func.coalesce(Product.brand, "")).like(pattern),
                )
            )

        if self.category:
            clauses.append(Product.category == self.category)

        if self.supplier_id:
            clauses.append(Product.supplier_id == self.supplier_id)

        if self.dentist_recommended is not None:
            clauses.append(Product.dentist_recommended == self.dentist_recommended)

        if self.in_stock:
            clauses.append(Product.in_stock.is_(True))

        return clauses


class ProductRepository:
    """Repository for product persistence operations."""

    @staticmethod
    async def get_by_id(session: AsyncSession, product_id: str) -> Product | None:
        """Retrieve a single product with its supplier eagerly loaded."""
        stmt = (
            select(Product).options(selectinload(Product.supplier)).where(Product.id == product_id)
        )
        result = await session.execute(stmt)
        return result.scalar_one_or_none()

    @staticmethod
    async def search(
        session: AsyncSession,
        filters: ProductFilters,
        *,
        limit: int = 48,
        offset: int = 0,
    ) -> list[Product]:
        """Return one page of products matching ``filters``, ordered by name."""
        stmt = (
            select(Product)
            .options(selectinload(Product.supplier))
            .where(*filters.conditions())
            .order_by(Product.name.asc())
            .limit(limit)
            .offset(offset)
        )
        result = await session.execute(stmt)
        return list(result.scalars().all())

    @staticmethod
    async def count(session: AsyncSession, filters: ProductFilters) -> int:
        """Count products matching the same filters :meth:`search` applies."""
        stmt = select(func.count()).select_from(Product).where(*filters.conditions())
        result = await session.execute(stmt)
        return int(result.scalar_one())

    @staticmethod
    async def list_categories(session: AsyncSession, *, country_code: str) -> list[str]:
        """Return the distinct categories stocked in a country, alphabetically."""
        stmt = (
            select(Product.category)
            .where(Product.country_code == country_code)
            .distinct()
            .order_by(Product.category.asc())
        )
        result = await session.execute(stmt)
        return list(result.scalars().all())

    @staticmethod
    async def create(session: AsyncSession, **kwargs: Any) -> Product:
        """Create and persist a new product."""
        product = Product(**kwargs)
        session.add(product)
        await session.flush()
        return product
