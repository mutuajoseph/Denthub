"""Application entrypoint: lifespan-managed startup and app assembly.

Following the Faro pattern, there is no module-level app state. The app is built
by ``create_app()`` and all heavy initialization (logging, typed ``AppState``)
happens inside the ``lifespan`` context manager, so the app is fully testable —
a test can construct its own state without touching globals.
"""

from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import API_V1_PREFIX, Settings
from app.exceptions import register_exception_handlers
from app.middleware.logging import RequestLoggingMiddleware
from app.routes.v1 import v1_router
from app.utils.logger import configure_logging
from app.utils.state import AppState


def create_app() -> FastAPI:
    settings = Settings.from_env()

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        logger = configure_logging(dev_mode=settings.dev_mode, log_level=settings.log_level)
        app.state.app_state = AppState(settings=settings, logger=logger)
        logger.info("app.startup", app=settings.app_name, environment=settings.environment)
        yield
        logger.info("app.shutdown", app=settings.app_name)

    app = FastAPI(title=f"{settings.app_name} API", version="0.1.0", lifespan=lifespan)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=list(settings.cors_origins),
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.add_middleware(RequestLoggingMiddleware)

    register_exception_handlers(app)
    app.include_router(v1_router, prefix=API_V1_PREFIX)
    return app


app = create_app()
