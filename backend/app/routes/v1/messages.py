"""Messaging routes — thin HTTP adapters over messages logic.

Every route needs a bearer token and a marketplace (non-staff) account, so each
one asks the OpenAPI document for 401 and 403 explicitly rather than leaving
them undocumented.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.dependencies import get_app_state
from app.logic.v1.messages import (
    MAX_PAGE_SIZE,
    MESSAGES_PAGE_SIZE,
    ConversationPage,
    ConversationResponse,
    MessageResponse,
    SendMessageRequest,
    StartConversationRequest,
    ThreadPage,
    get_thread,
    list_conversations,
    mark_conversation_read,
    send_message,
    start_conversation,
)
from app.utils.openapi_helpers import standard_error_responses
from app.utils.state import AppState

router = APIRouter(prefix="/messages", tags=["messages"])
security = HTTPBearer(auto_error=True)


@router.get(
    "/conversations",
    response_model=ConversationPage,
    responses=standard_error_responses(401, 403),
)
async def read_conversations(
    limit: int = Query(default=MESSAGES_PAGE_SIZE, ge=1, le=MAX_PAGE_SIZE),
    offset: int = Query(default=0, ge=0),
    credentials: HTTPAuthorizationCredentials = Depends(security),
    state: AppState = Depends(get_app_state),
) -> ConversationPage:
    """The caller's threads, newest activity first."""
    return await list_conversations(
        state,
        token=credentials.credentials,
        limit=limit,
        offset=offset,
    )


@router.post(
    "/conversations",
    response_model=ConversationResponse,
    responses=standard_error_responses(401, 403),
)
async def open_conversation(
    payload: StartConversationRequest,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    state: AppState = Depends(get_app_state),
) -> ConversationResponse:
    """Open the thread with a recipient (or continue it) by sending a message."""
    return await start_conversation(
        state,
        token=credentials.credentials,
        recipient_id=payload.recipient_id,
        body=payload.body,
    )


@router.get(
    "/conversations/{conversation_id}",
    response_model=ThreadPage,
    responses=standard_error_responses(401, 403),
)
async def read_thread(
    conversation_id: str,
    limit: int = Query(default=MESSAGES_PAGE_SIZE, ge=1, le=MAX_PAGE_SIZE),
    offset: int = Query(default=0, ge=0),
    credentials: HTTPAuthorizationCredentials = Depends(security),
    state: AppState = Depends(get_app_state),
) -> ThreadPage:
    """One thread the caller belongs to, with its messages, newest first."""
    return await get_thread(
        state,
        token=credentials.credentials,
        conversation_id=conversation_id,
        limit=limit,
        offset=offset,
    )


@router.post(
    "/conversations/{conversation_id}/messages",
    response_model=MessageResponse,
    responses=standard_error_responses(401, 403),
)
async def write_message(
    conversation_id: str,
    payload: SendMessageRequest,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    state: AppState = Depends(get_app_state),
) -> MessageResponse:
    """Send one message into a thread the caller belongs to."""
    return await send_message(
        state,
        token=credentials.credentials,
        conversation_id=conversation_id,
        body=payload.body,
    )


@router.post(
    "/conversations/{conversation_id}/read",
    response_model=ConversationResponse,
    responses=standard_error_responses(401, 403),
)
async def mark_read(
    conversation_id: str,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    state: AppState = Depends(get_app_state),
) -> ConversationResponse:
    """Clear the caller's unread count for a thread."""
    return await mark_conversation_read(
        state,
        token=credentials.credentials,
        conversation_id=conversation_id,
    )
