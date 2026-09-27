"""Test catalog factory.

Prices and wholesale thresholds are fixed here so pricing tests can assert
exact amounts. Each entry is `(name, retail, wholesale_or_None, min_qty,
category, in_stock)`.
"""

from __future__ import annotations

from decimal import Decimal

from app.repositories.product import Product, Supplier

LOCAL_SUPPLIER = {
    "name": "Nairobi Dental Supplies",
    "slug": "nairobi-dental-supplies",
    "country_code": "KE",
    "scope": "local",
    "is_verified": True,
}

INTERNATIONAL_SUPPLIER = {
    "name": "Global Smile Imports",
    "slug": "global-smile-imports",
    "country_code": "KE",
    "scope": "international",
    "is_verified": False,
}

#: (name, brand, retail, wholesale, min_qty, category, in_stock)
LOCAL_PRODUCTS: list[tuple[str, str | None, str, str | None, int, str, bool]] = [
    # Explicit wholesale: 260.00 once 12+ units.
    ("Adult Medium Toothbrush", "Oral-B", "350", "260", 12, "brushing", True),
    ("Sensitive Toothpaste 100ml", "Sensodyne", "1250", "980", 12, "toothpaste", True),
    # Derived wholesale: NULL price, 24+ units -> 450 * 0.75 = 337.50.
    ("Mint Dental Floss 50m", "Oral-B", "450", None, 24, "floss", True),
    # Wholesale disabled: min_qty 0 means never wholesale.
    ("Kids Bubblegum Toothbrush", "Colgate", "300", None, 0, "children", True),
    # Out of stock, so in_stock=false should surface it.
    ("X-Ray Sensor Holder", None, "34000", None, 0, "specialty", False),
]

INTERNATIONAL_PRODUCTS: list[tuple[str, str | None, str, str | None, int, str, bool]] = [
    ("Electric Sonic Brush", "Philips Sonicare", "12500", "9900", 6, "brushing", True),
]


def build_products() -> list[tuple[Supplier, list[Product]]]:
    """Return seeded `(supplier, products)` pairs for the in-memory catalog."""
    return [
        (
            Supplier(**LOCAL_SUPPLIER),
            [_product(row) for row in LOCAL_PRODUCTS],
        ),
        (
            Supplier(**INTERNATIONAL_SUPPLIER),
            [_product(row) for row in INTERNATIONAL_PRODUCTS],
        ),
    ]


def _product(row: tuple[str, str | None, str, str | None, int, str, bool]) -> Product:
    name, brand, retail, wholesale, min_qty, category, in_stock = row

    return Product(
        name=name,
        brand=brand,
        retail_price=Decimal(retail),
        wholesale_price=Decimal(wholesale) if wholesale is not None else None,
        wholesale_min_qty=min_qty,
        category=category,
        in_stock=in_stock,
        country_code="KE",
        currency="KES",
        dentist_recommended=category in {"specialty", "brushing"},
    )


__all__ = ["INTERNATIONAL_PRODUCTS", "LOCAL_PRODUCTS", "build_products"]
