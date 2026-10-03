"""Test data factories.

Prices and wholesale thresholds are fixed here so pricing tests can assert
exact amounts. Each product entry is `(name, retail, wholesale_or_None,
min_qty, category, in_stock)`.
"""

from __future__ import annotations

from decimal import Decimal

from app.repositories.country import (
    Country,
    CountryFeature,
    InsuranceProvider,
    Specialty,
    Subdivision,
)
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


# --- Country reference data -------------------------------------------------
#
# Two countries, because the multi-country contract is only testable with more
# than one: KE (the default) and NG, whose currency, subdivision label, and
# national insurance scheme all differ. That difference is what the
# country-config tests assert against.

KENYA = {
    "code": "KE",
    "name": "Kenya",
    "brand_suffix": "Kenya",
    "currency": "KES",
    "currency_symbol": "KSh",
    "locale": "en-KE",
    "default_locale": "en",
    "domain": "denthub.co.ke",
    "phone_prefix": "+254",
    "subdivision_label": "County",
    "subdivision_label_plural": "Counties",
    "city_label": "Town",
    "timezone": "Africa/Nairobi",
}

NIGERIA = {
    "code": "NG",
    "name": "Nigeria",
    "brand_suffix": "Nigeria",
    "currency": "NGN",
    "currency_symbol": "₦",
    "locale": "en-NG",
    "default_locale": "en",
    "domain": "denthub.ng",
    "phone_prefix": "+234",
    "subdivision_label": "State",
    "subdivision_label_plural": "States",
    "city_label": "City",
    "timezone": "Africa/Lagos",
}

#: (country_code, name, code)
SUBDIVISIONS: list[tuple[str, str, str]] = [
    ("KE", "Nairobi", "NAIROBI"),
    ("KE", "Mombasa", "MOMBASA"),
    ("NG", "Lagos", "LAGOS"),
    ("NG", "Abuja", "ABUJA"),
]

#: (country_code, feature, is_enabled, primary_scheme). The feature keys are the
#: ones the client already asks about via `useCountryConfig`. These mirror
#: `seed_countries.COUNTRY_FEATURES` exactly: a configured market has a row for
#: every key, and "off" is `is_enabled=False` rather than an absent row. Test
#: data that disagreed with the seed would let a contract pass here and fail in
#: the demo environment.
COUNTRY_FEATURES: list[tuple[str, str, bool, str | None]] = [
    ("KE", "DENTAL_INSURANCE", True, "NHIF"),
    ("KE", "ORAL_CARE_SHOP", True, None),
    ("KE", "JOBS_BOARD", True, None),
    ("KE", "CPD_TRAINING", True, None),
    ("NG", "DENTAL_INSURANCE", True, "NHIS"),
    ("NG", "ORAL_CARE_SHOP", True, None),
    ("NG", "JOBS_BOARD", True, None),
    # Nigeria does not offer CPD training, and says so explicitly.
    ("NG", "CPD_TRAINING", False, None),
]

#: (country_code, name, is_national)
INSURANCE_PROVIDERS: list[tuple[str, str, bool]] = [
    ("KE", "NHIF", True),
    ("KE", "Britam", False),
    ("NG", "NHIS", True),
]

#: (code, name, display_order)
SPECIALTIES: list[tuple[str, str, str, int]] = [
    (
        "general-dentistry",
        "General Dentistry",
        "Check-ups, fillings, extractions, and the ongoing care most visits start with.",
        10,
    ),
    ("orthodontics", "Orthodontics", "Braces and aligners at any age.", 20),
    (
        "paediatric-dentistry",
        "Paediatric Dentistry",
        "Dental care for children, including a first visit that is uneventful.",
        30,
    ),
]


def build_countries() -> list[Country]:
    """Return the seeded Countries with their subdivisions, flags, and providers."""
    countries = [Country(**KENYA), Country(**NIGERIA)]

    subdivisions_by_country: dict[str, list[Subdivision]] = {}
    features_by_country: dict[str, list[CountryFeature]] = {}
    providers_by_country: dict[str, list[InsuranceProvider]] = {}

    for country_code, name, code in SUBDIVISIONS:
        subdivision = Subdivision(country_code=country_code, name=name, code=code)
        subdivisions_by_country.setdefault(country_code, []).append(subdivision)

    for country_code, feature, is_enabled, primary_scheme in COUNTRY_FEATURES:
        flag = CountryFeature(
            country_code=country_code,
            feature=feature,
            is_enabled=is_enabled,
            primary_scheme=primary_scheme,
        )
        features_by_country.setdefault(country_code, []).append(flag)

    for country_code, name, is_national in INSURANCE_PROVIDERS:
        provider = InsuranceProvider(country_code=country_code, name=name, is_national=is_national)
        providers_by_country.setdefault(country_code, []).append(provider)

    for country in countries:
        country.subdivisions = subdivisions_by_country.get(country.code, [])
        country.features = features_by_country.get(country.code, [])
        country.insurance_providers = providers_by_country.get(country.code, [])

    return countries


def build_specialties() -> list[Specialty]:
    """Return the seeded specialties in display order."""
    return [
        Specialty(code=code, name=name, description=description, display_order=display_order)
        for code, name, description, display_order in SPECIALTIES
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


__all__ = [
    "INTERNATIONAL_PRODUCTS",
    "LOCAL_PRODUCTS",
    "build_countries",
    "build_products",
    "build_specialties",
]
