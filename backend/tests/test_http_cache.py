"""HTTP caching and negotiation reflection for public reads (ADR-0002, #23).

The two claims under test:

1. A public GET answer is cacheable: it carries an ``ETag``, a ``Cache-Control``
   policy, and a ``Vary`` header naming every negotiation input the read can
   see. A conditional request for the same bytes gets a 304 with no body.
2. Negotiation never converts money or lies about the market. A request for an
   unsupported currency or country gets the market's own answer, and the
   response reflects it in ``Content-Currency`` / ``Content-Country`` so the
   client shows what really happened.

Auth, users, health, and error replies are never publicly cached.
"""

from __future__ import annotations

import hashlib

import pytest

BASE = "/api/v1"

VARY = "Accept-Country, Accept-Currency, Accept-Language"


def _sha(content: bytes) -> str:
    return hashlib.sha256(content).hexdigest()


def _assert_cached(response) -> None:
    assert response.status_code == 200
    assert response.headers["vary"] == VARY
    assert response.headers["cache-control"]
    assert response.headers["etag"] == f'"{_sha(response.content)}"'


async def test_config_country_is_cacheable_and_negotiates(client):
    response = await client.get(f"{BASE}/config/country", headers={"Accept-Country": "KE"})
    _assert_cached(response)
    assert response.headers["cache-control"] == "public, max-age=300, must-revalidate"
    assert response.headers["content-country"] == "KE"
    assert response.headers["content-currency"] == "KES"
    assert response.headers["content-language"] == "en"


async def test_unknown_country_falls_back_and_says_so(client):
    response = await client.get(f"{BASE}/config/country", headers={"Accept-Country": "XX"})
    assert response.status_code == 200
    assert response.json()["code"] == "KE"
    assert response.headers["content-country"] == "KE"


async def test_catalogue_read_uses_revalidation_policy(client):
    response = await client.get(f"{BASE}/products")
    _assert_cached(response)
    assert response.headers["cache-control"] == "public, no-cache"
    assert response.headers["content-currency"] == "KES"


async def test_unsupported_currency_serves_market_currency_and_says_so(client):
    response = await client.get(f"{BASE}/products", headers={"Accept-Currency": "EUR"})
    assert response.status_code == 200
    assert response.json()["currency"] == "KES"
    assert response.headers["content-currency"] == "KES"
    assert response.headers["vary"] == VARY


async def test_matching_if_none_match_returns_304(client):
    first = await client.get(f"{BASE}/products")
    etag = first.headers["etag"]

    second = await client.get(f"{BASE}/products", headers={"If-None-Match": etag})
    assert second.status_code == 304
    assert second.content == b""
    assert second.headers["etag"] == etag
    assert second.headers["cache-control"] == "public, no-cache"
    assert second.headers["vary"] == VARY


async def test_different_country_is_a_different_cache_entry(client):
    ke = await client.get(f"{BASE}/facilities", headers={"Accept-Country": "KE"})
    ng = await client.get(f"{BASE}/facilities", headers={"Accept-Country": "NG"})
    assert ke.status_code == 200
    assert ng.status_code == 200
    assert ke.json()["country_code"] == "KE"
    assert ng.json()["country_code"] == "NG"
    assert ke.headers["etag"] != ng.headers["etag"]

    cross = await client.get(
        f"{BASE}/facilities", headers={"Accept-Country": "KE", "If-None-Match": ng.headers["etag"]}
    )
    assert cross.status_code == 200
    assert cross.json()["country_code"] == "KE"


async def test_weak_comparators_and_wildcards_match(client):
    first = await client.get(f"{BASE}/products")
    etag = first.headers["etag"]

    weak = await client.get(f"{BASE}/products", headers={"If-None-Match": f"W/{etag}"})
    assert weak.status_code == 304

    wildcard = await client.get(f"{BASE}/products", headers={"If-None-Match": "*"})
    assert wildcard.status_code == 304


async def test_health_is_never_publicly_cached(client):
    response = await client.get(f"{BASE}/health")
    assert response.status_code == 200
    assert "cache-control" not in response.headers
    assert "etag" not in response.headers
    assert "vary" not in response.headers


async def test_error_replies_are_not_publicly_cached(client):
    response = await client.get(f"{BASE}/products/does-not-exist")
    assert response.status_code == 404
    assert "cache-control" not in response.headers
    assert "etag" not in response.headers


async def test_non_get_requests_are_not_publicly_cached(client):
    response = await client.post(f"{BASE}/auth/login", json={"email": "nobody@example.com"})
    assert "cache-control" not in response.headers
    assert "etag" not in response.headers


async def test_home_and_magazine_reads_are_revalidated(client):
    for path in ("/home/featured", "/magazine/articles"):
        response = await client.get(f"{BASE}{path}", headers={"Accept-Country": "KE"})
        _assert_cached(response)
        assert response.headers["cache-control"] == "public, no-cache"