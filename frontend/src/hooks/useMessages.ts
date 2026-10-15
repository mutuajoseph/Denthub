import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  type ConversationPageWire,
  type MessageView,
  type ThreadWire,
  fetchConversations,
  fetchThread,
  mapConversation,
  mapMessage,
  markConversationRead,
  sendMessage,
} from "../lib/messagesApi";

/**
 * Messaging server state. The inbox and the open thread poll rather than hold a
 * socket (PRD §8-82): `MESSAGES_POLL_MS` is the cadence for both, and it stops
 * when the tab is not focused because `refetchIntervalInBackground` stays off.
 */
export const MESSAGES_POLL_MS = 10_000;

export const INBOX_LIMIT = 30;
export const THREAD_PAGE_LIMIT = 50;

/**
 * Every messaging query sits under the signed-in user's id, so switching
 * accounts can never serve the previous user's inbox from cache.
 */
export const messagesQueryKey = (userId: string) => ["messages", userId] as const;

export function useConversations(userId: string | null) {
  const query = useQuery<ConversationPageWire>({
    queryKey: [...messagesQueryKey(userId ?? ""), "inbox"],
    queryFn: ({ signal }) => fetchConversations(INBOX_LIMIT, signal),
    enabled: Boolean(userId),
    refetchInterval: MESSAGES_POLL_MS,
    staleTime: 0,
  });

  return {
    conversations: (query.data?.items ?? []).map(mapConversation),
    total: query.data?.total ?? 0,
    isLoading: query.isPending,
    error: query.error,
    refetch: query.refetch,
  };
}

export function useThread(conversationId: string | null, userId: string | null) {
  const query = useQuery<ThreadWire>({
    queryKey: [...messagesQueryKey(userId ?? ""), "thread", conversationId ?? ""],
    queryFn: ({ signal }) => fetchThread(conversationId ?? "", THREAD_PAGE_LIMIT, signal),
    enabled: Boolean(userId && conversationId),
    refetchInterval: MESSAGES_POLL_MS,
    staleTime: 0,
  });

  return {
    conversation: query.data ? mapConversation(query.data.conversation) : null,
    /** Newest message first, as the API pages it. */
    messages: (query.data?.messages ?? []).map<MessageView>(mapMessage),
    total: query.data?.total ?? 0,
    isLoading: query.isPending,
    error: query.error,
    refetch: query.refetch,
  };
}

export function useSendMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ conversationId, body }: { conversationId: string; body: string }) =>
      sendMessage(conversationId, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["messages"] }),
  });
}

export function useMarkConversationRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (conversationId: string) => markConversationRead(conversationId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["messages"] }),
  });
}
