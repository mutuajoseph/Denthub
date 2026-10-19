"""add admin audit log and specialist verification tier

The admin console (#82) needs two schema changes:

* ``specialists.verification_tier`` — the graded tier Facilities already carry,
  so an Admin can verify either kind of profile (``CONTEXT.md`` "Verification
  tier"). Existing rows backfill to ``unverified``.
* ``admin_audit_log`` — one row per staff-initiated write, snapshotting the
  actor so the trail survives a rename, re-role, or deletion.

Revision ID: b0dc62f31298
Revises: 4e3633f5bc08
Create Date: 2026-10-19 18:20:26.437774

"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "b0dc62f31298"
down_revision: Union[str, Sequence[str], None] = "4e3633f5bc08"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add the audit trail and the Specialist verification tier."""
    op.create_table(
        "admin_audit_log",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("actor_id", sa.String(length=36), nullable=True),
        sa.Column("actor_email", sa.String(length=255), nullable=False),
        sa.Column("actor_role", sa.String(length=50), nullable=False),
        sa.Column("action", sa.String(length=60), nullable=False),
        sa.Column("entity_type", sa.String(length=40), nullable=False),
        sa.Column("entity_id", sa.String(length=80), nullable=False),
        sa.Column("before", sa.JSON(), nullable=True),
        sa.Column("after", sa.JSON(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(),
            server_default=sa.text("(CURRENT_TIMESTAMP)"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["actor_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_admin_audit_log_action"), "admin_audit_log", ["action"], unique=False)
    op.create_index(
        op.f("ix_admin_audit_log_actor_id"), "admin_audit_log", ["actor_id"], unique=False
    )
    op.create_index(
        op.f("ix_admin_audit_log_created_at"), "admin_audit_log", ["created_at"], unique=False
    )
    op.create_index(
        op.f("ix_admin_audit_log_entity_id"), "admin_audit_log", ["entity_id"], unique=False
    )
    op.create_index(
        op.f("ix_admin_audit_log_entity_type"), "admin_audit_log", ["entity_type"], unique=False
    )

    # Existing Specialists predate the tier and were never checked, so they
    # backfill to "unverified" (the same default a new Facility gets). The
    # server default stays: it is also what a row inserted outside the ORM gets.
    op.add_column(
        "specialists",
        sa.Column(
            "verification_tier",
            sa.Enum(
                "unverified",
                "basic",
                "verified",
                "featured",
                name="verification_tier",
                native_enum=False,
                length=20,
            ),
            nullable=False,
            server_default="unverified",
        ),
    )


def downgrade() -> None:
    """Drop the verification tier and the audit trail."""
    op.drop_column("specialists", "verification_tier")

    op.drop_index(op.f("ix_admin_audit_log_entity_type"), table_name="admin_audit_log")
    op.drop_index(op.f("ix_admin_audit_log_entity_id"), table_name="admin_audit_log")
    op.drop_index(op.f("ix_admin_audit_log_created_at"), table_name="admin_audit_log")
    op.drop_index(op.f("ix_admin_audit_log_actor_id"), table_name="admin_audit_log")
    op.drop_index(op.f("ix_admin_audit_log_action"), table_name="admin_audit_log")
    op.drop_table("admin_audit_log")
