"""Strongly-typed application state.

``AppState`` is the typed container for app-level singletons. Using a
``@dataclass`` (rather than stringly-typed ``request.app.state`` access) gives
autocomplete and catches typos at type-check time. Grows one field per
singleton as the app gains a database, external clients, etc.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import TYPE_CHECKING

import structlog
from structlog.typing import FilteringBoundLogger

from app.config import Settings
from app.utils.mailer import ConsoleMailer, Mailer

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker


@dataclass
class AppState:
    settings: Settings
    logger: FilteringBoundLogger
    db_session_maker: async_sessionmaker[AsyncSession]
    #: The lifespan passes Resend when ``RESEND_API_KEY`` is set; seed scripts and
    #: tests, which send nothing real, get the console mailer.
    mailer: Mailer = field(default_factory=lambda: ConsoleMailer(logger=structlog.get_logger()))
