"""One audit helper for staff writes.

Every Admin-console and Operations-console write records an audit row in the
same transaction as the change. The call is the same in each module, so it
lives here once: the actor's id, email and role are read from the ``User``
rather than repeated at every call site.

A write that changes nothing records nothing. The trail is about decisions,
so re-approving an already-active account or re-setting the same tier would
only add noise to the console's history.
"""

from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from app.repositories.admin import AdminAuditRepository
from app.repositories.user import User


async def audit(
    session: AsyncSession,
    actor: User,
    *,
    action: str,
    entity_type: str,
    entity_id: str,
    before: dict[str, object] | None,
    after: dict[str, object] | None,
) -> None:
    """Append the audit row for a staff write, unless ``before == after``."""
    if before == after:
        return

    await AdminAuditRepository.record(
        session,
        actor_id=actor.id,
        actor_email=actor.email,
        actor_role=actor.role,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        before=before,
        after=after,
    )
