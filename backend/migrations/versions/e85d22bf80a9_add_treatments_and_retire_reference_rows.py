"""add treatments and retire reference rows

Revision ID: e85d22bf80a9
Revises: a03c4a379430
Create Date: 2026-11-03 13:09:31.316201

Reference data gets a platform-wide treatment list and a soft-delete flag on
the existing per-Subdivision, per-Specialty, and per-Country-insurer rows
(issue #127). Retiring a row rather than deleting it keeps every listing,
Course, and Service that already names it readable.

Additive only: every new column is NOT NULL with a server default of true, so
the old code keeps running against this schema during the deploy window.
"""
from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e85d22bf80a9'
down_revision: Union[str, Sequence[str], None] = 'a03c4a379430'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table('treatments',
    sa.Column('id', sa.String(length=36), nullable=False),
    sa.Column('code', sa.String(length=50), nullable=False),
    sa.Column('name', sa.String(length=100), nullable=False),
    sa.Column('description', sa.Text(), nullable=True),
    sa.Column('display_order', sa.Integer(), nullable=False),
    sa.Column('is_active', sa.Boolean(), server_default=sa.true(), nullable=False),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_treatments_code'), 'treatments', ['code'], unique=True)
    op.add_column(
        'insurance_providers',
        sa.Column('is_active', sa.Boolean(), server_default=sa.true(), nullable=False),
    )
    op.add_column(
        'specialties',
        sa.Column('is_active', sa.Boolean(), server_default=sa.true(), nullable=False),
    )
    op.add_column(
        'subdivisions',
        sa.Column('is_active', sa.Boolean(), server_default=sa.true(), nullable=False),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('subdivisions', 'is_active')
    op.drop_column('specialties', 'is_active')
    op.drop_column('insurance_providers', 'is_active')
    op.drop_index(op.f('ix_treatments_code'), table_name='treatments')
    op.drop_table('treatments')
