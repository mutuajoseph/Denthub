"""Product catalog logic: pricing rules, search, and serialization.

The effective price of a product is resolved **here, on the server**, for a
requested quantity. Clients never derive discounts themselves - they ask for a
quantity and receive the price to charge.
"""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel

from app.exceptions import NotFoundException
from app.repositories.product import Product, ProductFilters, ProductRepository
from app.utils.money import quantize_money
from app.utils.state import AppState

PurchaseMode = Literal["retail", "wholesale"]

#: Applied when a product has no explicit ``wholesale_price`` but is still
#: wholesale-eligible. Mirrors the discount the previous client used to compute.
DEFAULT_WHOLESALE_DISCOUNT = Decimal("0.25")
DEFAULT_WHOLESALE_MIN_QTY = 12

MAX_PAGE_SIZE = 100
DEFAULT_PAGE_SIZE = 48


def wholesale_price_for(product: Product) -> Decimal | None:
    """Return the wholesale unit price for a product, or ``None`` if it has none.

    A product is wholesale-eligible when it has an explicit ``wholesale_price``.
    When it has none it falls back to a percentage off retail, so a catalog can
    opt into wholesale purely by setting a minimum quantity.
    """
    if product.wholesale_price is not None:
        return quantize_money(Decimal(product.wholesale_price))

    if product.wholesale_min_qty and product.wholesale_min_qty > 0:
        retail = Decimal(product.retail_price)
        return quantize_money(retail * (Decimal(1) - DEFAULT_WHOLESALE_DISCOUNT))

    return None


def effective_unit_price(product: Product, quantity: int) -> Decimal:
    """Price one unit of ``product`` at ``quantity``, honouring the wholesale tier.

    Wholesale applies when the product is wholesale-eligible *and* the quantity
    reaches its threshold. Retail is used otherwise.
    """
    if quantity < 1:
        raise ValueError("quantity must be at least 1")

    retail = Decimal(product.retail_price)
    wholesale = wholesale_price_for(product)

    if wholesale is None:
        return quantize_money(retail)

    threshold = product.wholesale_min_qty or DEFAULT_WHOLESALE_MIN_QTY

    if quantity >= threshold:
        return wholesale

    return quantize_money(retail)


def purchase_mode_for(product: Product, quantity: int) -> PurchaseMode:
    """Report which pricing tier ``quantity`` qualifies for."""
    wholesale = wholesale_price_for(product)

    if wholesale is None:
        return "retail"

    threshold = product.wholesale_min_qty or DEFAULT_WHOLESALE_MIN_QTY

    return "wholesale" if quantity >= threshold else "retail"


class SupplierSummary(BaseModel):
    """Denormalized supplier fields carried on a product response."""

    id: str
    name: str
    slug: str
    scope: str
    is_verified: bool


class ProductPricing(BaseModel):
    """Server-resolved pricing for a specific quantity.

    ``wholesale_price`` is the *effective* wholesale unit price, not the raw
    column: when a product stores no explicit price it is derived from retail
    and the derived figure is what gets reported, so a client can render
    "24+ for 337.50 each" without re-deriving anything. ``None`` means the
    product is retail-only.
    """

    currency: str
    quantity: int
    purchase_mode: PurchaseMode
    unit_price: Decimal
    line_total: Decimal
    retail_price: Decimal
    wholesale_price: Decimal | None
    wholesale_min_qty: int


class ProductResponse(BaseModel):
    """A catalog product, with pricing resolved for the requested quantity."""

    id: str
    name: str
    brand: str | None
    category: str
    description: str | None
    image_url: str | None
    country_code: str
    dentist_recommended: bool
    in_stock: bool
    supplier: SupplierSummary
    pricing: ProductPricing
    created_at: datetime


class ProductPage(BaseModel):
    """One page of search results plus the filters that produced it."""

    items: list[ProductResponse]
    total: int
    limit: int
    offset: int
    country_code: str
    currency: str


class CategoryList(BaseModel):
    """Categories stocked in a country."""

    country_code: str
    categories: list[str]


def _serialize(product: Product, quantity: int) -> ProductResponse:
    unit_price = effective_unit_price(product, quantity)
    retail = quantize_money(Decimal(product.retail_price))
    wholesale = wholesale_price_for(product)

    return ProductResponse(
        id=product.id,
        name=product.name,
        brand=product.brand,
        category=product.category,
        description=product.description,
        image_url=product.image_url,
        country_code=product.country_code,
        dentist_recommended=product.dentist_recommended,
        in_stock=product.in_stock,
        supplier=SupplierSummary(
            id=product.supplier.id,
            name=product.supplier.name,
            slug=product.supplier.slug,
            scope=product.supplier.scope,
            is_verified=product.supplier.is_verified,
        ),
        pricing=ProductPricing(
            currency=product.currency,
            quantity=quantity,
            purchase_mode=purchase_mode_for(product, quantity),
            unit_price=unit_price,
            line_total=quantize_money(unit_price * quantity),
            retail_price=retail,
            wholesale_price=wholesale,
            wholesale_min_qty=product.wholesale_min_qty or DEFAULT_WHOLESALE_MIN_QTY,
        ),
        created_at=product.created_at,
    )


def _validate_quantity(quantity: int) -> int:
    if quantity < 1:
        raise ValueError("quantity must be at least 1")
    return min(quantity, MAX_PAGE_SIZE)


def _validate_limit(limit: int) -> int:
    return max(1, min(limit, MAX_PAGE_SIZE))


async def list_products(
    state: AppState,
    *,
    country_code: str,
    quantity: int = 1,
    query: str | None = None,
    category: str | None = None,
    supplier_id: str | None = None,
    dentist_recommended: bool | None = None,
    in_stock: bool = True,
    limit: int = DEFAULT_PAGE_SIZE,
    offset: int = 0,
    currency: str = "KES",
) -> ProductPage:
    """Search the catalog and price every result for ``quantity``."""
    qty = _validate_quantity(quantity)
    page_size = _validate_limit(limit)
    start = max(0, offset)

    filters = ProductFilters(
        country_code=country_code.upper(),
        query=query,
        category=category,
        supplier_id=supplier_id,
        dentist_recommended=dentist_recommended,
        in_stock=in_stock,
    )

    async with state.db_session_maker() as session:
        rows = await ProductRepository.search(session, filters, limit=page_size, offset=start)
        total = await ProductRepository.count(session, filters)

    # Each product carries its own currency; the page reports the one the
    # catalog is priced in, falling back to the negotiated header when empty.
    page_currency = rows[0].currency if rows else currency.upper()

    return ProductPage(
        items=[_serialize(row, qty) for row in rows],
        total=total,
        limit=page_size,
        offset=start,
        country_code=filters.country_code,
        currency=page_currency,
    )


async def get_product(
    state: AppState,
    product_id: str,
    *,
    quantity: int = 1,
) -> ProductResponse:
    """Fetch one product, priced for ``quantity``."""
    qty = _validate_quantity(quantity)

    async with state.db_session_maker() as session:
        product = await ProductRepository.get_by_id(session, product_id)

        if product is None:
            raise NotFoundException(message="Product not found")

        return _serialize(product, qty)


async def list_categories(state: AppState, *, country_code: str) -> CategoryList:
    """List the categories stocked in a country."""
    async with state.db_session_maker() as session:
        categories = await ProductRepository.list_categories(
            session, country_code=country_code.upper()
        )

    return CategoryList(country_code=country_code.upper(), categories=categories)
