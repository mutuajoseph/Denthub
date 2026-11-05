"""Single-use emailed tokens: email verification and password reset (#120).

Only a SHA-256 of each token is stored, so a database read can't be turned into
a working link. A token is spent by stamping ``used_at``; issuing a new one for
the same purpose spends any the User still holds, so only the latest link works.
"""

from __future__ import annotations

import hashlib
import uuid
from datetime import datetime
from typing import Literal, get_args

from sqlalchemy import DateTime, ForeignKey, String, update
from sqlalchemy import Enum as SAEnum
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.repositories.database import Base

TokenPurpose = Literal["verify_email", "reset_password"]
TOKEN_PURPOSES = get_args(TokenPurpose)


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


class UserToken(Base):
    __tablename__ = "user_tokens"

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
    purpose: Mapped[TokenPurpose] = mapped_column(
        SAEnum(*TOKEN_PURPOSES, name="user_token_purpose", native_enum=False, length=20),
        nullable=False,
    )
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    used_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), nullable=False
    )


class UserTokenRepository:
    @staticmethod
    async def issue(
        session: AsyncSession,
        *,
        user_id: str,
        purpose: TokenPurpose,
        token: str,
        expires_at: datetime,
        now: datetime,
    ) -> None:
        """Store a new token, spending any unused one of the same purpose."""
        await session.execute(
            update(UserToken)
            .where(
                UserToken.user_id == user_id,
                UserToken.purpose == purpose,
                UserToken.used_at.is_(None),
            )
            .values(used_at=now)
        )
        session.add(
            UserToken(
                user_id=user_id,
                purpose=purpose,
                token_hash=hash_token(token),
                expires_at=expires_at,
            )
        )
        await session.flush()

    @staticmethod
    async def spend(
        session: AsyncSession, *, token: str, purpose: TokenPurpose, now: datetime
    ) -> str | None:
        """Mark a live token used and return its User's id; None if it isn't live.

        One conditional UPDATE, so two requests racing on the same link can't
        both spend it.
        """
        stmt = (
            update(UserToken)
            .where(
                UserToken.token_hash == hash_token(token),
                UserToken.purpose == purpose,
                UserToken.used_at.is_(None),
                UserToken.expires_at > now,
            )
            .values(used_at=now)
            .returning(UserToken.user_id)
        )
        return (await session.execute(stmt)).scalar_one_or_none()
