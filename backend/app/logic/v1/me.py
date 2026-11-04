"""Account settings: the signed-in User's own details and Profiles (#119).

This is the User-level settings surface (``docs/api-map.md``, "Acting as"):
``GET``/``PATCH /me`` and ``POST /me/profiles``. A User may hold several
Profiles at once (ADR-0006), so adding one never changes ``users.role`` or the
account status while clients still route on ``role``.
"""

from __future__ import annotations

from pydantic import BaseModel, Field

from app.exceptions import ConflictError, InvalidRequestError, UnauthorizedException
from app.logic.v1.auth import UserResponse, user_response
from app.repositories.country import CountryRepository
from app.repositories.profile import ProfileKind, ProfileRepository
from app.repositories.user import User, UserRepository
from app.utils.state import AppState


class MeUpdate(BaseModel):
    """The account fields a User may change; omitted fields stay unchanged."""

    full_name: str | None = Field(default=None, max_length=100)
    phone: str | None = Field(default=None, max_length=50)
    home_country_code: str | None = Field(default=None, max_length=2)


class ProfileCreate(BaseModel):
    """A Profile kind the User wants to add."""

    kind: ProfileKind


async def get_me(state: AppState, *, actor: User) -> UserResponse:
    """The caller's own account settings."""
    async with state.db_session_maker() as session:
        user = await UserRepository.get_by_id(session, actor.id)

        if user is None:
            raise UnauthorizedException(message="User not found")

        return await user_response(session, user)


async def update_me(state: AppState, *, actor: User, data: MeUpdate) -> UserResponse:
    """Apply a partial update to the caller's own account.

    An explicit ``null`` clears ``phone`` or ``home_country_code``; a supplied
    ``full_name`` may not be blank. A home Country must be one DentHub operates
    in and has not retired.
    """
    fields = data.model_dump(exclude_unset=True)

    async with state.db_session_maker() as session:
        user = await UserRepository.get_by_id(session, actor.id)

        if user is None:
            raise UnauthorizedException(message="User not found")

        if "full_name" in fields:
            name = (fields["full_name"] or "").strip()
            if not name:
                raise InvalidRequestError(message="Name cannot be empty")
            await UserRepository.update(user, full_name=name)

        if "phone" in fields:
            await UserRepository.update(user, phone=fields["phone"])

        if "home_country_code" in fields:
            code = fields["home_country_code"]
            if code is None:
                await UserRepository.update(user, home_country_code=None)
            else:
                country = await CountryRepository.get(session, code)
                if country is None or not country.is_active:
                    raise InvalidRequestError(message="Unknown or inactive home Country")
                await UserRepository.update(user, home_country_code=country.code)

        await session.commit()
        return await user_response(session, user)


async def add_profile(state: AppState, *, actor: User, data: ProfileCreate) -> UserResponse:
    """Add one Profile kind the caller does not already hold."""
    async with state.db_session_maker() as session:
        user = await UserRepository.get_by_id(session, actor.id)

        if user is None:
            raise UnauthorizedException(message="User not found")

        if await ProfileRepository.has_kind(session, user_id=user.id, kind=data.kind):
            raise ConflictError(message="This account already holds that Profile")

        await ProfileRepository.add(session, user_id=user.id, kind=data.kind)
        await session.commit()
        return await user_response(session, user)
