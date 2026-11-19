"""Object keys the API has issued (ADR-0007, #123).

An upload is only a key until a client writes bytes to it. Recording issued
keys here means an owning resource can accept exactly the keys this API handed
to its User, and nothing invented by a caller.
"""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Mapped, mapped_column

from app.repositories.database import Base


class UploadedObject(Base):
    """One object key issued by ``POST /uploads``."""

    __tablename__ = "uploaded_objects"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    object_key: Mapped[str] = mapped_column(String(255), nullable=False, unique=True, index=True)
    user_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    purpose: Mapped[str] = mapped_column(String(30), nullable=False)
    bucket: Mapped[str] = mapped_column(String(50), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), nullable=False
    )


class UploadedObjectRepository:
    @staticmethod
    async def record(
        session: AsyncSession, *, object_key: str, user_id: str, purpose: str, bucket: str
    ) -> None:
        """Record a freshly issued key before any client can use it."""
        session.add(
            UploadedObject(object_key=object_key, user_id=user_id, purpose=purpose, bucket=bucket)
        )
        await session.flush()

    @staticmethod
    async def belongs_to(
        session: AsyncSession, *, object_key: str, user_id: str, purpose: str
    ) -> bool:
        """Whether this User was issued this key for this purpose."""
        row = await session.execute(
            select(UploadedObject.id).where(
                UploadedObject.object_key == object_key,
                UploadedObject.user_id == user_id,
                UploadedObject.purpose == purpose,
            )
        )
        return row.scalar_one_or_none() is not None
