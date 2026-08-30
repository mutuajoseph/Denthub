"""Strongly-typed application state.

``AppState`` is the typed container for app-level singletons. Using a
``@dataclass`` (rather than stringly-typed ``request.app.state`` access) gives
autocomplete and catches typos at type-check time. Grows one field per
singleton as the app gains a database, external clients, etc.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING

from structlog.typing import FilteringBoundLogger

from app.config import Settings

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker


@dataclass
class AppState:
    settings: Settings
    logger: FilteringBoundLogger
    db_session_maker: async_sessionmaker[AsyncSession]
