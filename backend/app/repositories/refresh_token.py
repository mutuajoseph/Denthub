"""Refresh-token rotation records (ADR-0003 follow-up, #121).

The refresh cookie carries a signed JWT. Its ``jti`` is the row key here, so the
signature proves the token is ours and the row is what makes it revocable: a
rotated token's row is marked revoked, and presenting it again is a reuse
attempt that kills the whole family.

One family is one sign-in session: rotating keeps the family, logging out or a
reuse revokes every token in it.
"""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Mapped, mapped_column

from app.repositories.database import Base


class RefreshToken(Base):
    """One issued refresh token, live until it is rotated or revoked."""

    __tablename__ = "refresh_tokens"

    #: The JWT's ``jti``: random, never reused, and not itself the credential.
    jti: Mapped[str] = mapped_column(String(36), primary_key=True)
    user_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    #: Groups every rotation of one sign-in; revoking it ends that session.
    family_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    #: ``public`` or ``staff``, mirroring the access token's scope.
    scope: Mapped[str] = mapped_column(String(10), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, index=True)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), nullable=False
    )


class RefreshTokenRepository:
    """Persistence for refresh-token rotation and revocation."""

    @staticmethod
    def new_family_id() -> str:
        return str(uuid.uuid4())

    @staticmethod
    def new_jti() -> str:
        return str(uuid.uuid4())

    @staticmethod
    async def issue(
        session: AsyncSession,
        *,
        jti: str,
        user_id: str,
        family_id: str,
        scope: str,
        expires_at: datetime,
    ) -> RefreshToken:
        """Record a token the caller has just signed; it is live immediately."""
        row = RefreshToken(
            jti=jti,
            user_id=user_id,
            family_id=family_id,
            scope=scope,
            expires_at=expires_at,
        )
        session.add(row)
        await session.flush()
        return row

    @staticmethod
    async def get(session: AsyncSession, jti: str) -> RefreshToken | None:
        result = await session.execute(select(RefreshToken).where(RefreshToken.jti == jti))
        return result.scalar_one_or_none()

    @staticmethod
    async def revoke(session: AsyncSession, row: RefreshToken, *, now: datetime) -> None:
        """Mark one token spent by a rotation."""
        row.revoked_at = now
        await session.flush()

    @staticmethod
    async def revoke_family(session: AsyncSession, *, family_id: str, now: datetime) -> None:
        """End one session: every token in the family stops working."""
        await session.execute(
            update(RefreshToken)
            .where(RefreshToken.family_id == family_id, RefreshToken.revoked_at.is_(None))
            .values(revoked_at=now)
        )
        await session.flush()

    @staticmethod
    async def revoke_all_for_user(session: AsyncSession, *, user_id: str, now: datetime) -> None:
        """End every session a User has, e.g. after a password change."""
        await session.execute(
            update(RefreshToken)
            .where(RefreshToken.user_id == user_id, RefreshToken.revoked_at.is_(None))
            .values(revoked_at=now)
        )
        await session.flush()
