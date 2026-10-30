"""add facilities listed

Revision ID: 09ac3f801860
Revises: a03c4a379430
Create Date: 2026-10-29 13:50:17.985580

Whether the directory shows a Facility (#118). Every existing Facility stays
listed through the server default, so the running code keeps seeing them all;
only a Facility created at signup starts unlisted, until staff approve its
owner.
"""
from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '09ac3f801860'
down_revision: Union[str, Sequence[str], None] = 'a03c4a379430'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(
        'facilities',
        sa.Column('listed', sa.Boolean(), server_default=sa.true(), nullable=False),
    )


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table('facilities') as batch_op:
        batch_op.drop_column('listed')
