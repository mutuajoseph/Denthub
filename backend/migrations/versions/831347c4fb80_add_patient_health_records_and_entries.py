"""add patient health records and entries

The Patient-owned Health Record (#84): one ``patient_health_records`` row per
Patient holding the record-level facts (maternal status), and append-only
``health_record_entries`` holding medical history, dental history, prescriptions,
and allergies. Each entry snapshots its author's kind (patient vs clinician) so
the author badge and the audit trail survive a later change to that account's
role. Deleting a Patient takes their record and its entries with them (CASCADE);
an author with entries is not silently deleted (RESTRICT).

Revision ID: 831347c4fb80
Revises: ca4764913970
Create Date: 2026-10-18 13:06:59.469578

"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "831347c4fb80"
down_revision: Union[str, Sequence[str], None] = "ca4764913970"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create the record and entry tables with their indexes and constraints."""
    op.create_table(
        "patient_health_records",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("patient_id", sa.String(length=36), nullable=False),
        sa.Column(
            "maternal_status",
            sa.Enum(
                "none",
                "pregnant",
                "lactating",
                name="maternal_status",
                native_enum=False,
                length=12,
            ),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(),
            server_default=sa.text("(CURRENT_TIMESTAMP)"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            server_default=sa.text("(CURRENT_TIMESTAMP)"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["patient_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_patient_health_records_patient_id"),
        "patient_health_records",
        ["patient_id"],
        unique=True,
    )
    op.create_table(
        "health_record_entries",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("record_id", sa.String(length=36), nullable=False),
        sa.Column(
            "category",
            sa.Enum(
                "medical_history",
                "dental_history",
                "prescription",
                "allergy",
                name="health_record_entry_category",
                native_enum=False,
                length=20,
            ),
            nullable=False,
        ),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("author_id", sa.String(length=36), nullable=False),
        sa.Column(
            "author_kind",
            sa.Enum(
                "patient",
                "clinician",
                name="health_record_author_kind",
                native_enum=False,
                length=10,
            ),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(),
            server_default=sa.text("(CURRENT_TIMESTAMP)"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["author_id"], ["users.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["record_id"], ["patient_health_records.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_health_record_entries_author_id"),
        "health_record_entries",
        ["author_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_health_record_entries_category"),
        "health_record_entries",
        ["category"],
        unique=False,
    )
    op.create_index(
        op.f("ix_health_record_entries_record_id"),
        "health_record_entries",
        ["record_id"],
        unique=False,
    )


def downgrade() -> None:
    """Drop the entry table, then the record table."""
    op.drop_index(op.f("ix_health_record_entries_record_id"), table_name="health_record_entries")
    op.drop_index(op.f("ix_health_record_entries_category"), table_name="health_record_entries")
    op.drop_index(op.f("ix_health_record_entries_author_id"), table_name="health_record_entries")
    op.drop_table("health_record_entries")
    op.drop_index(op.f("ix_patient_health_records_patient_id"), table_name="patient_health_records")
    op.drop_table("patient_health_records")
