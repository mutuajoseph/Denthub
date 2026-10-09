"""HTTP caching for public read endpoints (ADR-0002, issue #23).

Every public GET answer carries a strong ``ETag`` (SHA-256 over the serialised
body), a ``Cache-Control`` policy, and a ``Vary`` header naming every
negotiation input a read can see. A proxy or browser that caches the response
revalidates with ``If-None-Match``; when nothing changed the server answers
304 with no body.

The ETag is a body hash, not a request hash: the bytes a country-, currency-,
or language-shaped body differs in become a different cache entry, and a stale
or empty body can never come back as a hit. Negotiation never converts money
or translates content; the response simply reflects the market it actually
resolved to, in ``Content-Country`` / ``Content-Currency`` / ``Content-Language``,
so a client that asked for something the server cannot serve still shows the
truth ("prices in KES") instead of a quietly wrong answer.

Authentication, users, and health replies are never publicly cached, and error
replies pass through untouched.
"""

from __future__ import annotations

import hashlib
import json
import re
from collections.abc import AsyncIterable, Awaitable, Callable
from typing import Protocol, cast

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from app.config import API_V1_PREFIX

#: Every header a cache key must vary on: the negotiation inputs a read can see.
VARY_HEADERS = "Accept-Country, Accept-Currency, Accept-Language"

#: Reference data may be retained a little longer; everything else is stored
#: but must be revalidated on every read.
CONFIG_CACHE_CONTROL = "public, max-age=300, must-revalidate"
RESOURCE_CACHE_CONTROL = "public, no-cache"

#: Replies that are person- or infra-specific and never become public caches.
_NON_CACHEABLE_PREFIXES = tuple(
    f"{API_V1_PREFIX}{suffix}" for suffix in ("/auth", "/users", "/health")
)
_CONFIG_PREFIX = f"{API_V1_PREFIX}/config/"


class _BufferedBody(Protocol):
    """The body my ``call_next`` hands back is streamed, not fully materialised.

    Starlette's ``BaseHTTPMiddleware`` wraps the inner response in a streaming
    response whose ``body_iterator`` we collect, so it can be hashed without an
    ``# type: ignore`` on ``Response`` (which does not declare the attribute).
    """

    body_iterator: AsyncIterable[bytes]


_COUNTRY_CODE_PATTERN = re.compile(r"[A-Z]{2}")


class HttpCacheMiddleware(BaseHTTPMiddleware):
    async def dispatch(
        self, request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        response = await call_next(request)

        if (
            request.method != "GET"
            or request.url.path.startswith(_NON_CACHEABLE_PREFIXES)
            or response.status_code >= 400
            or "cache-control" in response.headers
        ):
            return response

        chunks = [chunk async for chunk in cast(_BufferedBody, response).body_iterator]
        body = b"".join(chunks)
        etag = '"' + hashlib.sha256(body).hexdigest() + '"'

        cache_control = (
            CONFIG_CACHE_CONTROL
            if request.url.path.startswith(_CONFIG_PREFIX)
            else RESOURCE_CACHE_CONTROL
        )

        headers = dict(response.headers)
        headers["etag"] = etag
        headers["vary"] = VARY_HEADERS
        headers["cache-control"] = cache_control
        headers.update(_content_headers(body))

        if _etag_matches(request.headers.get("if-none-match"), etag):
            slim = {
                name: value
                for name, value in headers.items()
                if name not in ("content-type", "content-length")
            }
            return Response(status_code=304, headers=slim)

        headers["content-length"] = str(len(body))
        return Response(status_code=response.status_code, headers=headers, content=body)


def _content_headers(body: bytes) -> dict[str, str]:
    """Reflect the market a response actually resolved to (negotiation fallback).

    The serialised body names its own market; reflecting it in headers makes the
    fallback legible without parsing the payload, so a client that asked for a
    market, currency, or language the server cannot serve sees which one it
    really got.
    """
    if not body:
        return {}
    try:
        payload = json.loads(body.decode("utf-8"))
    except (ValueError, UnicodeDecodeError):
        return {}
    if not isinstance(payload, dict):
        return {}

    headers: dict[str, str] = {}

    country = payload.get("country_code")
    if not isinstance(country, str):
        code = payload.get("code")
        if isinstance(code, str) and _COUNTRY_CODE_PATTERN.fullmatch(code):
            country = code
    if isinstance(country, str):
        headers["content-country"] = country

    currency = payload.get("currency")
    if isinstance(currency, str):
        headers["content-currency"] = currency

    locale = payload.get("locale") or payload.get("default_locale")
    if isinstance(locale, str) and locale:
        headers["content-language"] = locale.split("-")[0]
    return headers


def _etag_matches(if_none_match: str | None, etag: str) -> bool:
    if not if_none_match:
        return False
    for part in if_none_match.split(","):
        candidate = part.strip().lstrip("W/")
        if candidate in ("*", etag):
            return True
    return False
