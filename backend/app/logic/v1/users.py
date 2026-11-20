"""User administration logic — business rules for staff-managed user actions."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.exceptions import InvalidRequestError, NotFoundException
from app.logic.v1.audit import audit
from app.logic.v1.auth import UserResponse, is_staff_role, user_response
from app.repositories.listing import FacilityRepository
from app.repositories.profile import ProfileRepository
from app.repositories.refresh_token import RefreshTokenRepository
from app.repositories.user import User, UserRepository
from app.utils.state import AppState


class AdminUser(UserResponse):
    """One User as the admin console reads it, including the suspension lever."""

    is_active: bool


class AdminUserList(BaseModel):
    """A page of Users for the admin search."""

    items: list[AdminUser]


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

    Approving a Facility owner also lists the Facilities they own that signup
    left unlisted (#118), so the Facility reaches the directory only once staff
    have looked at its owner.
    """
    async with state.db_session_maker() as session:
        user = await UserRepository.get_by_id(
            session,
            user_id,
        )

        if not user:
            raise NotFoundException(message="User not found")
        if user.account_status == "suspended":
            raise InvalidRequestError(
                message="A suspended User must be reactivated before approval"
            )

        before: dict[str, object] = {"account_status": user.account_status}
        user.account_status = "active"
        owned = await ProfileRepository.owned_facility_ids(session, user.id)
        unlisted = await FacilityRepository.list_unlisted(session, owned)
        for facility in unlisted:
            facility.listed = True

        after: dict[str, Any] = {"account_status": "active"}
        if unlisted:
            after["listed_facility_ids"] = [facility.id for facility in unlisted]
        await audit(
            session,
            actor,
            action="user.approve",
            entity_type="user",
            entity_id=user.id,
            before=before,
            after=after,
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


async def _admin_user(session: AsyncSession, user: User) -> AdminUser:
    response = await user_response(session, user)
    return AdminUser(**response.model_dump(), is_active=user.is_active)


async def list_admin_users(state: AppState, *, query: str | None, limit: int) -> AdminUserList:
    """Search Users, each with the Profiles and Memberships they hold (#125)."""
    async with state.db_session_maker() as session:
        users = await UserRepository.search(session, query=query, limit=limit)
        items = [await _admin_user(session, user) for user in users]
        return AdminUserList(items=items)


async def get_admin_user(state: AppState, *, user_id: str) -> AdminUser:
    """One User with the Profiles and Memberships they hold (#125)."""
    async with state.db_session_maker() as session:
        user = await UserRepository.get_by_id(session, user_id)
        if user is None:
            raise NotFoundException(message="User not found")
        return await _admin_user(session, user)


async def _apply_status(
    session: AsyncSession,
    actor: User,
    user: User,
    *,
    status: str,
    is_active: bool,
    action: str,
    before: dict[str, object],
) -> None:
    """One audited status flip, revoking sessions only when access is stopped."""
    user.account_status = status
    user.is_active = is_active
    if not is_active:
        await RefreshTokenRepository.revoke_all_for_user(
            session, user_id=user.id, now=datetime.now(UTC).replace(tzinfo=None)
        )
    await audit(
        session,
        actor,
        action=action,
        entity_type="user",
        entity_id=user.id,
        before=before,
        after={"account_status": status, "is_active": is_active},
    )
    await session.commit()


async def suspend_user(state: AppState, *, actor: User, user_id: str) -> AdminUser:
    """Stop a User: every session ends and neither login nor refresh works (#125)."""
    async with state.db_session_maker() as session:
        user = await UserRepository.get_by_id(session, user_id)
        if user is None:
            raise NotFoundException(message="User not found")
        if user.id == actor.id:
            raise InvalidRequestError(message="You cannot suspend your own account")
        if (
            user.role == "super_admin"
            and user.is_active
            and await UserRepository.active_super_admin_count(session) <= 1
        ):
            raise InvalidRequestError(message="The last active Super Admin cannot be suspended")

        before = {"account_status": user.account_status, "is_active": user.is_active}
        if user.account_status != "suspended" or user.is_active:
            await _apply_status(
                session,
                actor,
                user,
                status="suspended",
                is_active=False,
                action="user.suspend",
                before=before,
            )

        return await _admin_user(session, user)


async def reactivate_user(state: AppState, *, actor: User, user_id: str) -> AdminUser:
    """Restore a suspended User; they sign in again with a fresh session (#125)."""
    async with state.db_session_maker() as session:
        user = await UserRepository.get_by_id(session, user_id)
        if user is None:
            raise NotFoundException(message="User not found")

        before = {"account_status": user.account_status, "is_active": user.is_active}
        if user.account_status != "active" or not user.is_active:
            await _apply_status(
                session,
                actor,
                user,
                status="active",
                is_active=True,
                action="user.reactivate",
                before=before,
            )

        return await _admin_user(session, user)
