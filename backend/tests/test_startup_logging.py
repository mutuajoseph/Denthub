"""The startup log must never emit the raw database URL.

Root AGENTS.md, "Auth and security": "Log connection strings and tokens only in
redacted form." A production DATABASE_URL embeds the Postgres password.
"""

from __future__ import annotations

import pytest

import app.main as main_module

SECRET_URL = "postgresql+asyncpg://denthub:hunter2@db.internal:5432/denthub"


class _RecordingLogger:
    """Minimal stand-in for the structlog logger, capturing every event."""

    def __init__(self) -> None:
        self.events: list[tuple[str, dict[str, object]]] = []

    def info(self, event: str, **kwargs: object) -> None:
        self.events.append((event, kwargs))

    def warning(self, event: str, **kwargs: object) -> None:
        self.events.append((event, kwargs))


async def test_db_init_log_redacts_password(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("DATABASE_URL", SECRET_URL)
    logger = _RecordingLogger()
    monkeypatch.setattr(main_module, "configure_logging", lambda **_: logger)

    app = main_module.create_app()
    async with app.router.lifespan_context(app):
        pass

    db_init = [kwargs for event, kwargs in logger.events if event == "db.init"]
    assert db_init, "expected a db.init log line"

    url = str(db_init[0]["url"])
    assert "hunter2" not in url
    assert "db.internal" in url
    assert "***" in url
