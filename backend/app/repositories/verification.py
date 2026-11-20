"""Verification applications: a professional's evidence and the staff decision.

An application is separate from the Verification tier it can grant. Staff
approve, reject or revoke it; the decision raises or drops the subject's tier
and is recorded in the audit trail. Reasons and document keys stay on the
application so a later reader can see why a decision was made.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import Literal

from sqlalchemy import JSON, DateTime, ForeignKey, String, func, select
from sqlalchemy import Enum as SAEnum
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Mapped, mapped_column

from app.repositories.database import Base

SubjectKind = Literal["specialist", "facility", "supplier", "training_provider"]
SUBJECT_KINDS = ("specialist", "facility", "supplier", "training_provider")

ApplicationStatus = Literal["pending", "verified", "rejected", "revoked"]
APPLICATION_STATUSES = ("pending", "verified", "rejected", "revoked")


class VerificationApplication(Base):
    """One application by a User to verify one subject they act for."""

    __tablename__ = "verification_applications"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    subject_kind: Mapped[SubjectKind] = mapped_column(
        SAEnum(*SUBJECT_KINDS, name="verification_subject_kind", native_enum=False, length=20),
        nullable=False,
    )
    subject_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    applicant_email: Mapped[str] = mapped_column(String(255), nullable=False)
    licence_number: Mapped[str] = mapped_column(String(100), nullable=False)
    issuing_body: Mapped[str] = mapped_column(String(200), nullable=False)
    document_keys: Mapped[list[str]] = mapped_column(JSON, nullable=False)
    status: Mapped[ApplicationStatus] = mapped_column(
        SAEnum(*APPLICATION_STATUSES, name="verification_status", native_enum=False, length=20),
        default="pending",
        nullable=False,
        index=True,
    )
    rejection_reason: Mapped[str | None] = mapped_column(String(500), nullable=True)
    decided_by_user_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    decided_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), nullable=False
    )


class VerificationRepository:
    @staticmethod
    async def create(
        session: AsyncSession,
        *,
        user_id: str,
        applicant_email: str,
        subject_kind: SubjectKind,
        subject_id: str,
        licence_number: str,
        issuing_body: str,
        document_keys: list[str],
    ) -> VerificationApplication:
        application = VerificationApplication(
            user_id=user_id,
            applicant_email=applicant_email,
            subject_kind=subject_kind,
            subject_id=subject_id,
            licence_number=licence_number,
            issuing_body=issuing_body,
            document_keys=document_keys,
            status="pending",
            # Microsecond precision: SQLite's CURRENT_TIMESTAMP has only
            # seconds, and two applications in one second must still order.
            created_at=datetime.now(UTC).replace(tzinfo=None),
        )
        session.add(application)
        await session.flush()
        return application

    @staticmethod
    async def get(session: AsyncSession, application_id: str) -> VerificationApplication | None:
        return await session.get(VerificationApplication, application_id)

    @staticmethod
    async def latest_for_user(
        session: AsyncSession, user_id: str
    ) -> VerificationApplication | None:
        result = await session.execute(
            select(VerificationApplication)
            .where(VerificationApplication.user_id == user_id)
            .order_by(VerificationApplication.created_at.desc(), VerificationApplication.id.desc())
            .limit(1)
        )
        return result.scalar_one_or_none()

    @staticmethod
    async def pending_for_subject(
        session: AsyncSession, *, subject_kind: SubjectKind, subject_id: str
    ) -> VerificationApplication | None:
        result = await session.execute(
            select(VerificationApplication).where(
                VerificationApplication.subject_kind == subject_kind,
                VerificationApplication.subject_id == subject_id,
                VerificationApplication.status == "pending",
            )
        )
        return result.scalar_one_or_none()

    @staticmethod
    async def list_applications(
        session: AsyncSession, *, subject_kinds: tuple[str, ...] | None, limit: int
    ) -> list[VerificationApplication]:
        stmt = select(VerificationApplication)
        if subject_kinds is not None:
            stmt = stmt.where(VerificationApplication.subject_kind.in_(subject_kinds))
        stmt = stmt.order_by(
            VerificationApplication.created_at.desc(), VerificationApplication.id.desc()
        ).limit(limit)
        return list((await session.execute(stmt)).scalars().all())
