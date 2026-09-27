"""Tests for the seed script.

Two easy-to-reintroduce failures are pinned here: logging a production database
URL verbatim, and nesting `asyncio.run` inside a running event loop.
"""

from __future__ import annotations

import inspect

from app.scripts.seed_products import describe_url, main, seed_database

SECRET_URLS = [
    "postgresql+asyncpg://denthub:hunter2@db.internal:5432/denthub",
    "postgresql+asyncpg://user:p%40ssw0rd%21@db.internal:5432/denthub",
]


def test_password_is_masked() -> None:
    for url in SECRET_URLS:
        rendered = describe_url(url)

        assert "hunter2" not in rendered
        assert "p%40ssw0rd%21" not in rendered
        assert "***" in rendered


def test_host_and_database_are_preserved() -> None:
    """Masking must not make the line useless for debugging."""
    rendered = describe_url(SECRET_URLS[0])

    assert "db.internal" in rendered
    assert "denthub" in rendered
    assert "postgresql+asyncpg" in rendered


def test_url_without_password_is_unchanged() -> None:
    url = "sqlite+aiosqlite:///denthub.db"

    assert describe_url(url) == url


def test_main_is_not_a_coroutine_function() -> None:
    """`main()` must be sync so it can migrate before entering the event loop.

    `migrations/env.py` calls `asyncio.run()` internally. If the seed awaited
    from inside a coroutine entrypoint, `alembic upgrade` would raise
    "asyncio.run() cannot be called from a running event loop" and the
    documented `python -m app.scripts.seed_products` command would fail.
    """
    assert not inspect.iscoroutinefunction(main)


def test_seed_database_is_awaited_from_main() -> None:
    """The DB work is a coroutine, driven by a single `asyncio.run`."""
    assert inspect.iscoroutinefunction(seed_database)
