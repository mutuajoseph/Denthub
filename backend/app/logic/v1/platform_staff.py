"""Platform Staff management for the Super Admin (#122).

DentHub's own people — Admins, Super Admins, and Operators — are granted a role
by staff, never given one at signup (``CONTEXT.md`` "Platform Staff"). Only a
Super Admin may list, create, or change them. A staff member created here signs
in through the staff surface like any other, and every write is audited with the
before and after state so the console can answer who granted what.

A staff member's role and Operator scope are read fresh on every request, so a
demotion or a deactivation takes effect on their next call, not when their
token expires. The last active Super Admin cannot be demoted or deactivated:
the console must never be left with nobody able to manage Platform Staff.
"""

from __future__ import annotations

from typing import Literal, cast

from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator

from app.exceptions import ConflictError, InvalidRequestError, NotFoundException
from app.logic.v1.audit import audit
from app.logic.v1.auth import STAFF_SURFACE_ROLES, hash_password
from app.repositories.user import OperatorDivision, OperatorTier, User, UserRepository
from app.utils.state import AppState

#: The staff roles a Super Admin may grant. ``staff`` is deliberately absent:
#: it is a legacy facility role, not part of the staff surface (PRD §2).
PlatformStaffRole = Literal["admin", "super_admin", "platform_operator"]

#: The shortest and longest password the Pydantic boundary accepts. bcrypt
#: rejects anything over 72 bytes, so an over-long password is a 422, not a 500.
MIN_PASSWORD_LENGTH = 8
MAX_PASSWORD_BYTES = 72


class PlatformStaffMember(BaseModel):
    """One Platform Staff member as the console lists and edits it."""

    id: str
    full_name: str
    email: str
    role: PlatformStaffRole
    operator_division: OperatorDivision | None
    operator_tier: OperatorTier | None
    is_active: bool


class PlatformStaffList(BaseModel):
    items: list[PlatformStaffMember]


class CreatePlatformStaffRequest(BaseModel):
    """Grant a new User a staff role.

    An Operator carries exactly one Division and one tier. Any other role
    carries neither, because the scope only means something inside a Division.
    """

    full_name: str = Field(min_length=1, max_length=100)
    email: EmailStr
    password: str
    role: PlatformStaffRole
    operator_division: OperatorDivision | None = None
    operator_tier: OperatorTier | None = None

    @field_validator("password")
    @classmethod
    def _check_password_length(cls, value: str) -> str:
        if len(value) < MIN_PASSWORD_LENGTH:
            raise ValueError(f"Password must be at least {MIN_PASSWORD_LENGTH} characters")
        if len(value.encode("utf-8")) > MAX_PASSWORD_BYTES:
            raise ValueError(f"Password must be at most {MAX_PASSWORD_BYTES} bytes")
        return value

    @model_validator(mode="after")
    def _check_operator_scope(self) -> CreatePlatformStaffRequest:
        _validate_operator_scope(
            role=self.role,
            division=self.operator_division,
            tier=self.operator_tier,
        )
        return self


class UpdatePlatformStaffRequest(BaseModel):
    """Change a staff member's role, Operator scope, or active flag.

    Fields are optional so the console can send only what changed. The logic
    layer validates the resulting state: promoting someone to Operator needs a
    Division and a tier, and moving them off Operator clears both.
    """

    role: PlatformStaffRole | None = None
    operator_division: OperatorDivision | None = None
    operator_tier: OperatorTier | None = None
    is_active: bool | None = None


def _validate_operator_scope(
    *,
    role: PlatformStaffRole,
    division: OperatorDivision | None,
    tier: OperatorTier | None,
) -> None:
    """An Operator needs both halves of the scope; every other role needs neither."""
    if role == "platform_operator":
        if division is None or tier is None:
            raise ValueError("An Operator needs a Division and a tier")
        return

    if division is not None or tier is not None:
        raise ValueError("Only an Operator has a Division and a tier")


