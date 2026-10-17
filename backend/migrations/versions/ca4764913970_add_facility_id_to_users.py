"""add facility_id to users

A facility-scoped account (owner, front office, facility dentist) is now bound
to one Facility through ``users.facility_id`` so the clinic dashboard and its
appointment workflow can be scoped to a single clinic (#81). The column is
nullable and SET NULL: a patient or an unlinked staff account keeps its row, and
losing a clinic does not delete its people.

Revision ID: ca4764913970
Revises: 8dc7a83560b6
Create Date: 2026-10-17 14:30:05.427459

"""
from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "ca4764913970"
down_revision: Union[str, Sequence[str], None] = "8dc7a83560b6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add the nullable, indexed facility_id column with its FK.

    ``batch_alter_table`` because SQLite has no ``ALTER TABLE ... ADD
    CONSTRAINT``; batch mode recreates the table there and emits plain ALTERs
    on Postgres.
    """
    with op.batch_alter_table("users") as batch_op:
        batch_op.add_column(sa.Column("facility_id", sa.String(length=36), nullable=True))
        batch_op.create_index("ix_users_facility_id", ["facility_id"], unique=False)
        batch_op.create_foreign_key(
            "fk_users_facility_id",
            "facilities",
            ["facility_id"],
            ["id"],
            ondelete="SET NULL",
        )


def downgrade() -> None:
    """Drop the facility_id column, its index, and its FK."""
    with op.batch_alter_table("users") as batch_op:
        batch_op.drop_constraint("fk_users_facility_id", type_="foreignkey")
        batch_op.drop_index("ix_users_facility_id")
        batch_op.drop_column("facility_id")
