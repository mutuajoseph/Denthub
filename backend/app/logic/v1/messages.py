"""Messaging: the inbox, threads, and the PRD §3.9 pairing rules.

One thread per pair of users, ordered canonically in the repository. A
thread's ``kind`` is derived from the two account roles when it opens and
never changes; the six pairings are PRD §3.9's. Unread state is the viewer's
own: the inbox reports ``unread_count`` for the caller only, and opening a
thread marks it read.

Every route runs through :func:`_require_messaging_user` — a marketplace
(non-staff) account or a 403 — so a staff token gets a refusal rather than a
quietly empty inbox.
"""

from __future__ import annotations

from datetime import datetime
from typing import Literal, cast

from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.exceptions import ForbiddenException, InvalidRequestError, NotFoundException
from app.logic.v1.auth import is_staff_role
from app.repositories.message import (
    Conversation,
    ConversationRepository,
    Message,
    MessageRepository,
    UnreadSide,
)
from app.repositories.profile import ProfileRepository
from app.repositories.user import User, UserRepository
from app.utils.state import AppState

MESSAGES_PAGE_SIZE = 30
MAX_PAGE_SIZE = 100

#: Body cap for a single message. The column is unbounded ``Text``; the cap
#: lives at the Pydantic boundary so an over-long body is a 422, not a huge row.
MESSAGE_BODY_MAX_LENGTH = 4000

#: How much of the newest message the inbox preview carries (truncated at write).
PREVIEW_LENGTH = 140

#: Every marketplace (non-staff) account type may message (PRD §3.9). A strict
#: allow-list rather than "not a staff role", so a future unknown role is
#: denied too rather than falling in by default.
#: Uses derived roles per ADR-0006: "patient" covers patient/international_patient,
#: "specialist" covers dentist/specialist/intern.
MESSAGING_ROLES: frozenset[str] = frozenset(
    {
        "patient",
        "specialist",
        "facility_owner",
        "front_office",
        "facility_dentist",
        "supplier",
        "training_provider",
    }
)

_PATIENT_ROLES: frozenset[str] = frozenset({"patient"})
_CLINICIAN_ROLES: frozenset[str] = frozenset({"specialist"})
_FACILITY_ROLES: frozenset[str] = frozenset({"facility_owner", "front_office", "facility_dentist"})

ConversationKind = Literal[
    "patient_facility",
    "patient_dentist",
    "dentist_supplier",
    "patient_shop",
    "clinic_shop_bulk",
    "dentist_training",
]

#: PRD §3.9's six pairings: one role from the left group, one from the right.
#: The groups are disjoint and no pair satisfies two rules, so order never
#: decides the outcome.
_PAIRINGS: tuple[tuple[frozenset[str], frozenset[str], ConversationKind], ...] = (
    (_PATIENT_ROLES, _FACILITY_ROLES, "patient_facility"),
    (_PATIENT_ROLES, _CLINICIAN_ROLES, "patient_dentist"),
    (_PATIENT_ROLES, frozenset({"supplier"}), "patient_shop"),
    (_CLINICIAN_ROLES, frozenset({"supplier"}), "dentist_supplier"),
    (_CLINICIAN_ROLES, frozenset({"training_provider"}), "dentist_training"),
    (_FACILITY_ROLES, frozenset({"supplier"}), "clinic_shop_bulk"),
)


def derive_kind(role_a: str, role_b: str) -> ConversationKind | None:
    """The PRD §3.9 pairing two account roles form, or None if they have none.

    Equal roles collapse to a one-element set, so a same-role pair (patient to
    patient, dentist to dentist) has no pairing and is rejected by the caller.
    """
    pair = frozenset({role_a, role_b})
    if len(pair) != 2:
        return None

    for left, right, kind in _PAIRINGS:
        if pair & left and pair & right:
            return kind

    return None


class ParticipantResponse(BaseModel):
    """One side of a thread, as the other side sees it."""

    id: str
    full_name: str
    role: str


class MessagePreview(BaseModel):
    """The newest message, as the inbox row denormalises it."""

    sender_id: str | None
    sender_name: str | None
    body: str
    created_at: datetime


class ConversationResponse(BaseModel):
    """One thread for the caller: the other participant, the caller's unread state."""

    id: str
    kind: ConversationKind
    unread_count: int
    other_participant: ParticipantResponse
    last_message: MessagePreview | None
    created_at: datetime


class MessageResponse(BaseModel):
    """One message inside a thread."""

    id: str
    conversation_id: str
    sender_id: str
    sender_name: str
    body: str
    created_at: datetime


class ConversationPage(BaseModel):
    """One page of the caller's inbox."""

    items: list[ConversationResponse]
    total: int
    limit: int
    offset: int


class ThreadPage(BaseModel):
    """One thread with a page of its messages, newest message first."""

    conversation: ConversationResponse
    messages: list[MessageResponse]
    total: int
    limit: int
    offset: int


