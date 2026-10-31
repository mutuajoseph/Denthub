"""Application configuration — constants and environment-derived settings.

Settings are read once, up front, and passed explicitly into the app (via the
lifespan). Nothing reaches for ``os.environ`` deep in the call stack.
"""

from __future__ import annotations

import os
from dataclasses import dataclass

APP_NAME = "DentistHub"
API_V1_PREFIX = "/api/v1"

# Public-source fallback for local development only. Production must supply a
# real JWT_SECRET_KEY; this literal must never sign a production token.
DEV_JWT_SECRET_KEY = "denthub-super-secret-dev-key-change-in-prod"

#: Provisional clinical retention window (about seven years) for
#: clinician-authored Health Record entries after an account is deleted (#128).
#: Confirm against the applicable jurisdiction before relying on it.
DEFAULT_CLINICAL_RETENTION_DAYS = 2555


@dataclass(frozen=True)
class Settings:
    """Immutable, typed view of the runtime environment."""

    app_name: str
    environment: str
    dev_mode: bool
    log_level: str
    cors_origins: tuple[str, ...]
    database_url: str
    jwt_secret_key: str
    jwt_algorithm: str
    #: How long clinician-authored Health Record entries are kept after an
    #: account is deleted (#128). Provisional default; see ``docs/RELEASE.md``.
    clinical_retention_days: int = DEFAULT_CLINICAL_RETENTION_DAYS

    @classmethod
    def from_env(cls) -> Settings:
        environment = os.getenv("ENVIRONMENT", "local")

        cors_origins_env = os.getenv("CORS_ORIGINS")
        if environment == "production" and not cors_origins_env:
            raise RuntimeError(
                "CORS_ORIGINS must be set to the allowed frontend origin(s) in production; "
                "refusing to start with a localhost-only default."
            )

        origins = cors_origins_env or "http://localhost:5173"

        database_url = os.getenv(
            "DATABASE_URL",
            "sqlite+aiosqlite:///denthub.db",
        )

        # Ensure PostgreSQL uses SQLAlchemy's async driver.
        if database_url.startswith("postgres://"):
            database_url = database_url.replace(
                "postgres://",
                "postgresql+asyncpg://",
                1,
            )
        elif database_url.startswith("postgresql://"):
            database_url = database_url.replace(
                "postgresql://",
                "postgresql+asyncpg://",
                1,
            )

        jwt_secret_key = os.getenv("JWT_SECRET_KEY", DEV_JWT_SECRET_KEY)

        # Refuse to start production on the public dev default (root AGENTS.md,
        # "Auth and security"): a leaked secret lets anyone mint valid tokens.
        if environment == "production" and jwt_secret_key == DEV_JWT_SECRET_KEY:
            raise RuntimeError(
                "JWT_SECRET_KEY must be set to a real secret in production; "
                "refusing to start with the development default. Set it in the "
                "Render dashboard (render.yaml marks it sync: false)."
            )

        retention_raw = os.getenv("CLINICAL_RETENTION_DAYS", str(DEFAULT_CLINICAL_RETENTION_DAYS))
        try:
            clinical_retention_days = int(retention_raw)
        except ValueError as exc:
            raise RuntimeError(
                "CLINICAL_RETENTION_DAYS must be a positive integer number of days."
            ) from exc
        if clinical_retention_days <= 0:
            raise RuntimeError("CLINICAL_RETENTION_DAYS must be a positive integer number of days.")

        return cls(
            app_name=APP_NAME,
            environment=environment,
            dev_mode=os.getenv("DEV_MODE", "1") == "1",
            log_level=os.getenv("LOG_LEVEL", "INFO"),
            cors_origins=tuple(origin.strip() for origin in origins.split(",") if origin.strip()),
            database_url=database_url,
            jwt_secret_key=jwt_secret_key,
            jwt_algorithm=os.getenv("JWT_ALGORITHM", "HS256"),
            clinical_retention_days=clinical_retention_days,
        )
