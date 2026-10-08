"""Test data factories.

Prices and wholesale thresholds are fixed here so pricing tests can assert
exact amounts. Each product entry is `(name, retail, wholesale_or_None,
min_qty, category, in_stock)`.
"""

from __future__ import annotations

from datetime import time
from decimal import Decimal

from app.repositories.country import (
    Country,
    CountryFeature,
    InsuranceProvider,
    Specialty,
    Subdivision,
)
from app.repositories.listing import Branch, Facility, OpeningHour, Specialist
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


# --- Listings -----------------------------------------------------------------
#
# Three Facilities across two markets and two subdivisions, each at a different
# verification tier, plus one Specialist per market attached to a Facility's
# Branch. The hours are deliberately extreme - a branch open every minute of the
# week, one open on no day at all - so an API test can assert `open_now` without
# depending on when it runs.


def _hours(weekday: int, opens: str | None, closes: str | None, is_closed: bool) -> OpeningHour:
    return OpeningHour(
        weekday=weekday,
        opens=time.fromisoformat(opens) if opens else None,
        closes=time.fromisoformat(closes) if closes else None,
        is_closed=is_closed,
    )


def _always_open() -> list[OpeningHour]:
    return [_hours(weekday, "00:00", "23:59", False) for weekday in range(7)]


def build_listings(specialties: list[Specialty]) -> tuple[list[Facility], list[Specialist]]:
    """Return the seeded Facilities and Specialists, relationships wired.

    ``specialties`` must be the same instances ``build_specialties`` returned so
    the join tables resolve against the rows already in the session.
    """
    by_code = {row.code: row for row in specialties}

    westlands = Branch(
        name="Westlands",
        subdivision_code="NAIROBI",
        address="Kileleshwa Road, Nairobi",
        phone="+254 711 000 111",
        email="hello@smilepoint.test",
        opening_hours=[
            # Mon-Fri 08:00-17:00, Sat 09:00-13:00, Sun explicitly closed.
            *[_hours(weekday, "08:00", "17:00", False) for weekday in range(5)],
            _hours(5, "09:00", "13:00", False),
            _hours(6, None, None, True),
        ],
    )
    emergency = Branch(
        name="24-Hour Emergency",
        subdivision_code="NAIROBI",
        address="Ngong Road, Nairobi",
        phone="+254 711 000 112",
        # Open every minute of the week, so an API test can assert
        # `open_now is True` whenever it happens to run.
        opening_hours=_always_open(),
    )
    smile_point = Facility(
        name="Smile Point Dental",
        country_code="KE",
        subdivision_code="NAIROBI",
        address="Kileleshwa Road, Nairobi",
        phone="+254 711 000 111",
        email="hello@smilepoint.test",
        verification_tier="verified",
        currency="KES",
        list_price=Decimal("2500"),
        rating=Decimal("4.80"),
        review_count=37,
        branches=[westlands, emergency],
    )

    nyali_branch = Branch(
        subdivision_code="MOMBASA",
        address="Shanzu Road, Mombasa",
        # An explicit closed day and no other rows: closed whatever the clock says.
        opening_hours=[_hours(6, None, None, True)],
    )
    nyali = Facility(
        name="Nyali Coastal Dental",
        country_code="KE",
        subdivision_code="MOMBASA",
        address="Shanzu Road, Mombasa",
        verification_tier="unverified",
        currency="KES",
        list_price=None,
        rating=None,
        review_count=0,
        branches=[nyali_branch],
    )

    victoria_island = Branch(
        name="Victoria Island",
        subdivision_code="LAGOS",
        address="Adetokunbo Ademola Street, Lagos",
        phone="+234 801 000 222",
        email="care@lagospearl.test",
        opening_hours=[],
    )
    lagos_pearl = Facility(
        name="Lagos Pearl Dental",
        country_code="NG",
        subdivision_code="LAGOS",
        address="Adetokunbo Ademola Street, Lagos",
        phone="+234 801 000 222",
        email="care@lagospearl.test",
        verification_tier="basic",
        currency="NGN",
        list_price=Decimal("45000"),
        rating=Decimal("4.50"),
        review_count=10,
        branches=[victoria_island],
    )

    amina = Specialist(
        name="Dr. Amina Otieno",
        slug="amina-otieno",
        country_code="KE",
        subdivision_code="NAIROBI",
        currency="KES",
        list_price=Decimal("3500"),
        rating=Decimal("4.90"),
        review_count=12,
        specialties=[by_code["general-dentistry"], by_code["orthodontics"]],
        branches=[westlands],
    )

    chidi = Specialist(
        name="Dr. Chidi Okafor",
        slug="chidi-okafor",
        country_code="NG",
        subdivision_code="LAGOS",
        currency="NGN",
        list_price=Decimal("50000"),
        rating=None,
        review_count=0,
        specialties=[by_code["general-dentistry"]],
        branches=[victoria_island],
    )

    return [smile_point, nyali, lagos_pearl], [amina, chidi]


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
    "build_listings",
    "build_products",
    "build_specialties",
]
