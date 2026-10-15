"""Messaging: Conversations and their Messages.

A Conversation is one thread between exactly two Users (PRD §3.9). The pair is
stored in a canonical order (``participant_a_id`` sorts before
``participant_b_id``), so however a thread was opened, one pair has exactly one
thread: the unique constraint and check constraint below are the invariant.
``kind`` records which PRD §3.9 pairing the two roles form and is derived once,
when the thread opens.

Inbox state is denormalised onto the conversation row: the two
``*_unread_count`` columns are what a new message touches for the other side,
so "mark read" is one write and the inbox never counts through message rows.
``last_message_*`` holds the preview and the inbox ordering key — the inbox
orders by ``coalesce(last_message_at, created_at)`` so a brand-new thread sits
at the top. Preview columns rather than a ``last_message_id`` pointer, because
that would make ``conversations`` and ``messages`` reference each other and
SQLite cannot ``ALTER`` a foreign key in after a table exists (tests build the
schema with ``create_all``).
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Literal

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
    or_,
    select,
    update,
)
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Mapped, mapped_column, relationship, selectinload

from app.repositories.database import Base
from app.repositories.user import User

#: Which side of the canonical participant order an unread counter belongs to.
UnreadSide = Literal["a", "b"]


class Conversation(Base):
    """One thread between exactly two Users, ordered so a pair has one thread."""

    __tablename__ = "conversations"
    __table_args__ = (
        UniqueConstraint(
            "participant_a_id",
            "participant_b_id",
            name="uq_conversations_participant_pair",
        ),
        CheckConstraint(
            "participant_a_id < participant_b_id",
            name="ck_conversations_participant_pair_order",
        ),
    )

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )
    #: The PRD §3.9 pairing the two account roles form, set when the thread opens.
    kind: Mapped[str] = mapped_column(String(40), nullable=False, index=True)

    participant_a_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    participant_b_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    #: Per-side unread counters: one number per thread for the inbox, and the
    #: only column a new message changes on the receiving side.
    a_unread_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    b_unread_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    #: Denormalised newest message for the inbox preview and ordering. All
    #: three stay in step (written together by ``apply_new_message``); the
    #: sender FK goes NULL if that user is ever removed.
    last_message_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    last_message_preview: Mapped[str | None] = mapped_column(String(140), nullable=True)
    last_message_sender_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    participant_a: Mapped[User] = relationship(foreign_keys=[participant_a_id])
    participant_b: Mapped[User] = relationship(foreign_keys=[participant_b_id])


class Message(Base):
    """One message inside a conversation, in thread order by ``created_at``."""

    __tablename__ = "messages"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )
    conversation_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("conversations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    sender_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    body: Mapped[str] = mapped_column(Text, nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), nullable=False, index=True
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    sender: Mapped[User] = relationship()


class ConversationRepository:
    """Conversation reads scoped to one participant, plus the inbox writes."""

    @staticmethod
    async def list_for_user(
        session: AsyncSession,
        *,
        user_id: str,
        limit: int,
        offset: int,
    ) -> list[Conversation]:
        """The user's threads, newest activity first, participants eager-loaded."""
        stmt = (
            select(Conversation)
            .options(
                selectinload(Conversation.participant_a),
                selectinload(Conversation.participant_b),
            )
            .where(
                or_(
                    Conversation.participant_a_id == user_id,
                    Conversation.participant_b_id == user_id,
                )
            )
            .order_by(
                func.coalesce(Conversation.last_message_at, Conversation.created_at).desc(),
                Conversation.id.desc(),
            )
            .limit(limit)
            .offset(offset)
        )
        result = await session.execute(stmt)
        return list(result.scalars().all())

    @staticmethod
    async def count_for_user(session: AsyncSession, *, user_id: str) -> int:
        """How many threads the user has in total (the inbox's page count)."""
        stmt = (
            select(func.count())
            .select_from(Conversation)
            .where(
                or_(
                    Conversation.participant_a_id == user_id,
                    Conversation.participant_b_id == user_id,
                )
            )
        )
        result = await session.execute(stmt)
        return int(result.scalar_one())

    @staticmethod
    async def get_for_user(
        session: AsyncSession,
        *,
        conversation_id: str,
        user_id: str,
    ) -> Conversation | None:
        """One thread the user belongs to, or None (unknown id and a stranger's
        thread look identical to the caller — the logic layer turns both into a 404)."""
        stmt = (
            select(Conversation)
            .options(
                selectinload(Conversation.participant_a),
                selectinload(Conversation.participant_b),
            )
            .where(
                Conversation.id == conversation_id,
                or_(
                    Conversation.participant_a_id == user_id,
                    Conversation.participant_b_id == user_id,
                ),
            )
        )
        result = await session.execute(stmt)
        return result.scalar_one_or_none()

    @staticmethod
    async def find_pair(
        session: AsyncSession,
        *,
        participant_a_id: str,
        participant_b_id: str,
    ) -> Conversation | None:
        """The thread for an already-canonical pair, if it exists."""
        stmt = select(Conversation).where(
            Conversation.participant_a_id == participant_a_id,
            Conversation.participant_b_id == participant_b_id,
        )
        result = await session.execute(stmt)
        return result.scalar_one_or_none()

    @staticmethod
    async def create_pair(
        session: AsyncSession,
        *,
        kind: str,
        participant_a_id: str,
        participant_b_id: str,
    ) -> Conversation:
        """Create a thread for a canonical pair (``participant_a_id`` < ``participant_b_id``)."""
        conversation = Conversation(
            kind=kind,
            participant_a_id=participant_a_id,
            participant_b_id=participant_b_id,
        )
        session.add(conversation)
        await session.flush()
        return conversation

    @staticmethod
    async def apply_new_message(
        session: AsyncSession,
        conversation: Conversation,
        *,
        message: Message,
        preview: str,
        bump_side: UnreadSide,
    ) -> None:
        """Record a sent message: preview columns, and ``bump_side``'s unread + 1.

        One ``UPDATE`` rather than ORM attributes, so two messages landing at
        once cannot lose an increment. The caller re-reads the row rather than
        trusting this instance, which the statement leaves stale.
        """
        unread_column = (
            Conversation.a_unread_count if bump_side == "a" else Conversation.b_unread_count
        )
        await session.execute(
            update(Conversation)
            .where(Conversation.id == conversation.id)
            .values(
                last_message_at=message.created_at,
                last_message_preview=preview,
                last_message_sender_id=message.sender_id,
                updated_at=func.now(),
                **{unread_column.key: unread_column + 1},
            )
        )


