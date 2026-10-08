"""add account_status to users

Revision ID: c7225a91b61f
Revises: 76a06315c80e
Create Date: 2026-10-08 15:34:46.352781

"""
from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c7225a91b61f'
down_revision: Union[str, Sequence[str], None] = '76a06315c80e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Existing rows predate the review step and are all already approved, so
    # they backfill to "active" (server_default) before the column goes NOT NULL.
    op.add_column(
        'users',
        sa.Column(
            'account_status',
            sa.String(length=20),
            nullable=False,
            server_default='active',
        ),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('users', 'account_status')
