"""add verification applications

Revision ID: 6a921743ef9e
Revises: 09ac3f801860
Create Date: 2026-11-20 11:15:30.079628

Applications are evidence and decisions, separate from the Verification tier
they can grant (#124). No existing rows need a backfill.
"""

from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '6a921743ef9e'
down_revision: Union[str, Sequence[str], None] = '09ac3f801860'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create the applications table."""
    op.create_table(
        'verification_applications',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('user_id', sa.String(length=36), nullable=False),
        sa.Column(
            'subject_kind',
            sa.Enum(
                'specialist',
                'facility',
                'supplier',
                'training_provider',
                name='verification_subject_kind',
                native_enum=False,
                length=20,
            ),
            nullable=False,
        ),
        sa.Column('subject_id', sa.String(length=36), nullable=False),
        sa.Column('applicant_email', sa.String(length=255), nullable=False),
        sa.Column('licence_number', sa.String(length=100), nullable=False),
        sa.Column('issuing_body', sa.String(length=200), nullable=False),
        sa.Column('document_keys', sa.JSON(), nullable=False),
        sa.Column(
            'status',
            sa.Enum(
                'pending',
                'verified',
                'rejected',
                'revoked',
                name='verification_status',
                native_enum=False,
                length=20,
            ),
            nullable=False,
        ),
        sa.Column('rejection_reason', sa.String(length=500), nullable=True),
        sa.Column('decided_by_user_id', sa.String(length=36), nullable=True),
        sa.Column('decided_at', sa.DateTime(), nullable=True),
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
        op.f('ix_verification_applications_status'),
        'verification_applications',
        ['status'],
        unique=False,
    )
    op.create_index(
        op.f('ix_verification_applications_subject_id'),
        'verification_applications',
        ['subject_id'],
        unique=False,
    )
    op.create_index(
        op.f('ix_verification_applications_user_id'),
        'verification_applications',
        ['user_id'],
        unique=False,
    )


def downgrade() -> None:
    """Drop the applications table."""
    op.drop_index(op.f('ix_verification_applications_user_id'), table_name='verification_applications')
    op.drop_index(
        op.f('ix_verification_applications_subject_id'), table_name='verification_applications'
    )
    op.drop_index(
        op.f('ix_verification_applications_status'), table_name='verification_applications'
    )
    op.drop_table('verification_applications')
