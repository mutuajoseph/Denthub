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
    #: Where emailed links point: the client's origin, no trailing slash.
    frontend_url: str
    #: The From header on every email, e.g. ``DentHub <no-reply@example.com>``.
    mail_from: str
    #: Resend API key; unset means the console mailer (local and tests only).
    resend_api_key: str | None

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

        resend_api_key = os.getenv("RESEND_API_KEY") or None
        mail_from = os.getenv("MAIL_FROM")
        frontend_url = os.getenv("FRONTEND_URL")

        # Production must really send mail (#120): without a provider key,
        # signup and password reset would silently email nobody.
        if environment == "production":
            missing = [
                name
                for name, value in (
                    ("RESEND_API_KEY", resend_api_key),
                    ("MAIL_FROM", mail_from),
                    ("FRONTEND_URL", frontend_url),
                )
                if not value
            ]
            if missing:
                raise RuntimeError(
                    f"{', '.join(missing)} must be set in production; refusing to start "
                    "without a mail provider. Set them in the Render dashboard "
                    "(render.yaml marks them sync: false)."
                )

        return cls(
            app_name=APP_NAME,
            environment=environment,
            dev_mode=os.getenv("DEV_MODE", "1") == "1",
            log_level=os.getenv("LOG_LEVEL", "INFO"),
            cors_origins=tuple(origin.strip() for origin in origins.split(",") if origin.strip()),
            database_url=database_url,
            jwt_secret_key=jwt_secret_key,
            jwt_algorithm=os.getenv("JWT_ALGORITHM", "HS256"),
            frontend_url=(frontend_url or "http://localhost:5173").rstrip("/"),
            mail_from=mail_from or "DentHub <no-reply@localhost>",
            resend_api_key=resend_api_key,
        )
