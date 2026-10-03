"""Country configuration API tests.

The contract these endpoints carry is the multi-country one: the response tells
a client how to render money and geography for a market *before* it fetches any
listing. So the tests assert on cross-country differences, not just shape.
"""

from __future__ import annotations

from httpx import AsyncClient

BASE = "/api/v1/config"


async def test_country_config_reports_currency_and_labels(client: AsyncClient) -> None:
    response = await client.get(f"{BASE}/country", params={"country": "KE"})
    assert response.status_code == 200

    body = response.json()
    assert body["code"] == "KE"
    assert body["currency"] == "KES"
    assert body["currency_symbol"] == "KSh"
    assert body["timezone"] == "Africa/Nairobi"
    assert body["geography"] == {
        "subdivision_label": "County",
        "subdivision_label_plural": "Counties",
        "city_label": "Town",
    }


async def test_country_config_differs_per_country(client: AsyncClient) -> None:
    """Nigeria must not inherit Kenya's currency, labels, or timezone."""
    response = await client.get(f"{BASE}/country", params={"country": "NG"})
    assert response.status_code == 200

    body = response.json()
    assert body["code"] == "NG"
    assert body["currency"] == "NGN"
    assert body["phone_prefix"] == "+234"
    assert body["geography"]["subdivision_label"] == "State"
    assert body["timezone"] == "Africa/Lagos"


async def test_country_config_falls_back_to_default_on_unknown_country(
    client: AsyncClient,
) -> None:
    """A stale client holding a retired country degrades to Kenya, not a 404."""
    response = await client.get(f"{BASE}/country", params={"country": "ZZ"})

    assert response.status_code == 200
    assert response.json()["code"] == "KE"


async def test_country_config_reads_accept_country_header(client: AsyncClient) -> None:
    """With no query parameter the ambient market comes from the header."""
    response = await client.get(f"{BASE}/country", headers={"Accept-Country": "NG"})

    assert response.status_code == 200
    assert response.json()["code"] == "NG"


async def test_country_config_query_overrides_accept_country_header(
    client: AsyncClient,
) -> None:
    """A region switcher asks 'what does NG look like' without changing the market."""
    response = await client.get(
        f"{BASE}/country", params={"country": "NG"}, headers={"Accept-Country": "KE"}
    )

    assert response.status_code == 200
    assert response.json()["code"] == "NG"


async def test_country_config_embeds_subdivisions(client: AsyncClient) -> None:
    """First paint needs one request, so subdivisions ride along with the config."""
    response = await client.get(f"{BASE}/country", params={"country": "KE"})

    names = [row["name"] for row in response.json()["subdivisions"]]
    assert names == ["Mombasa", "Nairobi"]


async def test_country_config_reports_feature_flags_with_primary_scheme(
    client: AsyncClient,
) -> None:
    response = await client.get(f"{BASE}/country", params={"country": "KE"})
    flags = {row["feature"]: row for row in response.json()["features"]}

    assert flags["DENTAL_INSURANCE"]["is_enabled"] is True
    assert flags["DENTAL_INSURANCE"]["primary_scheme"] == "NHIF"
    assert flags["ORAL_CARE_SHOP"]["is_enabled"] is True
    # A flag with no country-specific scheme reports null, not a missing key.
    assert flags["JOBS_BOARD"]["primary_scheme"] is None


async def test_country_config_reports_a_disabled_flag(client: AsyncClient) -> None:
    """A market with training turned off must say so explicitly."""
    response = await client.get(f"{BASE}/country", params={"country": "NG"})
    flags = {row["feature"]: row for row in response.json()["features"]}

    assert flags["CPD_TRAINING"]["is_enabled"] is False


async def test_country_config_reports_insurance_providers(client: AsyncClient) -> None:
    response = await client.get(f"{BASE}/country", params={"country": "KE"})
    providers = {row["name"]: row for row in response.json()["insurance_providers"]}

    assert providers["NHIF"]["is_national"] is True
    assert providers["Britam"]["is_national"] is False


async def test_countries_lists_every_active_country(client: AsyncClient) -> None:
    response = await client.get(f"{BASE}/countries")

    assert response.status_code == 200
    body = response.json()
    assert [row["code"] for row in body["items"]] == ["KE", "NG"]
    assert body["default_country_code"] == "KE"


async def test_countries_list_omits_child_collections(client: AsyncClient) -> None:
    """The switcher needs labels, not a subdivisions payload per country."""
    response = await client.get(f"{BASE}/countries")
    first = response.json()["items"][0]

    assert "subdivisions" not in first
    assert "insurance_providers" not in first
    assert first["subdivision_label"] == "County"


async def test_regions_lists_subdivisions_alphabetically(client: AsyncClient) -> None:
    response = await client.get(f"{BASE}/country/regions", params={"country": "KE"})

    assert response.status_code == 200
    body = response.json()
    assert body["country_code"] == "KE"
    assert [row["name"] for row in body["items"]] == ["Mombasa", "Nairobi"]
    assert body["items"][0]["code"] == "MOMBASA"


async def test_regions_for_unknown_country_is_empty_not_defaulted(
    client: AsyncClient,
) -> None:
    """Kenyan counties in a Nigerian visitor's dropdown would be worse than none."""
    response = await client.get(f"{BASE}/country/regions", params={"country": "ZZ"})

    assert response.status_code == 200
    assert response.json() == {"country_code": "ZZ", "items": []}


async def test_specialties_are_listed_in_display_order(client: AsyncClient) -> None:
    response = await client.get(f"{BASE}/specialties")

    assert response.status_code == 200
    items = response.json()["items"]
    assert [row["code"] for row in items] == [
        "general-dentistry",
        "orthodontics",
        "paediatric-dentistry",
    ]


async def test_country_config_reports_locale_and_its_fallback(
    client: AsyncClient,
) -> None:
    """`locale` formats money; `default_locale` is the no-preference fallback.

    They are separate fields because collapsing them either mistranslates prices
    or leaves a visitor with no language, so the response has to carry both.
    """
    response = await client.get(f"{BASE}/country", params={"country": "KE"})

    body = response.json()
    assert body["locale"] == "en-KE"
    assert body["default_locale"] == "en"
    assert body["locale"] != body["default_locale"]


async def test_specialties_carry_a_description(client: AsyncClient) -> None:
    """The filter menu shows one line under the name, so it is served, not null."""
    response = await client.get(f"{BASE}/specialties")

    general = next(row for row in response.json()["items"] if row["code"] == "general-dentistry")
    assert general["description"].startswith("Check-ups")


async def test_specialties_expose_a_stable_code_for_cache_keys(
    client: AsyncClient,
) -> None:
    """The slug, not the display label, is what a query string carries."""
    response = await client.get(f"{BASE}/specialties")
    paediatric = next(
        row for row in response.json()["items"] if row["code"] == "paediatric-dentistry"
    )

    assert paediatric["name"] == "Paediatric Dentistry"
