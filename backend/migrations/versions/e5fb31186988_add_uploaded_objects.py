"""add uploaded objects

Revision ID: e5fb31186988
Revises: 09ac3f801860
Create Date: 2026-11-19 17:35:26.978826

The object keys ``POST /uploads`` issues (#123). No existing rows need a
backfill: only a newly issued key can be attached to a Listing.
"""

from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e5fb31186988'
down_revision: Union[str, Sequence[str], None] = '09ac3f801860'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create the issued-key table."""
    op.create_table(
        'uploaded_objects',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('object_key', sa.String(length=255), nullable=False),
        sa.Column('user_id', sa.String(length=36), nullable=False),
        sa.Column('purpose', sa.String(length=30), nullable=False),
        sa.Column('bucket', sa.String(length=50), nullable=False),
        sa.Column(
            'created_at',
            sa.DateTime(),
            server_default=sa.text('(CURRENT_TIMESTAMP)'),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(
        op.f('ix_uploaded_objects_object_key'), 'uploaded_objects', ['object_key'], unique=True
    )
    op.create_index(
        op.f('ix_uploaded_objects_user_id'), 'uploaded_objects', ['user_id'], unique=False
    )


def downgrade() -> None:
    """Drop the issued-key table."""
    op.drop_index(op.f('ix_uploaded_objects_user_id'), table_name='uploaded_objects')
    op.drop_index(op.f('ix_uploaded_objects_object_key'), table_name='uploaded_objects')
    op.drop_table('uploaded_objects')
