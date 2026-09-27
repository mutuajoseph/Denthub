"""Unit tests for the server-side pricing rules.

These are the rules the client used to own: tier selection, unit price, and
line total. They must not drift, so they are asserted directly.
"""

from __future__ import annotations

from decimal import Decimal

import pytest

from app.logic.v1.products import (
    DEFAULT_WHOLESALE_DISCOUNT,
    effective_unit_price,
    purchase_mode_for,
    quantize_money,
    wholesale_price_for,
)
from app.repositories.product import Product


def make_product(
    retail: str,
    wholesale: str | None = None,
    min_qty: int = 12,
) -> Product:
    """Build an in-memory product for pricing assertions."""
    return Product(
        name="Test Product",
        brand=None,
        retail_price=Decimal(retail),
        wholesale_price=Decimal(wholesale) if wholesale is not None else None,
        wholesale_min_qty=min_qty,
        category="brushing",
        in_stock=True,
        country_code="KE",
        currency="KES",
    )


def test_retail_below_threshold() -> None:
    product = make_product("350.00", "260.00", min_qty=12)

    assert effective_unit_price(product, 1) == Decimal("350.00")
    assert effective_unit_price(product, 11) == Decimal("350.00")
    assert purchase_mode_for(product, 11) == "retail"


def test_wholesale_at_and_above_threshold() -> None:
    product = make_product("350.00", "260.00", min_qty=12)

    assert effective_unit_price(product, 12) == Decimal("260.00")
    assert effective_unit_price(product, 50) == Decimal("260.00")
    assert purchase_mode_for(product, 12) == "wholesale"


def test_threshold_boundary_is_inclusive() -> None:
    """One unit under the threshold stays retail; exactly at it flips."""
    product = make_product("450.00", None, min_qty=24)

    assert purchase_mode_for(product, 23) == "retail"
    assert purchase_mode_for(product, 24) == "wholesale"


def test_derived_wholesale_when_price_is_null() -> None:
    """A NULL wholesale_price derives from retail at the default discount."""
    product = make_product("450.00", None, min_qty=24)

    expected = Decimal("450.00") * (Decimal(1) - DEFAULT_WHOLESALE_DISCOUNT)
    assert wholesale_price_for(product) == quantize_money(expected)
    assert wholesale_price_for(product) == Decimal("337.50")


def test_no_wholesale_when_threshold_is_zero() -> None:
    """min_qty 0 means the product is retail-only, not 'wholesale at 0'."""
    product = make_product("300.00", None, min_qty=0)

    assert wholesale_price_for(product) is None
    assert purchase_mode_for(product, 999) == "retail"
    assert effective_unit_price(product, 999) == Decimal("300.00")


def test_explicit_wholesale_wins_over_derived() -> None:
    """A stored wholesale_price is used verbatim, not discounted."""
    product = make_product("350.00", "260.00", min_qty=12)

    assert wholesale_price_for(product) == Decimal("260.00")


def test_quantity_below_one_is_rejected() -> None:
    product = make_product("350.00", "260.00", min_qty=12)

    with pytest.raises(ValueError, match="at least 1"):
        effective_unit_price(product, 0)


def test_money_rounds_half_up() -> None:
    assert quantize_money(Decimal("337.505")) == Decimal("337.51")
    assert quantize_money(Decimal("337.504")) == Decimal("337.50")
    assert quantize_money(Decimal("10")) == Decimal("10.00")


def test_prices_never_emit_float_noise() -> None:
    """Decimals must stay 2dp, so JSON serializes as `260.00` not `260.0...`."""
    product = make_product("1250.00", "980.00", min_qty=12)

    assert str(effective_unit_price(product, 12)) == "980.00"
