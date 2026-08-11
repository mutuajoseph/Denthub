"""Request/response structured logging middleware.

Binds a per-request ``request_id`` into the structlog contextvars so every log
line emitted while handling the request carries it, then logs a single
``request.handled`` line with method, status, and latency.
"""

from __future__ import annotations

import time
import uuid
from collections.abc import Awaitable, Callable

import structlog
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(
        self, request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        request_id = request.headers.get("x-request-id", str(uuid.uuid4()))
        structlog.contextvars.bind_contextvars(request_id=request_id, path=request.url.path)
        logger = structlog.get_logger()
        start = time.perf_counter()
        try:
            response = await call_next(request)
            elapsed_ms = round((time.perf_counter() - start) * 1000, 2)
            logger.info(
                "request.handled",
                method=request.method,
                status=response.status_code,
                elapsed_ms=elapsed_ms,
            )
            response.headers["x-request-id"] = request_id
            return response
        finally:
            structlog.contextvars.clear_contextvars()