def _serialize(user: User) -> PlatformStaffMember:
    return PlatformStaffMember(
        id=user.id,
        full_name=user.full_name,
        email=user.email,
        role=cast(PlatformStaffRole, user.role),
        operator_division=user.operator_division,
        operator_tier=user.operator_tier,
        is_active=user.is_active,
    )


def _audit_state(user: User) -> dict[str, object]:
    """What a change to a staff member records: permission, not identity."""
    return {
        "role": user.role,
        "operator_division": user.operator_division,
        "operator_tier": user.operator_tier,
        "is_active": user.is_active,
    }


async def list_platform_staff(state: AppState) -> PlatformStaffList:
    """Every Platform Staff member, by name."""
    async with state.db_session_maker() as session:
        users = await UserRepository.list_platform_staff(session, roles=STAFF_SURFACE_ROLES)

    return PlatformStaffList(items=[_serialize(user) for user in users])


async def create_platform_staff(
    state: AppState,
    *,
    actor: User,
    request: CreatePlatformStaffRequest,
) -> PlatformStaffMember:
    """Create a User and grant them a staff role in the same write."""
    async with state.db_session_maker() as session:
        if await UserRepository.get_by_email(session, request.email) is not None:
            raise ConflictError(message="A User with that email already exists")

        is_operator = request.role == "platform_operator"
        user = await UserRepository.create(
            session,
            full_name=request.full_name,
            email=request.email,
            password_hash=hash_password(request.password),
            role=request.role,
            account_status="active",
            is_active=True,
            operator_division=request.operator_division if is_operator else None,
            operator_tier=request.operator_tier if is_operator else None,
        )

        after = {
            **_audit_state(user),
            "full_name": user.full_name,
            "email": user.email,
        }
        await audit(
            session,
            actor,
            action="staff.create",
            entity_type="staff",
            entity_id=user.id,
            before=None,
            after=after,
        )
        await session.commit()

        return _serialize(user)


async def update_platform_staff(
    state: AppState,
    *,
    actor: User,
    staff_id: str,
    request: UpdatePlatformStaffRequest,
) -> PlatformStaffMember:
    """Change a staff member's role, Operator scope, or active flag."""
    async with state.db_session_maker() as session:
        user = await UserRepository.get_by_id(session, staff_id)
        if user is None or user.role not in STAFF_SURFACE_ROLES:
            raise NotFoundException(message="Platform Staff member not found")

        fields = request.model_fields_set
        role = (
            request.role
            if "role" in fields and request.role is not None
            else cast(PlatformStaffRole, user.role)
        )
        touches_scope = bool(fields & {"role", "operator_division", "operator_tier"})

        if role == "platform_operator":
            division = (
                request.operator_division
                if "operator_division" in fields
                else user.operator_division
            )
            tier = request.operator_tier if "operator_tier" in fields else user.operator_tier
            if touches_scope:
                try:
                    _validate_operator_scope(role=role, division=division, tier=tier)
                except ValueError as exc:
                    raise InvalidRequestError(message=str(exc)) from exc
        else:
            supplied_division = request.operator_division if "operator_division" in fields else None
            supplied_tier = request.operator_tier if "operator_tier" in fields else None
            if supplied_division is not None or supplied_tier is not None:
                raise InvalidRequestError(message="Only an Operator has a Division and a tier")
            division = None
            tier = None

        is_active = (
            request.is_active
            if "is_active" in fields and request.is_active is not None
            else user.is_active
        )
        removes_active_super_admin = user.role == "super_admin" and (
            role != "super_admin" or not is_active
        )
        if user.is_active and removes_active_super_admin:
            active_ids = await UserRepository.lock_active_with_role(
                session,
                role="super_admin",
            )
            if not any(active_id != user.id for active_id in active_ids):
                raise InvalidRequestError(
                    message="The last active Super Admin cannot be demoted or deactivated"
                )

        before = _audit_state(user)
        user.role = role
        user.operator_division = division
        user.operator_tier = tier
        user.is_active = is_active
        after = _audit_state(user)

        await audit(
            session,
            actor,
            action="staff.update",
            entity_type="staff",
            entity_id=user.id,
            before=before,
            after=after,
        )
        await session.commit()

        return _serialize(user)
