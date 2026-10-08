"""Money helpers shared by every logic module.

Money is ``Decimal`` in Python and ``NUMERIC(12,2)`` in the database (root
``AGENTS.md``). Quantising at the logic boundary is what keeps float noise out
of the JSON, so the value a test asserts is the value a client receives.
"""

from __future__ import annotations

from decimal import ROUND_HALF_UP, Decimal

_CENT = Decimal("0.01")


def quantize_money(value: Decimal) -> Decimal:
    """Round a money amount to 2 decimal places, half-up."""
    return value.quantize(_CENT, rounding=ROUND_HALF_UP)
