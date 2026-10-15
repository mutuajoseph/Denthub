"""HTTP-level tests for the supplier storefront dashboard (#78).

A supplier account self-serves its store from ``/api/v1/suppliers``: one store
per account, CRUD over only the products it sells, and exact money end to end
(root AGENTS.md, "Money"). Every "not mine" path reads as 404 so one store can
never observe another's records.
"""

from __future__ import annotations

import uuid
from typing import Any

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import async_sessionmaker

from app.logic.v1.auth import create_access_token, hash_password
from app.repositories.user import UserRepository
from app.utils.state import AppState

_PASSWORD = "correct horse battery staple"

_PRODUCT: dict[str, Any] = {
    "name": "Composite Resin 4g",
    "category": "Restorative",
    "retail_price": "350.00",
    "wholesale_price": "260.00",
    "wholesale_min_qty": 6,
}


async def _account(
    state: AppState,
    session_maker: async_sessionmaker[Any],
    *,
    role: str = "supplier",
    is_active: bool = True,
) -> dict[str, str]:
    """Create a user directly and mint a bearer header for them."""
    email = f"store-{uuid.uuid4().hex[:8]}@example.com"
    async with session_maker() as session:
        user = await UserRepository.create(
            session,
            full_name="Acme Dental Supplies",
            email=email,
            password_hash=hash_password(_PASSWORD),
            role=role,
            is_active=is_active,
        )
        await session.commit()

    token = create_access_token(state, user.id, user.role)
    return {"Authorization": f"Bearer {token}"}


async def _create_store(
    client: AsyncClient,
    headers: dict[str, str],
    *,
    name: str = "Acme Dental Supplies",
    country: str = "KE",
    scope: str = "local",
) -> dict[str, Any]:
    """Create the caller's store and return the response body."""
    response = await client.post(
        "/api/v1/suppliers/me",
        json={"name": name, "scope": scope},
        headers={**headers, "Accept-Country": country},
    )
    assert response.status_code == 200, response.text
    return response.json()


async def _add_product(
    client: AsyncClient,
    headers: dict[str, str],
    **overrides: Any,
) -> dict[str, Any]:
    """List a product in the caller's store and return the response body."""
    response = await client.post(
        "/api/v1/suppliers/me/products",
        json={**_PRODUCT, **overrides},
        headers=headers,
    )
    assert response.status_code == 200, response.text
    return response.json()


async def test_store_reads_404_until_the_account_creates_one(
    client: AsyncClient,
    state: AppState,
    session_maker: async_sessionmaker[Any],
) -> None:
    headers = await _account(state, session_maker)

    response = await client.get("/api/v1/suppliers/me", headers=headers)

    assert response.status_code == 404
    assert response.json()["code"] == 404
    assert response.json()["message"] == "Store not found"


async def test_creating_a_store_owns_it_and_derives_a_slug(
    client: AsyncClient,
    state: AppState,
    session_maker: async_sessionmaker[Any],
) -> None:
    headers = await _account(state, session_maker)

    created = await _create_store(client, headers, country="ng")

    assert created["slug"] == "acme-dental-supplies"
    assert created["country_code"] == "NG"
    assert created["scope"] == "local"
    assert created["is_verified"] is False
    assert created["product_count"] == 0

    read = await client.get("/api/v1/suppliers/me", headers=headers)
    assert read.status_code == 200
    assert read.json()["id"] == created["id"]


async def test_creating_a_second_store_conflicts(
    client: AsyncClient,
    state: AppState,
    session_maker: async_sessionmaker[Any],
) -> None:
    headers = await _account(state, session_maker)
    await _create_store(client, headers)

    response = await client.post(
        "/api/v1/suppliers/me",
        json={"name": "Another Store"},
        headers={**headers, "Accept-Country": "KE"},
    )

    assert response.status_code == 409
    assert response.json()["message"] == "This account already has a store"


async def test_a_taken_slug_is_suffixed(
    client: AsyncClient,
    state: AppState,
    session_maker: async_sessionmaker[Any],
) -> None:
    first_headers = await _account(state, session_maker)
    second_headers = await _account(state, session_maker)

    first = await _create_store(client, first_headers, name="Bright Smile")
    second = await _create_store(client, second_headers, name="Bright Smile")

    assert first["slug"] == "bright-smile"
    assert second["slug"].startswith("bright-smile-")
    assert second["slug"] != first["slug"]


