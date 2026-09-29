"""Rendering helpers for values that reach a log sink."""

from __future__ import annotations


def describe_url(url: str) -> str:
    """Render a database URL with its password masked, for logging.

    A production ``DATABASE_URL`` embeds credentials, so it must never reach a log
    sink verbatim.
    """
    from sqlalchemy.engine import make_url

    parsed = make_url(url)

    if parsed.password is None:
        return parsed.render_as_string(hide_password=False)

    return parsed.render_as_string(hide_password=True)
