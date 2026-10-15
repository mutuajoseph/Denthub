import { type FormEvent, useState } from "react";

import Badge from "../components/ui/Badge";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import {
  useConversations,
  useMarkConversationRead,
  useSendMessage,
  useThread,
} from "../hooks/useMessages";
import type { AuthUser } from "../lib/auth";
import type { MessageView } from "../lib/messagesApi";
import { cn } from "../utils/cn";

type MessagesProps = {
  user: AuthUser | null;
};

/** "2 minutes ago" for recent messages, an absolute date once a week old. */
function relativeTime(date: Date, now: Date = new Date()): string {
  const seconds = Math.round((date.getTime() - now.getTime()) / 1000);
  const magnitude = Math.abs(seconds);
  const formatter = new Intl.RelativeTimeFormat("en-GB", { numeric: "auto" });

  if (magnitude < 60) return formatter.format(seconds, "second");
  if (magnitude < 3600) return formatter.format(Math.round(seconds / 60), "minute");
  if (magnitude < 86_400) return formatter.format(Math.round(seconds / 3600), "hour");
  if (magnitude < 604_800) return formatter.format(Math.round(seconds / 86_400), "day");

  return date.toLocaleDateString("en-GB", {
    timeZone: "UTC",
    day: "numeric",
    month: "short",
  });
}

function MessageBubble({ message, mine }: { message: MessageView; mine: boolean }) {
  return (
    <li className={cn("flex", mine ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[80%] rounded-card px-3 py-2",
          mine ? "bg-graphite text-paper" : "bg-cloud text-ink",
        )}
      >
        {!mine && <p className="mb-0.5 text-xs font-medium text-slate">{message.senderName}</p>}
        <p className="whitespace-pre-wrap break-words text-sm">{message.body}</p>
        <time
          dateTime={message.sentAt.toISOString()}
          className={cn("mt-1 block text-[11px]", mine ? "text-paper/70" : "text-slate")}
        >
          {relativeTime(message.sentAt)}
        </time>
      </div>
    </li>
  );
}

/**
 * The inbox every signed-in marketplace account lands on (PRD §3.9): the
 * caller's threads with unread state on the left, the open thread on the right.
 * Opening a thread marks it read; staff accounts never reach here (the route's
 * guard and the API both refuse them).
 */