async def test_creating_a_store_rejects_a_non_iso_country(
    client: AsyncClient,
    state: AppState,
    session_maker: async_sessionmaker[Any],
) -> None:
    headers = await _account(state, session_maker)

    response = await client.post(
        "/api/v1/suppliers/me",
        json={"name": "Acme Dental Supplies"},
        headers={**headers, "Accept-Country": "KENYA"},
    )

    assert response.status_code == 400
    assert response.json()["message"] == "Country must be a 2-letter ISO code"


async def test_a_store_needs_a_name(
    client: AsyncClient,
    state: AppState,
    session_maker: async_sessionmaker[Any],
) -> None:
    headers = await _account(state, session_maker)

    response = await client.post(
        "/api/v1/suppliers/me",
        json={"scope": "local"},
        headers={**headers, "Accept-Country": "KE"},
    )

    assert response.status_code == 422


async def test_non_supplier_roles_are_forbidden(
    client: AsyncClient,
    state: AppState,
    session_maker: async_sessionmaker[Any],
) -> None:
    for role in ("patient", "admin"):
        headers = await _account(state, session_maker, role=role)

        read = await client.get("/api/v1/suppliers/me", headers=headers)
        assert read.status_code == 403
        assert read.json()["message"] == "Only supplier accounts may manage a storefront"

        create = await client.post(
            "/api/v1/suppliers/me",
            json={"name": "Nope"},
            headers={**headers, "Accept-Country": "KE"},
        )
        assert create.status_code == 403


async def test_a_deactivated_supplier_is_forbidden(
    client: AsyncClient,
    state: AppState,
    session_maker: async_sessionmaker[Any],
) -> None:
    headers = await _account(state, session_maker, is_active=False)

    response = await client.get("/api/v1/suppliers/me", headers=headers)

    assert response.status_code == 403
    assert response.json()["message"] == "User account is deactivated"


async def test_store_routes_require_a_token(client: AsyncClient) -> None:
    assert (await client.get("/api/v1/suppliers/me")).status_code == 401
    assert (await client.get("/api/v1/suppliers/me/products")).status_code == 401
    assert (await client.post("/api/v1/suppliers/me", json={"name": "X"})).status_code == 401


async def test_the_products_list_starts_empty(
    client: AsyncClient,
    state: AppState,
    session_maker: async_sessionmaker[Any],
) -> None:
    headers = await _account(state, session_maker)
    await _create_store(client, headers)

    response = await client.get("/api/v1/suppliers/me/products", headers=headers)

    assert response.status_code == 200
    assert response.json() == {"items": [], "total": 0, "limit": 48, "offset": 0}


async def test_a_listed_product_keeps_money_exact(
    client: AsyncClient,
    state: AppState,
    session_maker: async_sessionmaker[Any],
) -> None:
    headers = await _account(state, session_maker)
    await _create_store(client, headers)

    created = await client.post(
        "/api/v1/suppliers/me/products",
        json=_PRODUCT,
        headers={**headers, "Accept-Currency": "kes"},
    )
    assert created.status_code == 200, created.text
    body = created.json()

    assert body["retail_price"] == "350.00"
    assert body["wholesale_price"] == "260.00"
    assert body["wholesale_min_qty"] == 6
    assert body["currency"] == "KES"
    assert body["country_code"] == "KE"
    assert body["in_stock"] is True
    assert body["dentist_recommended"] is False

    page = await client.get("/api/v1/suppliers/me/products", headers=headers)
    assert page.json()["total"] == 1
    assert page.json()["items"][0]["id"] == body["id"]

    store = await client.get("/api/v1/suppliers/me", headers=headers)
    assert store.json()["product_count"] == 1


async def test_prices_are_quantized_to_two_decimals(
    client: AsyncClient,
    state: AppState,
    session_maker: async_sessionmaker[Any],
) -> None:
    headers = await _account(state, session_maker)
    await _create_store(client, headers)

    body = await _add_product(client, headers, retail_price="349.9")

    assert body["retail_price"] == "349.90"


async def test_a_product_inherits_its_store_market(
    client: AsyncClient,
    state: AppState,
    session_maker: async_sessionmaker[Any],
) -> None:
    headers = await _account(state, session_maker)
    await _create_store(client, headers, country="NG")

    body = await _add_product(client, headers)

    assert body["country_code"] == "NG"