class StartConversationRequest(BaseModel):
    """Open (or continue) a thread by sending a message to a recipient."""

    recipient_id: str
    body: str = Field(min_length=1, max_length=MESSAGE_BODY_MAX_LENGTH)


class SendMessageRequest(BaseModel):
    """Send one message into an existing thread."""

    body: str = Field(min_length=1, max_length=MESSAGE_BODY_MAX_LENGTH)


def _validate_limit(limit: int) -> int:
    return max(1, min(limit, MAX_PAGE_SIZE))


async def _derive_user_role(session: AsyncSession, user: User) -> str:
    """Derive a user's role from their profiles and memberships.

    Per ADR-0006: users.role is null for non-staff users; derive a role for
    authorization checks until all code migrates to profile-based checks.
    Falls back to user.role for legacy users who have a role but no profiles/memberships.
    """
    if is_staff_role(user.role):
        return user.role

    kinds = await ProfileRepository.kinds_for_user(session, user.id)
    if kinds:
        # Map first profile kind to legacy role name
        profile_to_role = {
            "patient": "patient",
            "specialist": "specialist",
            "supplier": "supplier",
            "training_provider": "training_provider",
        }
        return profile_to_role.get(kinds[0], "patient")

    memberships = await ProfileRepository.memberships_for_user(session, user.id)
    if memberships:
        # Facility membership: owner -> facility_owner, clinical -> facility_dentist,
        # front_office -> front_office
        perms = memberships[0].permissions
        if "owner" in perms:
            return "facility_owner"
        elif "clinical" in perms:
            return "facility_dentist"
        elif "front_office" in perms:
            return "front_office"
        else:
            return "facility_owner"

    # Fallback to user.role for legacy users who have a role but no profiles/memberships
    if user.role:
        return user.role

    return "patient"


async def _require_messaging_user(session: AsyncSession, actor: User) -> User:
    """The calling user, or a 403 when messaging is not theirs to use."""
    # Note: we derive the role for the check, but return the original actor
    # The derived role is used by the caller for pairing logic
    derived_role = await _derive_user_role(session, actor)
    if derived_role not in MESSAGING_ROLES:
        raise ForbiddenException(message="Messaging is available to marketplace accounts only")

    return actor


async def _serialize_conversation(
    session: AsyncSession, conversation: Conversation, *, viewer_id: str
) -> ConversationResponse:
    """A thread as the viewer sees it: their side of the unread counters, the other person."""
    viewer_is_a = conversation.participant_a_id == viewer_id
    other = conversation.participant_b if viewer_is_a else conversation.participant_a
    unread_count = conversation.a_unread_count if viewer_is_a else conversation.b_unread_count

    # Derive the role for the other participant (per ADR-0006)
    other_role = await _derive_user_role(session, other)

    preview: MessagePreview | None = None
    if conversation.last_message_at is not None:
        sender_id = conversation.last_message_sender_id
        sender_name: str | None = None
        if sender_id is not None:
            sender = next(
                (
                    participant
                    for participant in (conversation.participant_a, conversation.participant_b)
                    if participant.id == sender_id
                ),
                None,
            )
            sender_name = sender.full_name if sender else None

        preview = MessagePreview(
            sender_id=sender_id,
            sender_name=sender_name,
            body=conversation.last_message_preview or "",
            created_at=conversation.last_message_at,
        )

    return ConversationResponse(
        id=conversation.id,
        kind=cast(ConversationKind, conversation.kind),
        unread_count=unread_count,
        other_participant=ParticipantResponse(
            id=other.id,
            full_name=other.full_name,
            role=other_role,
        ),
        last_message=preview,
        created_at=conversation.created_at,
    )


def _serialize_message(message: Message, *, sender_name: str) -> MessageResponse:
    return MessageResponse(
        id=message.id,
        conversation_id=message.conversation_id,
        sender_id=message.sender_id,
        sender_name=sender_name,
        body=message.body,
        created_at=message.created_at,
    )


async def list_conversations(
    state: AppState,
    *,
    actor: User,
    limit: int = MESSAGES_PAGE_SIZE,
    offset: int = 0,
) -> ConversationPage:
    """The caller's threads, newest activity first."""
    async with state.db_session_maker() as session:
        user = await _require_messaging_user(session, actor)
        limit = _validate_limit(limit)
        offset = max(0, offset)

        conversations = await ConversationRepository.list_for_user(
            session,
            user_id=user.id,
            limit=limit,
            offset=offset,
        )
        total = await ConversationRepository.count_for_user(session, user_id=user.id)

        return ConversationPage(
            items=[
                await _serialize_conversation(session, conversation, viewer_id=user.id)
                for conversation in conversations
            ],
            total=total,
            limit=limit,
            offset=offset,
        )


