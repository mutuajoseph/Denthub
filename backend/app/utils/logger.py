"""structlog configuration.

Console renderer in dev (human-readable), JSON in every other environment
(machine-parseable). Configured once, from the lifespan.
"""

from __future__ import annotations

import logging

import structlog
from structlog.typing import FilteringBoundLogger, Processor


def configure_logging(*, dev_mode: bool, log_level: str) -> FilteringBoundLogger:
    level = getattr(logging, log_level.upper(), logging.INFO)
    logging.basicConfig(format="%(message)s", level=level)

    processors: list[Processor] = [
        structlog.contextvars.merge_contextvars,
        structlog.processors.add_log_level,
        structlog.processors.TimeStamper(fmt="iso"),
    ]
    processors.append(
        structlog.dev.ConsoleRenderer() if dev_mode else structlog.processors.JSONRenderer()
    )

    structlog.configure(
        processors=processors,
        wrapper_class=structlog.make_filtering_bound_logger(level),
        logger_factory=structlog.PrintLoggerFactory(),
        cache_logger_on_first_use=True,
    )
    return structlog.get_logger()