async def test_products_are_scoped_to_their_own_store(
    client: AsyncClient,
    state: AppState,
    session_maker: async_sessionmaker[Any],
) -> None:
    owner_headers = await _account(state, session_maker)
    rival_headers = await _account(state, session_maker)
    await _create_store(client, owner_headers)
    await _create_store(client, rival_headers, name="Rival Supplies")
    product = await _add_product(client, owner_headers)

    rival_list = await client.get("/api/v1/suppliers/me/products", headers=rival_headers)
    assert rival_list.json()["total"] == 0

    patch = await client.patch(
        f"/api/v1/suppliers/me/products/{product['id']}",
        json={"in_stock": False},
        headers=rival_headers,
    )
    assert patch.status_code == 404
    assert patch.json()["message"] == "Product not found"

    owner_list = await client.get("/api/v1/suppliers/me/products", headers=owner_headers)
    assert owner_list.json()["total"] == 1
    assert owner_list.json()["items"][0]["in_stock"] is True


async def test_patch_changes_only_the_fields_sent(
    client: AsyncClient,
    state: AppState,
    session_maker: async_sessionmaker[Any],
) -> None:
    headers = await _account(state, session_maker)
    await _create_store(client, headers)
    created = await _add_product(client, headers)

    response = await client.patch(
        f"/api/v1/suppliers/me/products/{created['id']}",
        json={"in_stock": False},
        headers=headers,
    )

    assert response.status_code == 200
    body = response.json()
    assert body["in_stock"] is False
    assert body["name"] == created["name"]
    assert body["retail_price"] == created["retail_price"]
    assert body["wholesale_price"] == created["wholesale_price"]

    repriced = await client.patch(
        f"/api/v1/suppliers/me/products/{created['id']}",
        json={"retail_price": "400.50"},
        headers=headers,
    )
    assert repriced.json()["retail_price"] == "400.50"
    assert repriced.json()["in_stock"] is False


async def test_patch_cannot_blank_a_required_field(
    client: AsyncClient,
    state: AppState,
    session_maker: async_sessionmaker[Any],
) -> None:
    headers = await _account(state, session_maker)
    await _create_store(client, headers)
    created = await _add_product(client, headers)

    response = await client.patch(
        f"/api/v1/suppliers/me/products/{created['id']}",
        json={"name": None, "retail_price": None, "category": None},
        headers=headers,
    )

    assert response.status_code == 200
    assert response.json()["name"] == created["name"]
    assert response.json()["retail_price"] == created["retail_price"]
    assert response.json()["category"] == created["category"]


async def test_patch_null_clears_the_wholesale_tier(
    client: AsyncClient,
    state: AppState,
    session_maker: async_sessionmaker[Any],
) -> None:
    headers = await _account(state, session_maker)
    await _create_store(client, headers)
    created = await _add_product(client, headers)
    assert created["wholesale_price"] == "260.00"

    response = await client.patch(
        f"/api/v1/suppliers/me/products/{created['id']}",
        json={"wholesale_price": None},
        headers=headers,
    )

    assert response.status_code == 200
    assert response.json()["wholesale_price"] is None


async def test_patching_an_unknown_product_is_404(
    client: AsyncClient,
    state: AppState,
    session_maker: async_sessionmaker[Any],
) -> None:
    headers = await _account(state, session_maker)
    await _create_store(client, headers)

    response = await client.patch(
        "/api/v1/suppliers/me/products/does-not-exist",
        json={"in_stock": False},
        headers=headers,
    )

    assert response.status_code == 404
    assert response.json()["message"] == "Product not found"


async def test_a_product_cannot_be_listed_before_the_store_exists(
    client: AsyncClient,
    state: AppState,
    session_maker: async_sessionmaker[Any],
) -> None:
    headers = await _account(state, session_maker)

    response = await client.post(
        "/api/v1/suppliers/me/products",
        json=_PRODUCT,
        headers=headers,
    )

    assert response.status_code == 404
    assert response.json()["message"] == "Store not found"


async def test_invalid_product_bodies_are_rejected(
    client: AsyncClient,
    state: AppState,
    session_maker: async_sessionmaker[Any],
) -> None:
    headers = await _account(state, session_maker)
    await _create_store(client, headers)

    overrides = [
        {"name": ""},
        {"category": ""},
        {"retail_price": "0"},
        {"retail_price": "-5.00"},
        {"retail_price": "10.999"},
        {"wholesale_price": "-1"},
        {"wholesale_min_qty": -1},
    ]

    for override in overrides:
        response = await client.post(
            "/api/v1/suppliers/me/products",
            json={**_PRODUCT, **override},
            headers=headers,
        )
        assert response.status_code == 422, override
