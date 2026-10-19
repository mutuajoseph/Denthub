"""add operator division and tier to users

The operations console (#83) scopes a Platform Operator to one Division at a
Lead or Assistant tier (PRD §2, ``CONTEXT.md`` "Operator"). Both columns are
nullable: every non-operator keeps them null, and the console reads them fresh
per request so granting or revoking a Division takes effect at once.

Revision ID: 4b75c2480490
Revises: b0dc62f31298
Create Date: 2026-10-19 21:18:13.443234

"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "4b75c2480490"
down_revision: Union[str, Sequence[str], None] = "b0dc62f31298"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add the Operator Division and tier to users."""
    op.add_column(
        "users",
        sa.Column(
            "operator_division",
            sa.Enum(
                "jobs",
                "shop",
                "training",
                "dentist",
                "international",
                "suppliers",
                name="operator_division",
                native_enum=False,
                length=20,
            ),
            nullable=True,
        ),
    )
    op.add_column(
        "users",
        sa.Column(
            "operator_tier",
            sa.Enum(
                "lead",
                "assistant",
                name="operator_tier",
                native_enum=False,
                length=20,
            ),
            nullable=True,
        ),
    )


def downgrade() -> None:
    """Drop the Operator Division and tier."""
    op.drop_column("users", "operator_tier")
    op.drop_column("users", "operator_division")
