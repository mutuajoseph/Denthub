"""Account Deletion Requests (#128).

A Deletion Request is the audit row for erasing an account. Deletion currently
completes immediately (the User's identity is scrubbed in the same transaction),
but the row records when it was asked for, how long clinician-authored clinical
entries are retained, and when the erasure completed. Platform Staff can later
build the P5 queue on top of the same shape without re-modelling it.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Literal, get_args

from sqlalchemy import DateTime, ForeignKey, String, func
from sqlalchemy import Enum as SAEnum
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Mapped, mapped_column

from app.repositories.database import Base

#: The lifecycle of a Deletion Request. Completed is written now, in the same
#: transaction as the erasure; pending is reserved for the future staff queue.
DeletionStatus = Literal["pending", "completed"]
DELETION_STATUSES = get_args(DeletionStatus)


class DeletionRequest(Base):
    """One account erasure and the clinical-retention window it created."""

    __tablename__ = "deletion_requests"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )
    #: The User whose account was erased. The row is kept (anonymised) so this
    #: foreign key, and every appointment and clinical entry it anchors, stays
    #: intact. One request per account.
    user_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    status: Mapped[DeletionStatus] = mapped_column(
        SAEnum(
            *DELETION_STATUSES,
            name="deletion_status",
            native_enum=False,
            length=20,
        ),
        default="pending",
        nullable=False,
    )
    requested_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), nullable=False
    )
    #: Kept clinician-authored entries must not be retained longer than this.
    retention_until: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class DeletionRepository:
    """Persistence for Deletion Requests."""

    @staticmethod
    async def create(session: AsyncSession, **kwargs: Any) -> DeletionRequest:
        deletion = DeletionRequest(**kwargs)
        session.add(deletion)
        await session.flush()
        return deletion