export function Messages({ user }: MessagesProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  const inbox = useConversations(user?.id ?? null);
  const thread = useThread(selectedId, user?.id ?? null);
  const markRead = useMarkConversationRead();
  const send = useSendMessage();

  if (!user) {
    return null;
  }

  const openConversation = (conversationId: string) => {
    setSelectedId(conversationId);
    setDraft("");

    const unread = inbox.conversations.find(
      (conversation) => conversation.id === conversationId,
    )?.unreadCount;
    if (unread) {
      markRead.mutate(conversationId);
    }
  };

  const handleSend = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const body = draft.trim();

    if (!selectedId || !body || send.isPending) {
      return;
    }

    send.mutate({ conversationId: selectedId, body }, { onSuccess: () => setDraft("") });
  };

  const chronological = [...thread.messages].reverse();

  return (
    <section className="mx-auto w-full max-w-[1200px] px-4 py-10">
      <header className="mb-6">
        <h1 className="font-display text-[32px] leading-tight font-semibold tracking-[-0.03em] text-ink">
          Messages
        </h1>
        <p className="mt-2 text-sm text-slate">
          Your conversations with clinics, dentists, suppliers and training providers.
        </p>
      </header>

      {inbox.isLoading ? (
        <output className="block rounded-card bg-cloud px-4 py-6 text-sm text-charcoal">
          Loading your messages…
        </output>
      ) : inbox.error ? (
        <Card tone="white" hover={false}>
          <p className="text-sm font-medium text-ink">Your messages could not be loaded.</p>
          <p className="mt-1 text-sm text-slate">{inbox.error.message}</p>
          <Button variant="secondary" className="mt-4" onClick={() => inbox.refetch()}>
            Try again
          </Button>
        </Card>
      ) : inbox.conversations.length === 0 ? (
        <Card tone="cloud" hover={false}>
          <h2 className="font-display text-lg font-semibold tracking-[-0.02em] text-ink">
            No conversations yet
          </h2>
          <p className="mt-2 text-sm text-charcoal">
            When you contact a clinic, dentist, supplier or training provider, the conversation
            appears here.
          </p>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[340px_minmax(0,1fr)]">
          <Card tone="white" hover={false} className="max-h-[640px] overflow-y-auto p-2">
            <ul className="space-y-1">
              {inbox.conversations.map((conversation) => (
                <li key={conversation.id}>
                  <button
                    type="button"
                    onClick={() => openConversation(conversation.id)}
                    aria-current={selectedId === conversation.id ? "true" : undefined}
                    className={cn(
                      "w-full rounded-button px-3 py-3 text-left transition-colors",
                      selectedId === conversation.id ? "bg-cloud" : "hover:bg-cloud",
                    )}
                  >
                    <span className="flex items-start justify-between gap-2">
                      <span className="truncate text-sm font-semibold text-ink">
                        {conversation.otherName}
                      </span>
                      {conversation.unreadCount > 0 && (
                        <Badge variant="ink">{conversation.unreadCount} new</Badge>
                      )}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-slate">
                      {conversation.kindLabel}
                    </span>
                    <span className="mt-1 flex items-baseline justify-between gap-2">
                      <span className="truncate text-sm text-charcoal">
                        {conversation.previewSenderId === user.id ? "You: " : ""}
                        {conversation.previewBody}
                      </span>
                      {conversation.previewAt && (
                        <time
                          dateTime={conversation.previewAt.toISOString()}
                          className="shrink-0 text-xs text-slate"
                        >
                          {relativeTime(conversation.previewAt)}
                        </time>
                      )}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </Card>

          <Card
            tone="white"
            hover={false}
            className="flex max-h-[640px] min-h-[420px] flex-col p-0"
          >
            {!selectedId ? (
              <p className="flex flex-1 items-center justify-center p-6 text-center text-sm text-slate">
                Select a conversation to read it.
              </p>
            ) : thread.isLoading ? (
              <output className="block px-4 py-6 text-sm text-charcoal">
                Loading conversation…
              </output>
            ) : thread.error ? (
              <div className="p-4">
                <p className="text-sm font-medium text-ink">
                  This conversation could not be loaded.
                </p>
                <p className="mt-1 text-sm text-slate">{thread.error.message}</p>
                <Button variant="secondary" className="mt-4" onClick={() => thread.refetch()}>
                  Try again
                </Button>
              </div>
            ) : thread.conversation ? (
              <>
                <header className="border-b border-steel px-4 py-3">
                  <h2 className="text-sm font-semibold text-ink">
                    {thread.conversation.otherName}
                  </h2>
                  <p className="text-xs text-slate">{thread.conversation.kindLabel}</p>
                </header>

                <ol
                  aria-label="Conversation messages"
                  className="flex-1 space-y-3 overflow-y-auto px-4 py-4"
                >
                  {chronological.map((message) => (
                    <MessageBubble
                      key={message.id}
                      message={message}
                      mine={message.senderId === user.id}
                    />
                  ))}
                </ol>

                <form
                  onSubmit={handleSend}
                  className="border-t border-steel px-4 py-3"
                  aria-label="Send a message"
                >
                  <div className="flex items-end gap-2">
                    <label htmlFor="message-body" className="sr-only">
                      Message
                    </label>
                    <textarea
                      id="message-body"
                      rows={2}
                      value={draft}
                      onChange={(event) => setDraft(event.target.value)}
                      placeholder="Write a message…"
                      className="min-h-11 w-full resize-none rounded-button border border-steel bg-paper px-3 py-2 text-sm text-ink placeholder:text-slate focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
                    />
                    <Button type="submit" disabled={!draft.trim() || send.isPending}>
                      Send
                    </Button>
                  </div>
                  {send.isError && (
                    <p className="mt-2 text-xs text-red-700">
                      Your message could not be sent. Try again.
                    </p>
                  )}
                </form>
              </>
            ) : null}
          </Card>
        </div>
      )}
    </section>
  );
}
