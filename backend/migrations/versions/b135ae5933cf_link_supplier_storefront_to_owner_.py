"""link supplier storefront to owner account

Revision ID: b135ae5933cf
Revises: 831347c4fb80
Create Date: 2026-10-15 17:37:52.043323

Adds ``suppliers.owner_user_id`` so a supplier account owns exactly one
storefront (one account, one store: the unique index), with ``SET NULL`` if
the account goes away.

Both operations run inside ``batch_alter_table``: SQLite cannot ALTER a
foreign key into an existing table, and batch mode's copy-and-move rebuild is
its supported answer. On Postgres batch mode emits the ordinary ALTERs.
"""
from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "b135ae5933cf"
down_revision: Union[str, Sequence[str], None] = "831347c4fb80"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    with op.batch_alter_table("suppliers") as batch_op:
        batch_op.add_column(
            sa.Column(
                "owner_user_id",
                sa.String(length=36),
                sa.ForeignKey(
                    "users.id",
                    ondelete="SET NULL",
                    name="fk_suppliers_owner_user_id",
                ),
                nullable=True,
            )
        )
        batch_op.create_index("uq_suppliers_owner_user_id", ["owner_user_id"], unique=True)


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table("suppliers") as batch_op:
        # Index first: a column that is still indexed cannot be dropped.
        batch_op.drop_index("uq_suppliers_owner_user_id")
        batch_op.drop_column("owner_user_id")
