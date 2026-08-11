"""Exception hierarchy and global exception handlers.

Mirrors the Faro pattern: one ``OpenApiErrorResponse`` shape for every error, a
``BaseApiException`` root carrying its own HTTP code, and centralized handlers
registered in ``main.py`` — so route and logic layers stay free of try/except
noise and every error serializes identically.
"""

from __future__ import annotations

from fastapi import FastAPI
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from starlette.requests import Request


class OpenApiErrorResponse(BaseModel):
    """Standard error envelope: ``code``, ``message``, optional ``detail``."""

    code: int
    message: str
    detail: str | None = None


class BaseApiException(Exception):
    """Root of the API exception hierarchy. Subclasses override ``code``."""

    code: int = 500
    message: str = "Internal server error"

    def __init__(self, message: str | None = None, detail: str | None = None) -> None:
        if message is not None:
            self.message = message
        self.detail = detail
        super().__init__(self.message)

    def to_response(self) -> OpenApiErrorResponse:
        return OpenApiErrorResponse(code=self.code, message=self.message, detail=self.detail)


class NotFoundException(BaseApiException):
    code = 404
    message = "Not found"


class InvalidRequestError(BaseApiException):
    code = 400
    message = "Invalid request"


class ConflictError(BaseApiException):
    code = 409
    message = "Conflict"


def register_exception_handlers(app: FastAPI) -> None:
    """Register handlers in priority order: specific first, catch-all last."""

    @app.exception_handler(BaseApiException)
    async def _base_api_exception_handler(_request: Request, exc: BaseApiException) -> JSONResponse:
        return JSONResponse(status_code=exc.code, content=exc.to_response().model_dump())

    @app.exception_handler(Exception)
    async def _general_exception_handler(_request: Request, _exc: Exception) -> JSONResponse:
        body = OpenApiErrorResponse(code=500, message="Internal server error")
        return JSONResponse(status_code=500, content=body.model_dump())
