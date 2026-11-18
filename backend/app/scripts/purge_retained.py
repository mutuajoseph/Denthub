"""Purge retained clinical data whose retention window has ended (#150).

uv run python -m app.scripts.purge_retained
"""

from __future__ import annotations

import asyncio

from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from structlog.typing import FilteringBoundLogger

from app.config import Settings
from app.logic.v1.purge import purge_expired_accounts
from app.utils.logger import configure_logging
from app.utils.state import AppState
from app.utils.urls import describe_url


async def purge_retained(settings: Settings, logger: FilteringBoundLogger) -> None:
    engine = create_async_engine(settings.database_url, echo=settings.dev_mode)
    state = AppState(
        settings=settings,
        logger=logger,
        db_session_maker=async_sessionmaker(bind=engine, expire_on_commit=False),
    )
    try:
        result = await purge_expired_accounts(state)
        logger.info(
            "purge.retained.done",
            expired_requests=result.expired_requests,
            purged_accounts=result.purged_accounts,
            purged_specialist_shells=result.purged_specialist_shells,
            purged_supplier_shells=result.purged_supplier_shells,
            purged_training_provider_shells=result.purged_training_provider_shells,
            url=describe_url(settings.database_url),
        )
    finally:
        await engine.dispose()


def main() -> None:
    settings = Settings.from_env()
    logger = configure_logging(dev_mode=settings.dev_mode, log_level=settings.log_level)
    asyncio.run(purge_retained(settings, logger))


if __name__ == "__main__":
    main()
