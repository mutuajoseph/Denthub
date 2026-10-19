"""Admin console persistence: the audit trail for staff-initiated writes.

Every action an Admin takes from ``/admin`` writes one row here before the
change is committed, in the same transaction. The row snapshots the actor's
email and role at the time of the action, so the trail stays readable after an
account is renamed, re-roled, or deleted: the foreign key is ``SET NULL`` and
the snapshot is what the console renders.

``before``/``after`` hold the small, JSON-serialisable slice of the entity that
changed (a tier, a flag, a status), not the whole row. That keeps the trail
about the decision rather than about every column that happened to be loaded.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any

from sqlalchemy import JSON, DateTime, ForeignKey, Integer, String, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Mapped, mapped_column

from app.repositories.database import Base


class AdminAuditLog(Base):
    """One staff-initiated write, with who did it, when, and what changed."""

    __tablename__ = "admin_audit_log"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    #: Null once the actor account is deleted; the snapshot below survives.
    actor_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    #: Who acted, as the console should show it even after a rename or deletion.
    actor_email: Mapped[str] = mapped_column(String(255), nullable=False)
    actor_role: Mapped[str] = mapped_column(String(50), nullable=False)

    #: A stable action key such as ``country.feature.update`` or
    #: ``verification.set``; the client maps it to a label.
    action: Mapped[str] = mapped_column(String(60), nullable=False, index=True)
    entity_type: Mapped[str] = mapped_column(String(40), nullable=False, index=True)
    entity_id: Mapped[str] = mapped_column(String(80), nullable=False, index=True)

    before: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    after: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), nullable=False, index=True
    )


class AdminAuditRepository:
    """Reads and writes for the admin audit trail."""

    @staticmethod
    async def record(
        session: AsyncSession,
        *,
        actor_id: str | None,
        actor_email: str,
        actor_role: str,
        action: str,
        entity_type: str,
        entity_id: str,
        before: dict[str, Any] | None,
        after: dict[str, Any] | None,
    ) -> AdminAuditLog:
        """Append one audit row; the caller commits with the change it records."""
        row = AdminAuditLog(
            actor_id=actor_id,
            actor_email=actor_email,
            actor_role=actor_role,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            before=before,
            after=after,
        )
        session.add(row)
        await session.flush()
        return row

    @staticmethod
    async def list_recent(session: AsyncSession, *, limit: int) -> list[AdminAuditLog]:
        """The newest audit rows first, stable across same-second writes."""
        stmt = (
            select(AdminAuditLog)
            .order_by(AdminAuditLog.created_at.desc(), AdminAuditLog.id.desc())
            .limit(limit)
        )
        result = await session.execute(stmt)
        return list(result.scalars().all())
