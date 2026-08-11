"""Application configuration — constants and environment-derived settings.

Settings are read once, up front, and passed explicitly into the app (via the
lifespan). Nothing reaches for ``os.environ`` deep in the call stack.
"""

from __future__ import annotations

import os
from dataclasses import dataclass

APP_NAME = "DentistHub"
API_V1_PREFIX = "/api/v1"


@dataclass(frozen=True)
class Settings:
    """Immutable, typed view of the runtime environment."""

    app_name: str
    environment: str
    dev_mode: bool
    log_level: str
    cors_origins: tuple[str, ...]

    @classmethod
    def from_env(cls) -> Settings:
        origins = os.getenv("CORS_ORIGINS", "http://localhost:5173")
        return cls(
            app_name=APP_NAME,
            environment=os.getenv("ENVIRONMENT", "local"),
            dev_mode=os.getenv("DEV_MODE", "1") == "1",
            log_level=os.getenv("LOG_LEVEL", "INFO"),
            cors_origins=tuple(o.strip() for o in origins.split(",") if o.strip()),
        )
