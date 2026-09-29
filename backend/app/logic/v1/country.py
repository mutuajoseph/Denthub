"""Country configuration logic: the reference data every catalogue request reads.

`Accept-Country` selects a Country; the response reports its currency, locale,
Subdivision labels, feature flags, and insurance providers. Clients use this to
render money and geography correctly *before* any listing is fetched, so it is
the one endpoint that has to work with an empty catalogue.

Country resolution is deliberately lenient: an unknown code falls back to the
default market rather than 404-ing, because a stale client cache holding a
retired country should degrade to Kenya, not to an error page.
"""

from __future__ import annotations

from pydantic import BaseModel

from app.exceptions import BaseApiException
from app.repositories.country import (
    Country,
    CountryRepository,
    SpecialtyRepository,
    Subdivision,
    SubdivisionRepository,
)
from app.utils.state import AppState


class CountryConfigurationMissingException(BaseApiException):
    """No reference data is seeded at all, so even the default market is unknown.

    Distinct from a 404 on a country: this is a deployment fault, and a client
    hitting it should be told to retry rather than to stop looking.
    """

    code = 503
    message = "Country configuration is unavailable"


#: The market a request falls back to when its ``Accept-Country`` is unknown or
#: absent. Kenya-first per the PRD.
DEFAULT_COUNTRY_CODE = "KE"


class CountryGeography(BaseModel):
    """How a Country names its administrative divisions."""

    subdivision_label: str
    subdivision_label_plural: str
    city_label: str


class CountryFeatureFlag(BaseModel):
    """One feature flag as the client reads it."""

    feature: str
    is_enabled: bool
    primary_scheme: str | None = None


class InsuranceProviderSummary(BaseModel):
    """A plan a listing may accept in this Country."""

    id: str
    name: str
    is_national: bool


class SubdivisionResponse(BaseModel):
    """A Subdivision, as the region filter and search need it."""

    id: str
    name: str
    code: str
    country_code: str


class CountryConfig(BaseModel):
    """Everything a client needs to render one market correctly."""

    code: str
    name: str
    brand_suffix: str | None
    currency: str
    currency_symbol: str
    locale: str
    domain: str
    phone_prefix: str
    timezone: str
    geography: CountryGeography
    features: list[CountryFeatureFlag]
    insurance_providers: list[InsuranceProviderSummary]
    subdivisions: list[SubdivisionResponse]


class CountrySummary(BaseModel):
    """A Country in a list, without its subdivisions or providers."""

    code: str
    name: str
    currency: str
    currency_symbol: str
    locale: str
    subdivision_label: str
    subdivision_label_plural: str
    timezone: str


class CountryList(BaseModel):
    """Every active Country, for the region switcher."""

    items: list[CountrySummary]
    default_country_code: str


class SubdivisionList(BaseModel):
    """Subdivisions for one Country."""

    country_code: str
    items: list[SubdivisionResponse]


class SpecialtyResponse(BaseModel):
    """A dental Specialty, shared by listings, Courses, and filters."""

    id: str
    code: str
    name: str
    display_order: int


class SpecialtyList(BaseModel):
    items: list[SpecialtyResponse]


def _serialize_subdivision(subdivision: Subdivision) -> SubdivisionResponse:
    return SubdivisionResponse(
        id=subdivision.id,
        name=subdivision.name,
        code=subdivision.code,
        country_code=subdivision.country_code,
    )


def _serialize_country(country: Country) -> CountryConfig:
    return CountryConfig(
        code=country.code,
        name=country.name,
        brand_suffix=country.brand_suffix,
        currency=country.currency,
        currency_symbol=country.currency_symbol,
        locale=country.locale,
        domain=country.domain,
        phone_prefix=country.phone_prefix,
        timezone=country.timezone,
        geography=CountryGeography(
            subdivision_label=country.subdivision_label,
            subdivision_label_plural=country.subdivision_label_plural,
            city_label=country.city_label,
        ),
        features=[
            CountryFeatureFlag(
                feature=feature.feature,
                is_enabled=feature.is_enabled,
                primary_scheme=feature.primary_scheme,
            )
            for feature in sorted(country.features, key=lambda row: row.feature)
        ],
        insurance_providers=[
            InsuranceProviderSummary(
                id=provider.id,
                name=provider.name,
                is_national=provider.is_national,
            )
            for provider in sorted(country.insurance_providers, key=lambda row: row.name)
        ],
        subdivisions=[],
    )


def _serialize_summary(country: Country) -> CountrySummary:
    return CountrySummary(
        code=country.code,
        name=country.name,
        currency=country.currency,
        currency_symbol=country.currency_symbol,
        locale=country.locale,
        subdivision_label=country.subdivision_label,
        subdivision_label_plural=country.subdivision_label_plural,
        timezone=country.timezone,
    )


async def get_country_config(state: AppState, *, country_code: str) -> CountryConfig:
    """Return the configuration for ``country_code``, defaulting when unknown.

    The response embeds the Country's Subdivisions so a client's first paint
    needs one request rather than two; ``/config/country/regions`` exists for
    refreshes and for callers that only want the geography.
    """
    wanted = country_code.upper()

    async with state.db_session_maker() as session:
        country = await CountryRepository.get(session, wanted)
        subdivisions = (
            []
            if country is None
            else await SubdivisionRepository.list_all(session, country_code=country.code)
        )

    if country is None:
        async with state.db_session_maker() as session:
            country = await CountryRepository.get(session, DEFAULT_COUNTRY_CODE)
            if country is not None:
                subdivisions = await SubdivisionRepository.list_all(
                    session, country_code=country.code
                )

    if country is None:
        raise CountryConfigurationMissingException()  # noqa: B904

    config = _serialize_country(country)
    config.subdivisions = [_serialize_subdivision(row) for row in subdivisions]
    return config


async def list_countries(state: AppState) -> CountryList:
    """Every active Country, for the region switcher."""
    async with state.db_session_maker() as session:
        countries = await CountryRepository.list_active(session)

    return CountryList(
        items=[_serialize_summary(country) for country in countries],
        default_country_code=DEFAULT_COUNTRY_CODE,
    )


async def list_subdivisions(state: AppState, *, country_code: str) -> SubdivisionList:
    """Every Subdivision in ``country_code``, alphabetical.

    An unknown country returns an empty list rather than falling back to Kenya:
    a region filter offering Kenyan counties to a Nigerian visitor is worse than
    an empty dropdown, and the caller already holds the Country's own config.
    """
    wanted = country_code.upper()

    async with state.db_session_maker() as session:
        rows = await SubdivisionRepository.list_all(session, country_code=wanted)

    return SubdivisionList(country_code=wanted, items=[_serialize_subdivision(row) for row in rows])


async def list_specialties(state: AppState) -> SpecialtyList:
    """Every Specialty, in filter-menu order."""
    async with state.db_session_maker() as session:
        rows = await SpecialtyRepository.list_all(session)

    return SpecialtyList(
        items=[
            SpecialtyResponse(
                id=row.id, code=row.code, name=row.name, display_order=row.display_order
            )
            for row in rows
        ]
    )
