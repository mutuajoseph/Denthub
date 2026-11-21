"""retire pending account status

Revision ID: b2c9e1a4d7f0
Revises: 6a921743ef9e
Create Date: 2026-11-20 11:00:00.000000

Verification applications replaced the old account_status='pending' review
state (#126). A pending professional who already has a subject gets a pending
application for it, so the awaiting-verification state survives; account_status
is then folded into active. A pending User with no subject has nothing a reviewer
can decide on, so they simply become active (unverified) and no placeholder
listing is invented for them.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import Any, Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b2c9e1a4d7f0'
down_revision: Union[str, Sequence[str], None] = '6a921743ef9e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

users = sa.table(
    'users',
    sa.column('id', sa.String),
    sa.column('email', sa.String),
    sa.column('role', sa.String),
    sa.column('account_status', sa.String),
)
specialists = sa.table(
    'specialists',
    sa.column('id', sa.String),
    sa.column('user_id', sa.String),
)
facilities = sa.table(
    'facilities',
    sa.column('id', sa.String),
)
memberships = sa.table(
    'facility_memberships',
    sa.column('user_id', sa.String),
    sa.column('facility_id', sa.String),
    sa.column('owner', sa.Boolean),
)
suppliers = sa.table(
    'suppliers',
    sa.column('id', sa.String),
    sa.column('owner_user_id', sa.String),
)
providers = sa.table(
    'training_providers',
    sa.column('id', sa.String),
    sa.column('owner_user_id', sa.String),
)
applications = sa.table(
    'verification_applications',
    sa.column('id', sa.String),
    sa.column('user_id', sa.String),
    sa.column('subject_kind', sa.String),
    sa.column('subject_id', sa.String),
    sa.column('applicant_email', sa.String),
    sa.column('licence_number', sa.String),
    sa.column('issuing_body', sa.String),
    sa.column('document_keys', sa.JSON),
    sa.column('status', sa.String),
    sa.column('created_at', sa.DateTime),
)

SUBJECT_BY_ROLE = {
    'dentist': 'specialist',
    'specialist': 'specialist',
    'intern': 'specialist',
    'facility_owner': 'facility',
    'supplier': 'supplier',
    'training_provider': 'training_provider',
}


def _subject_id(bind: Any, kind: str, user_id: str) -> str | None:
    if kind == 'specialist':
        stmt = sa.select(specialists.c.id).where(specialists.c.user_id == user_id).limit(1)
    elif kind == 'facility':
        stmt = (
            sa.select(facilities.c.id)
            .join(memberships, memberships.c.facility_id == facilities.c.id)
            .where(memberships.c.user_id == user_id, memberships.c.owner.is_(True))
            .limit(1)
        )
    elif kind == 'supplier':
        stmt = sa.select(suppliers.c.id).where(suppliers.c.owner_user_id == user_id).limit(1)
    else:
        stmt = sa.select(providers.c.id).where(providers.c.owner_user_id == user_id).limit(1)
    return bind.execute(stmt).scalar_one_or_none()


def upgrade() -> None:
    """Backfill pending applications for real subjects, then retire the status."""
    bind = op.get_bind()
    pending = (
        bind.execute(
            sa.select(
                users.c.id,
                users.c.email,
                users.c.role,
            ).where(users.c.account_status == 'pending')
        )
        .mappings()
        .all()
    )

    rows = []
    for user in pending:
        kind = SUBJECT_BY_ROLE.get(user['role'])
        if kind is None:
            continue
        subject_id = _subject_id(bind, kind, user['id'])
        if subject_id is None:
            continue
        already_pending = bind.execute(
            sa.select(applications.c.id).where(
                applications.c.user_id == user['id'],
                applications.c.subject_kind == kind,
                applications.c.subject_id == subject_id,
                applications.c.status == 'pending',
            )
        ).scalar_one_or_none()
        if already_pending is not None:
            continue
        rows.append(
            {
                'id': str(uuid.uuid4()),
                'user_id': user['id'],
                'subject_kind': kind,
                'subject_id': subject_id,
                'applicant_email': user['email'],
                'licence_number': 'Migrated from pending account status',
                'issuing_body': 'DentHub',
                'document_keys': [],
                'status': 'pending',
                'created_at': datetime.now(UTC).replace(tzinfo=None),
            }
        )

    if rows:
        op.bulk_insert(applications, rows)

    op.execute(
        sa.update(users)
        .where(users.c.account_status == 'pending')
        .values(account_status='active')
    )


def downgrade() -> None:
    """Forward-only: the old pending review state cannot be reconstructed."""
    return
