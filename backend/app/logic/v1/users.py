"""User administration logic — business rules for staff-managed user actions."""

from __future__ import annotations

from app.exceptions import ForbiddenException, NotFoundException
from app.logic.v1.auth import (
    ADMIN_ROLES,
    UserResponse,
    get_user_from_token,
    is_staff_role,
)
from app.repositories.user import UserRepository
from app.utils.state import AppState


async def approve_user(
    state: AppState,
    *,
    token: str,
    user_id: str,
) -> UserResponse:
    """Set a pending user account to active.

    Only admins and super-admins (``ADMIN_ROLES``) may approve. The pending
    state is informational today — a pending professional can still browse
    public modules — but an approval is what future gated routes will check
    first, so the flip itself carries the authorisation check.
    """
    actor = await get_user_from_token(state, token)

    if actor.role not in ADMIN_ROLES:
        raise ForbiddenException(message="Only admins may approve user accounts")

    if not actor.is_active:
        raise ForbiddenException(message="User account is deactivated")

    async with state.db_session_maker() as session:
        user = await UserRepository.get_by_id(
            session,
            user_id,
        )

        if not user:
            raise NotFoundException(message="User not found")

        user.account_status = "active"
        await session.commit()

        return UserResponse(
            id=user.id,
            email=user.email,
            role=user.role,
            full_name=user.full_name,
            is_staff=is_staff_role(user.role),
            account_status="active",
        )
