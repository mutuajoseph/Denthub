import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AuthUser } from "../lib/auth";
import {
  type ConversationPageWire,
  type ConversationWire,
  type ThreadWire,
  fetchConversations,
  fetchThread,
  markConversationRead,
  sendMessage,
} from "../lib/messagesApi";
import { Messages } from "./Messages";

vi.mock("../lib/messagesApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/messagesApi")>();

  return {
    ...actual,
    fetchConversations: vi.fn(),
    fetchThread: vi.fn(),
    markConversationRead: vi.fn(),
    sendMessage: vi.fn(),
  };
});

const fetchConversationsMock = vi.mocked(fetchConversations);
const fetchThreadMock = vi.mocked(fetchThread);
const markConversationReadMock = vi.mocked(markConversationRead);
const sendMessageMock = vi.mocked(sendMessage);

const patient: AuthUser = {
  id: "me",
  email: "amina@example.com",
  role: "patient",
  full_name: "Amina Wanjiku",
  is_staff: false,
  account_status: "active",
  email_verified: true,
  profiles: [],
  memberships: [],
};

function minutesAgo(minutes: number): string {
  return new Date(Date.now() - minutes * 60_000).toISOString();
}

function buildConversation(overrides: Partial<ConversationWire> = {}): ConversationWire {
  return {
    id: "conv-1",
    kind: "patient_facility",
    unread_count: 2,
    other_participant: {
      id: "u-facility",
      full_name: "Westlands Dental",
      role: "facility_owner",
    },
    last_message: {
      sender_id: "u-facility",
      sender_name: "Westlands Dental",
      body: "Your appointment is confirmed.",
      created_at: minutesAgo(2),
    },
    created_at: minutesAgo(60),
    ...overrides,
  };
}

function inboxPage(items: ConversationWire[]): ConversationPageWire {
  return { items, total: items.length, limit: 30, offset: 0 };
}

function buildThread(overrides: Partial<ThreadWire> = {}): ThreadWire {
  return {
    conversation: buildConversation(),
    messages: [
      {
        id: "m2",
        conversation_id: "conv-1",
        sender_id: "me",
        sender_name: "Amina Wanjiku",
        body: "Thank you!",
        created_at: minutesAgo(1),
      },
      {
        id: "m1",
        conversation_id: "conv-1",
        sender_id: "u-facility",
        sender_name: "Westlands Dental",
        body: "Your appointment is confirmed.",
        created_at: minutesAgo(2),
      },
    ],
    total: 2,
    limit: 50,
    offset: 0,
    ...overrides,
  };
}

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0, gcTime: 0 } },
  });

  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <Messages user={patient} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("Messages", () => {
  beforeEach(() => {
    fetchConversationsMock.mockResolvedValue(inboxPage([buildConversation()]));
    fetchThreadMock.mockResolvedValue(buildThread());
    markConversationReadMock.mockResolvedValue(buildConversation());
    sendMessageMock.mockResolvedValue(buildThread().messages[0]);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("shows a loading state while the inbox is in flight", async () => {
    fetchConversationsMock.mockReturnValue(new Promise(() => {}));

    renderPage();

    expect(await screen.findByText(/loading your messages/i)).toBeInTheDocument();
  });

  it("lists conversations with their pairing label, preview and unread count", async () => {
    renderPage();

    expect(await screen.findByText("Westlands Dental")).toBeInTheDocument();
    expect(screen.getByText("Patient & Facility")).toBeInTheDocument();
    expect(screen.getByText("Your appointment is confirmed.")).toBeInTheDocument();
    expect(screen.getByText("2 new")).toBeInTheDocument();
    expect(screen.getByText("2 minutes ago")).toBeInTheDocument();
  });

  it("offers a retry when the inbox fails", async () => {
    const user = userEvent.setup();
    fetchConversationsMock.mockRejectedValue(new Error("Inbox is down"));

    renderPage();

    expect(await screen.findByText(/could not be loaded/i)).toBeInTheDocument();
    expect(screen.getByText("Inbox is down")).toBeInTheDocument();

    fetchConversationsMock.mockResolvedValue(inboxPage([buildConversation()]));
    await user.click(screen.getByRole("button", { name: /try again/i }));

    expect(await screen.findByText("Westlands Dental")).toBeInTheDocument();
  });

  it("shows the empty state when there are no conversations", async () => {
    fetchConversationsMock.mockResolvedValue(inboxPage([]));

    renderPage();

    expect(await screen.findByText("No conversations yet")).toBeInTheDocument();
  });

  it("opens a thread, marks it read, and shows its messages oldest first", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: /westlands dental/i }));

    expect(fetchThreadMock).toHaveBeenCalledWith("conv-1", expect.any(Number), expect.anything());
    expect(markConversationReadMock).toHaveBeenCalledWith("conv-1");

    const list = await screen.findByRole("list", { name: "Conversation messages" });
    const bubbles = within(list).getAllByRole("listitem");
    expect(bubbles).toHaveLength(2);
    expect(bubbles[0]).toHaveTextContent("Your appointment is confirmed.");
    expect(bubbles[1]).toHaveTextContent("Thank you!");
  });

  it("sends a message and clears the composer, without marking a read thread", async () => {
    const user = userEvent.setup();
    fetchConversationsMock.mockResolvedValue(inboxPage([buildConversation({ unread_count: 0 })]));
    renderPage();

    await user.click(await screen.findByRole("button", { name: /westlands dental/i }));
    expect(markConversationReadMock).not.toHaveBeenCalled();

    const composer = await screen.findByLabelText("Message");
    await user.type(composer, "Please bring my file");
    await user.click(screen.getByRole("button", { name: "Send" }));

    expect(sendMessageMock).toHaveBeenCalledWith("conv-1", "Please bring my file");
    await waitFor(() => expect(composer).toHaveValue(""));
  });

  it("surfaces a failed send without losing the draft", async () => {
    const user = userEvent.setup();
    fetchConversationsMock.mockResolvedValue(inboxPage([buildConversation({ unread_count: 0 })]));
    sendMessageMock.mockRejectedValue(new Error("Send failed"));
    renderPage();

    await user.click(await screen.findByRole("button", { name: /westlands dental/i }));

    const composer = await screen.findByLabelText("Message");
    await user.type(composer, "Still here");
    await user.click(screen.getByRole("button", { name: "Send" }));

    expect(await screen.findByText(/could not be sent/i)).toBeInTheDocument();
    expect(composer).toHaveValue("Still here");
  });

  it("offers a retry when a thread fails to load", async () => {
    const user = userEvent.setup();
    fetchThreadMock.mockRejectedValue(new Error("Thread is down"));
    renderPage();

    await user.click(await screen.findByRole("button", { name: /westlands dental/i }));

    expect(await screen.findByText(/this conversation could not be loaded/i)).toBeInTheDocument();

    fetchThreadMock.mockResolvedValue(buildThread());
    await user.click(screen.getByRole("button", { name: /try again/i }));

    expect(await screen.findByRole("list", { name: "Conversation messages" })).toBeInTheDocument();
  });
});
