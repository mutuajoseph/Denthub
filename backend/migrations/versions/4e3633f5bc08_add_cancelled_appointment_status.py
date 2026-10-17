"""add cancelled appointment status

Revision ID: 4e3633f5bc08
Revises: 8dc7a83560b6
Create Date: 2026-10-17 13:09:40.089382
"""

from __future__ import annotations

from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "4e3633f5bc08"
down_revision: Union[str, Sequence[str], None] = "8dc7a83560b6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

#: The five states, matching ``AppointmentStatus`` in the repository. Spelled
#: out rather than imported: a migration is a frozen snapshot of the schema at
#: this revision, and the model's constants move on without it.
_STATUS_CHECK = "status IN ('PENDING', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED')"


def upgrade() -> None:
    """Add CANCELLED to the Appointment status and enforce the enum.

    The column is a non-native enum stored as ``VARCHAR(12)``, so the original
    table carried no check. ``CANCELLED`` fits the length, but a value is only
    *valid* once the constraint names it — so the constraint is added here, on
    the existing table, rather than the column being retyped.
    """
    with op.batch_alter_table("appointments") as batch_op:
        batch_op.create_check_constraint("appointment_status", _STATUS_CHECK)


def downgrade() -> None:
    """Drop the constraint: the table before this revision had none."""
    with op.batch_alter_table("appointments") as batch_op:
        batch_op.drop_constraint("appointment_status", type_="check")
