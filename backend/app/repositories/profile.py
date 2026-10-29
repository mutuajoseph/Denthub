"""Profiles and Facility Memberships: what a User acts as (ADR-0006, #117).

A User holds at most one Profile of each kind, and any number of Facility
Memberships, one per Facility, each carrying that User's permission set there.
This is the expand step: ``users.role`` and ``users.facility_id`` still exist
and existing code still reads them.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import datetime
from typing import Literal, get_args

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    String,
    UniqueConstraint,
    select,
)
from sqlalchemy import Enum as SAEnum
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.repositories.database import Base
from app.repositories.listing import Facility

ProfileKind = Literal["patient", "specialist", "supplier", "training_provider"]
PROFILE_KINDS = get_args(ProfileKind)

FacilityPermission = Literal["owner", "front_office", "clinical"]

#: The Profile each signup Account Type creates (``CONTEXT.md`` "Account
#: Type"). A Facility signup creates no Profile: owning a Facility is a
#: membership, and the Facility itself is created by #118. The #117 migration
#: keeps its own frozen copy of this mapping for the backfill.
PROFILE_FOR_ACCOUNT_TYPE: dict[str, ProfileKind] = {
    "patient": "patient",
    "international_patient": "patient",
    "dentist": "specialist",
    "specialist": "specialist",
    "intern": "specialist",
    "supplier": "supplier",
    "training_provider": "training_provider",
}


class Profile(Base):
    """One account type a User holds (``CONTEXT.md`` "Profile").

    A Specialist Profile is not the public listing: the ``specialists`` row a
    Specialist publishes links back through ``specialists.user_id``, and may not
    exist yet.
    """

    __tablename__ = "profiles"
    __table_args__ = (UniqueConstraint("user_id", "kind", name="uq_profiles_user_id_kind"),)

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )
    user_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    kind: Mapped[ProfileKind] = mapped_column(
        SAEnum(*PROFILE_KINDS, name="profile_kind", native_enum=False, length=20),
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), nullable=False
    )


class FacilityMembership(Base):
    """A User's link to one Facility and their permissions there."""

    __tablename__ = "facility_memberships"
    __table_args__ = (
        UniqueConstraint("user_id", "facility_id", name="uq_facility_memberships_user_facility"),
        CheckConstraint(
            "owner OR front_office OR clinical",
            name="ck_facility_memberships_has_permission",
        ),
    )

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )
    user_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    facility_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("facilities.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    owner: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    front_office: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    clinical: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), nullable=False
    )

    def permissions(self) -> list[FacilityPermission]:
        held: list[tuple[FacilityPermission, bool]] = [
            ("owner", self.owner),
            ("front_office", self.front_office),
            ("clinical", self.clinical),
        ]
        return [name for name, has in held if has]


@dataclass(frozen=True)
class MembershipView:
    facility_id: str
    facility_name: str
    permissions: list[FacilityPermission]


class ProfileRepository:
    @staticmethod
    async def add(session: AsyncSession, *, user_id: str, kind: ProfileKind) -> None:
        session.add(Profile(user_id=user_id, kind=kind))
        await session.flush()

    @staticmethod
    async def add_facility_membership(
        session: AsyncSession,
        *,
        user_id: str,
        facility_id: str,
        owner: bool = False,
        front_office: bool = False,
        clinical: bool = False,
    ) -> None:
        """Link a User to a Facility with the given permission set."""
        session.add(
            FacilityMembership(
                user_id=user_id,
                facility_id=facility_id,
                owner=owner,
                front_office=front_office,
                clinical=clinical,
            )
        )
        await session.flush()

    @staticmethod
    async def kinds_for_user(session: AsyncSession, user_id: str) -> list[ProfileKind]:
        stmt = select(Profile.kind).where(Profile.user_id == user_id).order_by(Profile.kind)
        return list((await session.execute(stmt)).scalars().all())

    @staticmethod
    async def memberships_for_user(session: AsyncSession, user_id: str) -> list[MembershipView]:
        """The User's memberships with each Facility's name, by Facility name."""
        stmt = (
            select(FacilityMembership, Facility.name)
            .join(Facility, Facility.id == FacilityMembership.facility_id)
            .where(FacilityMembership.user_id == user_id)
            .order_by(Facility.name)
        )
        rows = (await session.execute(stmt)).all()
        return [
            MembershipView(
                facility_id=membership.facility_id,
                facility_name=name,
                permissions=membership.permissions(),
            )
            for membership, name in rows
        ]