class MessageRepository:
    """Message rows: one insert path, one thread-read path."""

    @staticmethod
    async def create(
        session: AsyncSession,
        *,
        conversation_id: str,
        sender_id: str,
        body: str,
    ) -> Message:
        """Add a message to a thread and read its server-default timestamp back.

        ``created_at`` only exists once the row is read, and the preview's
        ordering key is that timestamp — the refresh keeps every dialect's
        answer honest instead of hoping for ``RETURNING``.
        """
        message = Message(conversation_id=conversation_id, sender_id=sender_id, body=body)
        session.add(message)
        await session.flush()
        await session.refresh(message)
        return message

    @staticmethod
    async def list_for_conversation(
        session: AsyncSession,
        *,
        conversation_id: str,
        limit: int,
        offset: int,
    ) -> list[Message]:
        """One page of a thread, newest first, senders eager-loaded."""
        stmt = (
            select(Message)
            .options(selectinload(Message.sender))
            .where(Message.conversation_id == conversation_id)
            .order_by(Message.created_at.desc(), Message.id.desc())
            .limit(limit)
            .offset(offset)
        )
        result = await session.execute(stmt)
        return list(result.scalars().all())

    @staticmethod
    async def count_for_conversation(session: AsyncSession, *, conversation_id: str) -> int:
        """How many messages the thread holds in total."""
        stmt = (
            select(func.count())
            .select_from(Message)
            .where(Message.conversation_id == conversation_id)
        )
        result = await session.execute(stmt)
        return int(result.scalar_one())
