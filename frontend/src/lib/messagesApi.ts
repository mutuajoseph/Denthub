/**
 * Contract types for the messaging endpoints, mirroring the backend Pydantic
 * models in `backend/app/logic/v1/messages.py` — `GET/POST
 * /messages/conversations`, `GET /messages/conversations/{id}`,
 * `POST .../{id}/messages` and `POST .../{id}/read`.
 *
 * The **wire** shape is snake_case exactly as the API answers. Timestamps are
 * naive ISO strings the backend writes in UTC (wall-clock digits, no zone
 * suffix), so the mapper reads them as UTC — the same rule the appointment
 * clocks follow.
 *
 * The **UI** shape (`ConversationView` / `MessageView`) is camelCase with
 * `Date` objects and the pairing's display label resolved. Pages and
 * components only ever read these.
 */

import { getJson, postJson } from "./apiClient";

/** The PRD §3.9 cross-role pairings a thread can be, as the API names them. */
export type ConversationKind =
  | "patient_facility"
  | "patient_dentist"
  | "dentist_supplier"
  | "patient_shop"
  | "clinic_shop_bulk"
  | "dentist_training";

export const CONVERSATION_KIND_LABELS: Record<ConversationKind, string> = {
  patient_facility: "Patient & Facility",
  patient_dentist: "Patient & Dentist",
  dentist_supplier: "Dentist & Supplier",
  patient_shop: "Patient & Shop",
  clinic_shop_bulk: "Clinic & Shop",
  dentist_training: "Dentist & Training",
};

/** One side of a thread, as the other side sees it. */
export interface ParticipantWire {
  id: string;
  full_name: string;
  role: string;
}

/** The newest message as the inbox row denormalises it. */
export interface MessagePreviewWire {
  sender_id: string | null;
  sender_name: string | null;
  body: string;
  created_at: string;
}

/** One thread as the API serves it, with the caller's own unread count. */
export interface ConversationWire {
  id: string;
  kind: ConversationKind;
  unread_count: number;
  other_participant: ParticipantWire;
  last_message: MessagePreviewWire | null;
  created_at: string;
}

/** One page of the caller's inbox. */
export interface ConversationPageWire {
  items: ConversationWire[];
  total: number;
  limit: number;
  offset: number;
}

/** One message inside a thread. */
export interface MessageWire {
  id: string;
  conversation_id: string;
  sender_id: string;
  sender_name: string;
  body: string;
  created_at: string;
}

/** One thread with a page of its messages, newest message first. */
export interface ThreadWire {
  conversation: ConversationWire;
  messages: MessageWire[];
  total: number;
  limit: number;
  offset: number;
}

export function fetchConversations(
  limit: number,
  signal?: AbortSignal,
): Promise<ConversationPageWire> {
  return getJson<ConversationPageWire>("/messages/conversations", {
    query: { limit },
    auth: true,
    signal,
  });
}

export function fetchThread(
  conversationId: string,
  limit: number,
  signal?: AbortSignal,
): Promise<ThreadWire> {
  return getJson<ThreadWire>(`/messages/conversations/${encodeURIComponent(conversationId)}`, {
    query: { limit },
    auth: true,
    signal,
  });
}

export function startConversation(recipientId: string, body: string): Promise<ConversationWire> {
  return postJson<ConversationWire>(
    "/messages/conversations",
    { recipient_id: recipientId, body },
    { auth: true },
  );
}

export function sendMessage(conversationId: string, body: string): Promise<MessageWire> {
  return postJson<MessageWire>(
    `/messages/conversations/${encodeURIComponent(conversationId)}/messages`,
    { body },
    { auth: true },
  );
}

export function markConversationRead(conversationId: string): Promise<ConversationWire> {
  return postJson<ConversationWire>(
    `/messages/conversations/${encodeURIComponent(conversationId)}/read`,
    {},
    { auth: true },
  );
}

/* ------------------------------------------------------------------ *
 * UI model
 * ------------------------------------------------------------------ */

/** One inbox row as the UI reads it. */
export interface ConversationView {
  id: string;
  kindLabel: string;
  unreadCount: number;
  otherName: string;
  /** The newest message, truncated by the backend for the preview. */
  previewBody: string | null;
  previewSenderId: string | null;
  previewAt: Date | null;
}

/** One message as the UI reads it. */
export interface MessageView {
  id: string;
  senderId: string;
  senderName: string;
  body: string;
  sentAt: Date;
}

/**
 * Backend timestamps are naive ISO strings written in UTC. Read the digits as
 * UTC rather than letting the browser apply its own offset.
 */
function parseUtc(value: string): Date {
  return new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(value) ? value : `${value}Z`);
}

export function mapConversation(wire: ConversationWire): ConversationView {
  return {
    id: wire.id,
    kindLabel: CONVERSATION_KIND_LABELS[wire.kind],
    unreadCount: wire.unread_count,
    otherName: wire.other_participant.full_name,
    previewBody: wire.last_message?.body ?? null,
    previewSenderId: wire.last_message?.sender_id ?? null,
    previewAt: wire.last_message ? parseUtc(wire.last_message.created_at) : null,
  };
}

export function mapMessage(wire: MessageWire): MessageView {
  return {
    id: wire.id,
    senderId: wire.sender_id,
    senderName: wire.sender_name,
    body: wire.body,
    sentAt: parseUtc(wire.created_at),
  };
}
