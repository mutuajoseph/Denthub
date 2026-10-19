"""The app migrates its own database at startup in production (#110).

Render's free plan ignores ``preDeployCommand``, and the service's start command
is not guaranteed to carry the seed prefix, so production started serving code
that expected ``specialists.verification_tier`` against a database without it.
The lifespan now runs ``alembic upgrade head`` before the app accepts traffic,
which makes "schema before code" an invariant of the process rather than of a
provider setting. Local and test runs must not touch migrations.
"""

from __future__ import annotations

import pytest

import app.main as main_module
from app.config import Settings
from app.main import create_app


def _settings(environment: str) -> Settings:
    return Settings(
        app_name="DentHub",
        environment=environment,
        dev_mode=False,
        log_level="INFO",
        cors_origins=("https://example.com",),
        database_url="sqlite+aiosqlite:///:memory:",
        jwt_secret_key="test-secret",
        jwt_algorithm="HS256",
    )


@pytest.mark.parametrize("environment", ["production"])
async def test_production_startup_runs_migrations(
    monkeypatch: pytest.MonkeyPatch,
    environment: str,
) -> None:
    calls: list[str] = []
    monkeypatch.setattr(main_module, "run_migrations", lambda: calls.append("migrate"))

    app = create_app(_settings(environment))

    async with app.router.lifespan_context(app):
        pass

    assert calls == ["migrate"]


@pytest.mark.parametrize("environment", ["local", "test"])
async def test_other_environments_do_not_migrate(
    monkeypatch: pytest.MonkeyPatch,
    environment: str,
) -> None:
    calls: list[str] = []
    monkeypatch.setattr(main_module, "run_migrations", lambda: calls.append("migrate"))

    app = create_app(_settings(environment))

    async with app.router.lifespan_context(app):
        pass

    assert calls == []
