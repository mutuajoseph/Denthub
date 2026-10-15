"""Supplier storefront logic — the seller's side of the catalogue.

A Supplier (the business, CONTEXT.md) is owned by exactly one supplier
account through ``suppliers.owner_user_id``. The account creates its own
store from the dashboard and then manages the Product records sold through
it. Money stays exact: prices enter as validated ``Decimal`` and are
quantized at the serialization boundary (root AGENTS.md, "Money").
"""

from __future__ import annotations

import re
import uuid
from datetime import datetime
from decimal import Decimal
from typing import Literal, cast

from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.exceptions import (
    ConflictError,
    ForbiddenException,
    InvalidRequestError,
    NotFoundException,
)
from app.logic.v1.auth import SUPPLIER_ROLES, get_user_from_token
from app.logic.v1.products import DEFAULT_PAGE_SIZE, DEFAULT_WHOLESALE_MIN_QTY, MAX_PAGE_SIZE
from app.repositories.product import Product, ProductRepository, Supplier, SupplierRepository
from app.repositories.user import User
from app.utils.money import quantize_money
from app.utils.state import AppState

StoreScope = Literal["local", "international"]

#: Columns a PATCH may never blank out. ``wholesale_price`` is deliberately
#: absent: sending ``null`` there clears the wholesale tier on purpose.
_REQUIRED_ON_UPDATE = ("name", "category", "retail_price")

_SLUG_MAX = 150
_SLUG_ATTEMPTS = 5


class SupplierStore(BaseModel):
    """The signed-in supplier's own storefront."""

    id: str
    name: str
    slug: str
    scope: StoreScope
    country_code: str
    description: str | None
    is_verified: bool
    #: Products the store currently lists, for the dashboard headline.
    product_count: int
    created_at: datetime


class CreateStoreRequest(BaseModel):
    """Body for self-serve store creation. The slug is derived server-side."""

    name: str = Field(min_length=1, max_length=150)
    scope: StoreScope = "local"
    description: str | None = Field(default=None, max_length=2000)


class SupplierProduct(BaseModel):
    """A product as its own seller sees it: raw stored prices, no tier."""

    id: str
    name: str
    brand: str | None
    category: str
    description: str | None
    image_url: str | None
    country_code: str
    currency: str
    retail_price: Decimal
    wholesale_price: Decimal | None
    wholesale_min_qty: int
    in_stock: bool
    dentist_recommended: bool
    created_at: datetime
    updated_at: datetime


class SupplierProductList(BaseModel):
    """One page of a store's own products."""

    items: list[SupplierProduct]
    total: int
    limit: int
    offset: int


class CreateProductRequest(BaseModel):
    """Body for listing a new product in the caller's own store."""

    name: str = Field(min_length=1, max_length=200)
    category: str = Field(min_length=1, max_length=50)
    retail_price: Decimal = Field(gt=0, max_digits=12, decimal_places=2)
    brand: str | None = Field(default=None, max_length=120)
    description: str | None = Field(default=None, max_length=4000)
    image_url: str | None = Field(default=None, max_length=500)
    wholesale_price: Decimal | None = Field(default=None, gt=0, max_digits=12, decimal_places=2)
    wholesale_min_qty: int = Field(default=DEFAULT_WHOLESALE_MIN_QTY, ge=0, le=1_000_000)
    in_stock: bool = True
    dentist_recommended: bool = False


class UpdateProductRequest(BaseModel):
    """PATCH body: only the fields present in the request change.

    ``wholesale_price: null`` clears the explicit wholesale tier (the product
    then falls back to the derived discount, per ``products.py``); a field
    omitted from the body is left untouched.
    """

    name: str | None = Field(default=None, min_length=1, max_length=200)
    category: str | None = Field(default=None, min_length=1, max_length=50)
    retail_price: Decimal | None = Field(default=None, gt=0, max_digits=12, decimal_places=2)
    brand: str | None = Field(default=None, max_length=120)
    description: str | None = Field(default=None, max_length=4000)
    image_url: str | None = Field(default=None, max_length=500)
    wholesale_price: Decimal | None = Field(default=None, gt=0, max_digits=12, decimal_places=2)
    wholesale_min_qty: int | None = Field(default=None, ge=0, le=1_000_000)
    in_stock: bool | None = None
    dentist_recommended: bool | None = None


def _serialize_store(store: Supplier, product_count: int) -> SupplierStore:
    return SupplierStore(
        id=store.id,
        name=store.name,
        slug=store.slug,
        scope=cast(StoreScope, store.scope),
        country_code=store.country_code,
        description=store.description,
        is_verified=store.is_verified,
        product_count=product_count,
        created_at=store.created_at,
    )


def _serialize_product(product: Product) -> SupplierProduct:
    wholesale = (
        quantize_money(Decimal(product.wholesale_price))
        if product.wholesale_price is not None
        else None
    )

    return SupplierProduct(
        id=product.id,
        name=product.name,
        brand=product.brand,
        category=product.category,
        description=product.description,
        image_url=product.image_url,
        country_code=product.country_code,
        currency=product.currency,
        retail_price=quantize_money(Decimal(product.retail_price)),
        wholesale_price=wholesale,
        wholesale_min_qty=product.wholesale_min_qty,
        in_stock=product.in_stock,
        dentist_recommended=product.dentist_recommended,
        created_at=product.created_at,
        updated_at=product.updated_at,
    )


