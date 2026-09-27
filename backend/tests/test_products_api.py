"""HTTP-level tests for the product catalog endpoints."""

from __future__ import annotations

from decimal import Decimal

from httpx import AsyncClient

KE = {"Accept-Country": "KE", "Accept-Currency": "KES"}


async def test_list_products_defaults_to_in_stock(client: AsyncClient) -> None:
    response = await client.get("/api/v1/products", headers=KE)

    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 5
    assert body["country_code"] == "KE"
    assert body["currency"] == "KES"
    assert all(item["in_stock"] for item in body["items"])


async def test_in_stock_false_surfaces_out_of_stock(client: AsyncClient) -> None:
    response = await client.get("/api/v1/products", params={"in_stock": "false"}, headers=KE)

    body = response.json()
    assert body["total"] == 6
    assert any(item["name"] == "X-Ray Sensor Holder" for item in body["items"])


async def test_quantity_drives_pricing_tier(client: AsyncClient) -> None:
    retail = await client.get(
        "/api/v1/products", params={"q": "Adult Medium", "quantity": 1}, headers=KE
    )
    wholesale = await client.get(
        "/api/v1/products", params={"q": "Adult Medium", "quantity": 12}, headers=KE
    )

    retail_pricing = retail.json()["items"][0]["pricing"]
    wholesale_pricing = wholesale.json()["items"][0]["pricing"]

    assert retail_pricing["purchase_mode"] == "retail"
    assert Decimal(str(retail_pricing["unit_price"])) == Decimal("350.00")
    assert Decimal(str(retail_pricing["line_total"])) == Decimal("350.00")

    assert wholesale_pricing["purchase_mode"] == "wholesale"
    assert Decimal(str(wholesale_pricing["unit_price"])) == Decimal("260.00")
    assert Decimal(str(wholesale_pricing["line_total"])) == Decimal("3120.00")


async def test_derived_wholesale_pricing_over_http(client: AsyncClient) -> None:
    at_threshold = await client.get(
        "/api/v1/products", params={"q": "Dental Floss", "quantity": 24}, headers=KE
    )
    below_threshold = await client.get(
        "/api/v1/products", params={"q": "Dental Floss", "quantity": 23}, headers=KE
    )

    wholesale = at_threshold.json()["items"][0]["pricing"]
    retail = below_threshold.json()["items"][0]["pricing"]

    assert wholesale["purchase_mode"] == "wholesale"
    # The stored column is NULL; the response reports the *derived* price so a
    # client never has to recompute the discount.
    assert wholesale["wholesale_price"] is not None
    assert Decimal(str(wholesale["wholesale_price"])) == Decimal("337.50")
    assert wholesale["wholesale_min_qty"] == 24
    assert Decimal(str(wholesale["unit_price"])) == Decimal("337.50")
    assert Decimal(str(wholesale["line_total"])) == Decimal("8100.00")

    assert retail["purchase_mode"] == "retail"
    assert Decimal(str(retail["unit_price"])) == Decimal("450.00")


async def test_retail_only_product_never_discounts(client: AsyncClient) -> None:
    response = await client.get(
        "/api/v1/products", params={"q": "Bubblegum", "quantity": 500}, headers=KE
    )

    pricing = response.json()["items"][0]["pricing"]
    assert pricing["purchase_mode"] == "retail"
    assert pricing["wholesale_price"] is None
    assert Decimal(str(pricing["unit_price"])) == Decimal("300.00")


async def test_filter_by_category(client: AsyncClient) -> None:
    response = await client.get("/api/v1/products", params={"category": "floss"}, headers=KE)

    items = response.json()["items"]
    assert response.json()["total"] == 1
    assert items[0]["name"] == "Mint Dental Floss 50m"


async def test_search_matches_brand(client: AsyncClient) -> None:
    response = await client.get("/api/v1/products", params={"q": "Sonicare"}, headers=KE)

    assert response.json()["total"] == 1
    assert response.json()["items"][0]["brand"] == "Philips Sonicare"


async def test_search_is_case_insensitive(client: AsyncClient) -> None:
    lower = await client.get("/api/v1/products", params={"q": "toothbrush"}, headers=KE)
    upper = await client.get("/api/v1/products", params={"q": "TOOTHBRUSH"}, headers=KE)

    assert lower.json()["total"] == upper.json()["total"] == 2


async def test_pagination_reports_totals(client: AsyncClient) -> None:
    response = await client.get("/api/v1/products", params={"limit": 2, "offset": 2}, headers=KE)

    body = response.json()
    assert body["total"] == 5
    assert body["limit"] == 2
    assert body["offset"] == 2
    assert len(body["items"]) == 2


async def test_product_includes_supplier_summary(client: AsyncClient) -> None:
    response = await client.get("/api/v1/products", params={"q": "Adult Medium"}, headers=KE)

    supplier = response.json()["items"][0]["supplier"]
    assert supplier["slug"] == "nairobi-dental-supplies"
    assert supplier["scope"] == "local"
    assert supplier["is_verified"] is True


async def test_categories_lists_distinct_values(client: AsyncClient) -> None:
    response = await client.get("/api/v1/products/categories", headers=KE)

    assert response.status_code == 200
    body = response.json()
    assert body["country_code"] == "KE"
    assert body["categories"] == sorted(body["categories"])
    assert "floss" in body["categories"]


async def test_detail_prices_for_requested_quantity(client: AsyncClient, product_id: str) -> None:
    response = await client.get(
        f"/api/v1/products/{product_id}", params={"quantity": 12}, headers=KE
    )

    assert response.status_code == 200
    pricing = response.json()["pricing"]
    assert pricing["purchase_mode"] == "wholesale"
    assert Decimal(str(pricing["unit_price"])) == Decimal("260.00")


async def test_unknown_product_returns_404_envelope(client: AsyncClient) -> None:
    response = await client.get("/api/v1/products/does-not-exist", headers=KE)

    assert response.status_code == 404
    body = response.json()
    assert body["code"] == 404
    assert body["message"] == "Product not found"
    assert "detail" in body


async def test_unknown_country_returns_empty_page_with_negotiated_currency(
    client: AsyncClient,
) -> None:
    response = await client.get(
        "/api/v1/products", headers={"Accept-Country": "UG", "Accept-Currency": "UGX"}
    )

    body = response.json()
    assert response.status_code == 200
    assert body["total"] == 0
    assert body["items"] == []
    assert body["currency"] == "UGX"


async def test_headers_are_optional(client: AsyncClient) -> None:
    """Missing country/currency headers fall back to the Kenya defaults."""
    response = await client.get("/api/v1/products")

    body = response.json()
    assert response.status_code == 200
    assert body["country_code"] == "KE"
    assert body["total"] == 5


async def test_invalid_quantity_is_rejected(client: AsyncClient) -> None:
    response = await client.get("/api/v1/products", params={"quantity": 0}, headers=KE)

    assert response.status_code == 422


async def test_limit_above_max_is_rejected(client: AsyncClient) -> None:
    response = await client.get("/api/v1/products", params={"limit": 500}, headers=KE)

    assert response.status_code == 422


async def test_negative_offset_is_rejected(client: AsyncClient) -> None:
    response = await client.get("/api/v1/products", params={"offset": -1}, headers=KE)

    assert response.status_code == 422
