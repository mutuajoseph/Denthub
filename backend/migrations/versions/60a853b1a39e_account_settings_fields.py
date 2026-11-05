"""account settings fields

Revision ID: 60a853b1a39e
Revises: e85d22bf80a9
Create Date: 2026-11-03 13:56:59.957716

Adds the columns account settings needs (#119): a User's chosen home Country,
and the free-text bio and avatar key on a Specialist listing. All three are
nullable, so the expand step is safe for the code already running.
"""
from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '60a853b1a39e'
down_revision: Union[str, Sequence[str], None] = 'e894c55b6cd9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    with op.batch_alter_table('users') as batch_op:
        batch_op.add_column(sa.Column('home_country_code', sa.String(length=2), nullable=True))
        batch_op.create_foreign_key(
            'fk_users_home_country_code', 'countries', ['home_country_code'], ['code'],
            ondelete='SET NULL',
        )
        batch_op.create_index(
            op.f('ix_users_home_country_code'), ['home_country_code'], unique=False
        )

    with op.batch_alter_table('specialists') as batch_op:
        batch_op.add_column(sa.Column('bio', sa.Text(), nullable=True))
        batch_op.add_column(sa.Column('avatar_key', sa.String(length=255), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table('specialists') as batch_op:
        batch_op.drop_column('avatar_key')
        batch_op.drop_column('bio')

    with op.batch_alter_table('users') as batch_op:
        batch_op.drop_index(op.f('ix_users_home_country_code'))
        batch_op.drop_constraint('fk_users_home_country_code', type_='foreignkey')
        batch_op.drop_column('home_country_code')
