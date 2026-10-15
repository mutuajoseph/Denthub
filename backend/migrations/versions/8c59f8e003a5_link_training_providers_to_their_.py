"""link training providers to their account and add CPD points

Revision ID: 8c59f8e003a5
Revises: b135ae5933cf
Create Date: 2026-10-15

Adds `training_providers.owner_user_id`, a nullable unique FK to `users`, so a
training-provider account owns exactly one provider (the dashboard creates it,
#79); staff can still seed unowned providers. Also adds `cpd_points` to
`training_courses` and `training_webinars` so a Course or webinar carries the
CPD credit it grants.

Both changes are additive and nullable/defaulted, so the pre-#79 code tolerates
the new schema during the deploy window. SQLite cannot add a constraint in
place, so the column and its index are added through `batch_alter_table`, which
copies the table; `cpd_points` therefore carries a server default to backfill
the rows that already exist.
"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "8c59f8e003a5"
down_revision: str | Sequence[str] | None = "b135ae5933cf"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    with op.batch_alter_table("training_providers") as batch_op:
        batch_op.add_column(
            sa.Column(
                "owner_user_id",
                sa.String(length=36),
                sa.ForeignKey(
                    "users.id",
                    ondelete="SET NULL",
                    name="fk_training_providers_owner_user_id",
                ),
                nullable=True,
            )
        )
        batch_op.create_index(
            "uq_training_providers_owner_user_id", ["owner_user_id"], unique=True
        )

    with op.batch_alter_table("training_courses") as batch_op:
        batch_op.add_column(
            sa.Column("cpd_points", sa.Integer(), nullable=False, server_default="0")
        )

    with op.batch_alter_table("training_webinars") as batch_op:
        batch_op.add_column(
            sa.Column("cpd_points", sa.Integer(), nullable=False, server_default="0")
        )


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table("training_webinars") as batch_op:
        batch_op.drop_column("cpd_points")

    with op.batch_alter_table("training_courses") as batch_op:
        batch_op.drop_column("cpd_points")

    with op.batch_alter_table("training_providers") as batch_op:
        batch_op.drop_index("uq_training_providers_owner_user_id")
        batch_op.drop_column("owner_user_id")
