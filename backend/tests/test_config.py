"""Settings.from_env() must refuse to start production without a real secret.

Root AGENTS.md, "Auth and security": "Production refuses to start without them
rather than falling back to a dev default." The dev fallback secret is public
source, so a production boot that quietly uses it lets anyone mint tokens.
"""

from __future__ import annotations

import pytest

from app.config import DEV_JWT_SECRET_KEY, Settings


def _clear_secrets(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("JWT_SECRET_KEY", raising=False)
    monkeypatch.delenv("CORS_ORIGINS", raising=False)


def test_local_without_secret_uses_dev_default(monkeypatch: pytest.MonkeyPatch) -> None:
    """Local development still works out of the box."""
    _clear_secrets(monkeypatch)
    monkeypatch.setenv("ENVIRONMENT", "local")

    assert Settings.from_env().jwt_secret_key == DEV_JWT_SECRET_KEY


def test_production_without_secret_refuses_to_start(monkeypatch: pytest.MonkeyPatch) -> None:
    _clear_secrets(monkeypatch)
    monkeypatch.setenv("ENVIRONMENT", "production")
    monkeypatch.setenv("CORS_ORIGINS", "https://example.com")

    with pytest.raises(RuntimeError, match="JWT_SECRET_KEY"):
        Settings.from_env()


def test_production_with_dev_default_secret_refuses_to_start(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("ENVIRONMENT", "production")
    monkeypatch.setenv("CORS_ORIGINS", "https://example.com")
    monkeypatch.setenv("JWT_SECRET_KEY", DEV_JWT_SECRET_KEY)

    with pytest.raises(RuntimeError, match="JWT_SECRET_KEY"):
        Settings.from_env()


def test_production_with_real_secret_starts(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("ENVIRONMENT", "production")
    monkeypatch.setenv("CORS_ORIGINS", "https://example.com")
    monkeypatch.setenv("JWT_SECRET_KEY", "a-real-secret-from-the-dashboard")

    assert Settings.from_env().jwt_secret_key == "a-real-secret-from-the-dashboard"


def test_production_without_cors_refuses_to_start(monkeypatch: pytest.MonkeyPatch) -> None:
    """Production must have an explicit CORS_ORIGINS value."""
    _clear_secrets(monkeypatch)
    monkeypatch.setenv("ENVIRONMENT", "production")
    monkeypatch.setenv("JWT_SECRET_KEY", "a-real-secret-from-the-dashboard")

    with pytest.raises(RuntimeError, match="CORS_ORIGINS"):
        Settings.from_env()