async def _require_supplier(state: AppState, token: str) -> User:
    """Load the caller and reject everyone but an active supplier account."""
    actor = await get_user_from_token(state, token)

    if actor.role not in SUPPLIER_ROLES:
        raise ForbiddenException(message="Only supplier accounts may manage a storefront")

    if not actor.is_active:
        raise ForbiddenException(message="User account is deactivated")

    return actor


async def _owned_store(session: AsyncSession, owner_user_id: str) -> Supplier:
    """The caller's store, or 404 — the dashboard creates it first."""
    store = await SupplierRepository.get_by_owner(session, owner_user_id)

    if store is None:
        raise NotFoundException(message="Store not found")

    return store


def _slugify(value: str) -> str:
    base = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return base or "store"


async def _unique_slug(session: AsyncSession, name: str) -> str:
    """Derive a free slug from the store name, suffixing on collision."""
    base = _slugify(name)[:_SLUG_MAX]

    if await SupplierRepository.get_by_slug(session, base) is None:
        return base

    for _ in range(_SLUG_ATTEMPTS):
        candidate = f"{base[: _SLUG_MAX - 7]}-{uuid.uuid4().hex[:6]}"
        if await SupplierRepository.get_by_slug(session, candidate) is None:
            return candidate

    raise ConflictError(message="Could not derive a unique store slug")


async def get_my_store(state: AppState, *, token: str) -> SupplierStore:
    """Return the caller's storefront.

    404 when the account has not created one yet — the dashboard turns that
    into the create-store form.
    """
    actor = await _require_supplier(state, token)

    async with state.db_session_maker() as session:
        store = await _owned_store(session, actor.id)
        count = await SupplierRepository.count_products(session, store.id)

    return _serialize_store(store, count)


async def create_my_store(
    state: AppState,
    *,
    token: str,
    data: CreateStoreRequest,
    country_code: str,
) -> SupplierStore:
    """Create the caller's storefront, owned by the caller.

    One store per account (409 on a second attempt); the store starts
    unverified and staff verify it later (#82).
    """
    actor = await _require_supplier(state, token)

    country = country_code.strip().upper()
    if len(country) != 2 or not country.isalpha():
        raise InvalidRequestError(message="Country must be a 2-letter ISO code")

    async with state.db_session_maker() as session:
        if await SupplierRepository.get_by_owner(session, actor.id) is not None:
            raise ConflictError(message="This account already has a store")

        slug = await _unique_slug(session, data.name)
        store = await SupplierRepository.create(
            session,
            name=data.name,
            slug=slug,
            country_code=country,
            scope=data.scope,
            description=data.description,
            owner_user_id=actor.id,
            is_verified=False,
        )
        await session.commit()

    return _serialize_store(store, 0)


async def list_my_products(
    state: AppState,
    *,
    token: str,
    limit: int = DEFAULT_PAGE_SIZE,
    offset: int = 0,
) -> SupplierProductList:
    """List the caller's own products, including the out-of-stock ones."""
    actor = await _require_supplier(state, token)
    page_size = max(1, min(limit, MAX_PAGE_SIZE))
    start = max(0, offset)

    async with state.db_session_maker() as session:
        store = await _owned_store(session, actor.id)
        rows = await ProductRepository.list_for_supplier(
            session, store.id, limit=page_size, offset=start
        )
        total = await ProductRepository.count_for_supplier(session, store.id)

    return SupplierProductList(
        items=[_serialize_product(row) for row in rows],
        total=total,
        limit=page_size,
        offset=start,
    )


async def create_product(
    state: AppState,
    *,
    token: str,
    data: CreateProductRequest,
    currency: str,
) -> SupplierProduct:
    """List a new product in the caller's own store.

    The product is published into the store's market: ``country_code`` comes
    from the store, ``currency`` from the region headers the client sends.
    """
    actor = await _require_supplier(state, token)

    async with state.db_session_maker() as session:
        store = await _owned_store(session, actor.id)
        product = await ProductRepository.create(
            session,
            supplier_id=store.id,
            name=data.name,
            brand=data.brand,
            category=data.category,
            description=data.description,
            image_url=data.image_url,
            country_code=store.country_code,
            currency=currency.upper(),
            retail_price=quantize_money(data.retail_price),
            wholesale_price=(
                quantize_money(data.wholesale_price) if data.wholesale_price is not None else None
            ),
            wholesale_min_qty=data.wholesale_min_qty,
            in_stock=data.in_stock,
            dentist_recommended=data.dentist_recommended,
        )
        await session.commit()
        await session.refresh(product)

    return _serialize_product(product)


async def update_product(
    state: AppState,
    *,
    token: str,
    product_id: str,
    data: UpdateProductRequest,
) -> SupplierProduct:
    """Apply a partial update to one of the caller's own products.

    A product belonging to another store reads as 404, exactly as an unknown
    id does, so ownership is never observable from the response.
    """
    actor = await _require_supplier(state, token)

    updates = data.model_dump(exclude_unset=True)
    for key in _REQUIRED_ON_UPDATE:
        if updates.get(key) is None:
            updates.pop(key, None)

    if "retail_price" in updates:
        updates["retail_price"] = quantize_money(cast(Decimal, updates["retail_price"]))
    if updates.get("wholesale_price") is not None:
        updates["wholesale_price"] = quantize_money(cast(Decimal, updates["wholesale_price"]))

    async with state.db_session_maker() as session:
        store = await _owned_store(session, actor.id)
        product = await ProductRepository.get_for_supplier(session, product_id, store.id)

        if product is None:
            raise NotFoundException(message="Product not found")

        for key, value in updates.items():
            setattr(product, key, value)

        await session.commit()
        await session.refresh(product)

    return _serialize_product(product)
