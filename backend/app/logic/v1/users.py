"""User administration logic — business rules for staff-managed user actions."""

from __future__ import annotations

from app.exceptions import NotFoundException
from app.logic.v1.audit import audit
from app.logic.v1.auth import UserResponse, is_staff_role
from app.repositories.user import User, UserRepository
from app.utils.state import AppState


async def approve_user(
    state: AppState,
    *,
    actor: User,
    user_id: str,
) -> UserResponse:
    """Set a pending user account to active.

    ``actor`` is an admin on the staff surface; the route's ``current_admin``
    dependency refuses everyone else, as on every ``/admin`` route (ADR-0004).
    The pending state is informational today — a pending professional can still browse
    public modules — but an approval is what future gated routes will check
    first, so the flip itself carries the authorisation check.
    """
    async with state.db_session_maker() as session:
        user = await UserRepository.get_by_id(
            session,
            user_id,
        )

        if not user:
            raise NotFoundException(message="User not found")

        before: dict[str, object] = {"account_status": user.account_status}
        user.account_status = "active"
        await audit(
            session,
            actor,
            action="user.approve",
            entity_type="user",
            entity_id=user.id,
            before=before,
            after={"account_status": user.account_status},
        )
        await session.commit()

        return UserResponse(
            id=user.id,
            email=user.email,
            role=user.role,
            full_name=user.full_name,
            is_staff=is_staff_role(user.role),
            account_status="active",
        )
