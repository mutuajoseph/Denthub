"""Stable codes derived from human names.

Reference-data rows carry a ``code`` alongside their display name because query
strings and client cache keys must not depend on a label that staff can edit.
When an admin creates a Subdivision by name alone, the server derives the same
code the seed script uses: uppercase, accents stripped, runs of other characters
collapsed to an underscore.
"""

from __future__ import annotations

import re
import unicodedata


def slug_code(value: str) -> str:
    """Return the stable upper-snake code for ``value``."""
    normalized = unicodedata.normalize("NFD", value)
    stripped = "".join(char for char in normalized if not unicodedata.combining(char))
    return re.sub(r"[^A-Za-z0-9]+", "_", stripped).strip("_").upper()
