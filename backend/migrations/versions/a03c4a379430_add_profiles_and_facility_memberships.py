"""add profiles and facility memberships

Revision ID: a03c4a379430
Revises: 4b75c2480490
Create Date: 2026-10-28 21:40:11.000000

Expand step of ADR-0006 (#117): Profiles and Facility Memberships are added
beside ``users.role`` and ``users.facility_id``, which stay, so the code
already running keeps working against this schema. Every existing user is
backfilled from those two columns.
"""
from __future__ import annotations

import uuid
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a03c4a379430'
down_revision: Union[str, Sequence[str], None] = '4b75c2480490'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

#: users.role -> the Profile it implies (settled on #117).
PROFILE_FOR_ROLE = {
    "patient": "patient",
    "international_patient": "patient",
    "dentist": "specialist",
    "specialist": "specialist",
    "intern": "specialist",
    "facility_dentist": "specialist",
    "supplier": "supplier",
    "training_provider": "training_provider",
}

#: users.role -> the membership permission it implies, for a facility_id holder.
PERMISSION_FOR_ROLE = {
    "facility_owner": "owner",
    "front_office": "front_office",
    "facility_dentist": "clinical",
}


def upgrade() -> None:
    """Upgrade schema."""
    profiles = op.create_table('profiles',
    sa.Column('id', sa.String(length=36), nullable=False),
    sa.Column('user_id', sa.String(length=36), nullable=False),
    sa.Column('kind', sa.Enum('patient', 'specialist', 'supplier', 'training_provider', name='profile_kind', native_enum=False, length=20), nullable=False),
    sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('user_id', 'kind', name='uq_profiles_user_id_kind')
    )
    op.create_index(op.f('ix_profiles_user_id'), 'profiles', ['user_id'], unique=False)

    memberships = op.create_table('facility_memberships',
    sa.Column('id', sa.String(length=36), nullable=False),
    sa.Column('user_id', sa.String(length=36), nullable=False),
    sa.Column('facility_id', sa.String(length=36), nullable=False),
    sa.Column('owner', sa.Boolean(), nullable=False),
    sa.Column('front_office', sa.Boolean(), nullable=False),
    sa.Column('clinical', sa.Boolean(), nullable=False),
    sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
    sa.CheckConstraint('owner OR front_office OR clinical', name='ck_facility_memberships_has_permission'),
    sa.ForeignKeyConstraint(['facility_id'], ['facilities.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('user_id', 'facility_id', name='uq_facility_memberships_user_facility')
    )
    op.create_index(op.f('ix_facility_memberships_facility_id'), 'facility_memberships', ['facility_id'], unique=False)
    op.create_index(op.f('ix_facility_memberships_user_id'), 'facility_memberships', ['user_id'], unique=False)

    # Batch mode: SQLite has no ALTER TABLE ... ADD CONSTRAINT; Postgres gets
    # plain ALTERs. Nullable, so seeded listings (which nobody runs) are fine.
    with op.batch_alter_table('specialists') as batch_op:
        batch_op.add_column(sa.Column('user_id', sa.String(length=36), nullable=True))
        batch_op.create_unique_constraint('uq_specialists_user_id', ['user_id'])
        batch_op.create_foreign_key(
            'fk_specialists_user_id', 'users', ['user_id'], ['id'], ondelete='SET NULL'
        )

    _backfill(profiles, memberships)


def _backfill(profiles: sa.Table, memberships: sa.Table) -> None:
    """One Profile and at most one membership per existing user, from its role."""
    users = sa.table(
        'users',
        sa.column('id', sa.String),
        sa.column('role', sa.String),
        sa.column('facility_id', sa.String),
    )
    rows = op.get_bind().execute(sa.select(users.c.id, users.c.role, users.c.facility_id)).all()

    profile_rows = [
        {'id': str(uuid.uuid4()), 'user_id': user_id, 'kind': PROFILE_FOR_ROLE[role]}
        for user_id, role, _ in rows
        if role in PROFILE_FOR_ROLE
    ]
    membership_rows = [
        {
            'id': str(uuid.uuid4()),
            'user_id': user_id,
            'facility_id': facility_id,
            'owner': PERMISSION_FOR_ROLE[role] == 'owner',
            'front_office': PERMISSION_FOR_ROLE[role] == 'front_office',
            'clinical': PERMISSION_FOR_ROLE[role] == 'clinical',
        }
        for user_id, role, facility_id in rows
        if role in PERMISSION_FOR_ROLE and facility_id is not None
    ]

    if profile_rows:
        op.bulk_insert(profiles, profile_rows)
    if membership_rows:
        op.bulk_insert(memberships, membership_rows)


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table('specialists') as batch_op:
        batch_op.drop_constraint('fk_specialists_user_id', type_='foreignkey')
        batch_op.drop_constraint('uq_specialists_user_id', type_='unique')
        batch_op.drop_column('user_id')
    op.drop_index(op.f('ix_facility_memberships_user_id'), table_name='facility_memberships')
    op.drop_index(op.f('ix_facility_memberships_facility_id'), table_name='facility_memberships')
    op.drop_table('facility_memberships')
    op.drop_index(op.f('ix_profiles_user_id'), table_name='profiles')
    op.drop_table('profiles')