async def get_thread(
    state: AppState,
    *,
    actor: User,
    conversation_id: str,
    limit: int = MESSAGES_PAGE_SIZE,
    offset: int = 0,
) -> ThreadPage:
    """One thread the caller belongs to, with a page of its messages.

    A stranger's thread and an unknown id are the same 404, so thread ids
    cannot be probed for existence.
    """
    async with state.db_session_maker() as session:
        user = await _require_messaging_user(session, actor)
        limit = _validate_limit(limit)
        offset = max(0, offset)

        conversation = await ConversationRepository.get_for_user(
            session,
            conversation_id=conversation_id,
            user_id=user.id,
        )
        if conversation is None:
            raise NotFoundException(message="Conversation not found")

        messages = await MessageRepository.list_for_conversation(
            session,
            conversation_id=conversation.id,
            limit=limit,
            offset=offset,
        )
        total = await MessageRepository.count_for_conversation(
            session,
            conversation_id=conversation.id,
        )

        return ThreadPage(
            conversation=await _serialize_conversation(session, conversation, viewer_id=user.id),
            messages=[
                _serialize_message(message, sender_name=message.sender.full_name)
                for message in messages
            ],
            total=total,
            limit=limit,
            offset=offset,
        )


async def start_conversation(
    state: AppState,
    *,
    actor: User,
    recipient_id: str,
    body: str,
) -> ConversationResponse:
    """Open the thread with a recipient, or continue it if one already exists.

    The message is written either way, so "message this person again" never
    forks a second thread — the canonical pair keeps exactly one.
    """
    async with state.db_session_maker() as session:
        user = await _require_messaging_user(session, actor)

        if recipient_id == user.id:
            raise InvalidRequestError(message="You cannot message yourself")

        recipient = await UserRepository.get_by_id(session, recipient_id)
        if recipient is None:
            raise NotFoundException(message="Recipient not found")

        # Derive roles for pairing logic (per ADR-0006, users.role is null for non-staff)
        user_role = await _derive_user_role(session, user)
        recipient_role = await _derive_user_role(session, recipient)

        kind = derive_kind(user_role, recipient_role)
        if kind is None:
            raise InvalidRequestError(message="These accounts cannot message each other")

        participant_a_id, participant_b_id = sorted((user.id, recipient.id))
        conversation = await ConversationRepository.find_pair(
            session,
            participant_a_id=participant_a_id,
            participant_b_id=participant_b_id,
        )
        if conversation is None:
            conversation = await ConversationRepository.create_pair(
                session,
                kind=kind,
                participant_a_id=participant_a_id,
                participant_b_id=participant_b_id,
            )

        message = await MessageRepository.create(
            session,
            conversation_id=conversation.id,
            sender_id=user.id,
            body=body,
        )
        await ConversationRepository.apply_new_message(
            session,
            conversation,
            message=message,
            preview=body[:PREVIEW_LENGTH],
            bump_side="b" if conversation.participant_a_id == user.id else "a",
        )
        await session.commit()

        stored = await ConversationRepository.get_for_user(
            session,
            conversation_id=conversation.id,
            user_id=user.id,
        )
        assert stored is not None  # the writer is a participant by construction
        return await _serialize_conversation(session, stored, viewer_id=user.id)


async def send_message(
    state: AppState,
    *,
    actor: User,
    conversation_id: str,
    body: str,
) -> MessageResponse:
    """Send one message into a thread the caller belongs to, bumping the other side."""
    async with state.db_session_maker() as session:
        user = await _require_messaging_user(session, actor)

        conversation = await ConversationRepository.get_for_user(
            session,
            conversation_id=conversation_id,
            user_id=user.id,
        )
        if conversation is None:
            raise NotFoundException(message="Conversation not found")

        message = await MessageRepository.create(
            session,
            conversation_id=conversation.id,
            sender_id=user.id,
            body=body,
        )
        await ConversationRepository.apply_new_message(
            session,
            conversation,
            message=message,
            preview=body[:PREVIEW_LENGTH],
            bump_side="b" if conversation.participant_a_id == user.id else "a",
        )
        await session.commit()

        return _serialize_message(message, sender_name=user.full_name)


async def mark_conversation_read(
    state: AppState,
    *,
    actor: User,
    conversation_id: str,
) -> ConversationResponse:
    """Zero the caller's unread counter for a thread. Idempotent."""
    async with state.db_session_maker() as session:
        user = await _require_messaging_user(session, actor)

        conversation = await ConversationRepository.get_for_user(
            session,
            conversation_id=conversation_id,
            user_id=user.id,
        )
        if conversation is None:
            raise NotFoundException(message="Conversation not found")

        side: UnreadSide = "a" if conversation.participant_a_id == user.id else "b"
        if side == "a":
            conversation.a_unread_count = 0
        else:
            conversation.b_unread_count = 0
        await session.commit()

        return await _serialize_conversation(session, conversation, viewer_id=user.id)
