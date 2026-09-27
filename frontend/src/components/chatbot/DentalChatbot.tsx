import { AlertCircle, MessageCircle, Send, Stethoscope, Trash2, WifiOff, X } from "lucide-react";
import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  type ChatHistoryMessage,
  type ChatReply,
  defaultChips,
} from "../../lib/chatbot/chatbotEngine";
import { getBotReply } from "../../lib/chatbot/getBotReply";

export type ChatRole = "user" | "assistant";

export interface ChatMessage {
  id: string;
  role: ChatRole;
  body: string;
  createdAt: number;
  related?: string[];
  isEmergency?: boolean;
  disclaimer?: string;
}

const CHAT_STORAGE_KEY = "denthub-dental-chat";
const WELCOME_BODY =
  "Hi! I am Dr. Denta, DentHub's dental assistant. Ask me about teeth, gums, treatments, costs, kids' dentistry, or emergencies. I provide general guidance, not a diagnosis.";

let messageCounter = 0;

function nextId() {
  messageCounter += 1;
  return `denta-message-${Date.now()}-${messageCounter}`;
}

function welcomeMessage(): ChatMessage {
  return {
    id: `denta-welcome-${Date.now()}`,
    role: "assistant",
    body: WELCOME_BODY,
    createdAt: Date.now(),
    related: defaultChips(),
  };
}

function isStoredMessage(value: unknown): value is ChatMessage {
  if (!value || typeof value !== "object") return false;
  const message = value as Partial<ChatMessage>;
  return (
    typeof message.id === "string" &&
    (message.role === "user" || message.role === "assistant") &&
    typeof message.body === "string" &&
    typeof message.createdAt === "number"
  );
}

function readMessages() {
  if (typeof window === "undefined") return [welcomeMessage()];
  try {
    const stored = window.localStorage.getItem(CHAT_STORAGE_KEY);
    if (!stored) return [welcomeMessage()];
    const parsed: unknown = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [welcomeMessage()];
    const messages = parsed.filter(isStoredMessage).slice(-50);
    return messages.length > 0 ? messages : [welcomeMessage()];
  } catch {
    return [welcomeMessage()];
  }
}

function messageFromReply(reply: ChatReply): ChatMessage {
  return {
    id: nextId(),
    role: "assistant",
    body: reply.text,
    createdAt: Date.now(),
    related: reply.related,
    isEmergency: reply.isEmergency,
    disclaimer: reply.disclaimer,
  };
}

function messageHistory(messages: ChatMessage[]): ChatHistoryMessage[] {
  return messages.map(({ role, body }) => ({ role, body }));
}

export function DentalChatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [isTyping, setIsTyping] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>(readMessages);
  const inputRef = useRef<HTMLInputElement>(null);
  const messageEndRef = useRef<HTMLDivElement>(null);
  const typingRef = useRef(false);
  const mountedRef = useRef(true);
  const isOpenRef = useRef(isOpen);

  isOpenRef.current = isOpen;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(messages));
    } catch {
      return;
    }
  }, [messages]);

  useEffect(() => {
    if (!isOpen) return;
    const timer = window.setTimeout(() => inputRef.current?.focus(), 0);
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const newestMessageId = messages.at(-1)?.id;
  const scrollKey = `${newestMessageId ?? "none"}:${isTyping ? "typing" : "idle"}`;

  useEffect(() => {
    if (!isOpen || scrollKey.startsWith("none")) return;
    messageEndRef.current?.scrollIntoView?.({ block: "nearest" });
  }, [isOpen, scrollKey]);

  const latestAssistant = useMemo(
    () => [...messages].reverse().find((message) => message.role === "assistant"),
    [messages],
  );
  const chips = (latestAssistant?.related?.length ? latestAssistant.related : defaultChips()).slice(
    0,
    4,
  );

  const toggleOpen = () => {
    if (isOpen) {
      setIsOpen(false);
      return;
    }
    setIsOpen(true);
    setUnread(0);
  };

  const sendMessage = async (value: string) => {
    const body = value.trim();
    if (!body || typingRef.current) return;

    const userMessage: ChatMessage = {
      id: nextId(),
      role: "user",
      body,
      createdAt: Date.now(),
    };

    typingRef.current = true;
    setInput("");
    setMessages((current) => [...current, userMessage]);
    setIsTyping(true);

    try {
      const history = messageHistory([...messages, userMessage]);
      const reply = await getBotReply(body, history);
      if (!mountedRef.current) return;
      setMessages((current) => [...current, messageFromReply(reply)]);
      if (!isOpenRef.current) setUnread((current) => current + 1);
    } catch {
      if (!mountedRef.current) return;
      setMessages((current) => [
        ...current,
        messageFromReply({
          text: "Sorry, something went wrong on my end. Please try again.",
          related: defaultChips(),
          isEmergency: false,
          topicId: "error",
        }),
      ]);
    } finally {
      typingRef.current = false;
      if (mountedRef.current) setIsTyping(false);
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void sendMessage(input);
  };

  const clearHistory = () => {
    setMessages([welcomeMessage()]);
    setInput("");
  };

  return (
    <>
      <button
        type="button"
        onClick={toggleOpen}
        aria-label={isOpen ? "Close dental assistant" : "Open dental assistant"}
        aria-expanded={isOpen}
        aria-controls="dental-chatbot-panel"
        className="fixed bottom-[calc(9rem+env(safe-area-inset-bottom,0px))] right-3 z-[70] flex h-14 w-14 items-center justify-center rounded-full bg-gold-500 text-navy-900 shadow-lg shadow-gold-500/30 transition-transform hover:scale-105 hover:bg-gold-400 motion-reduce:transform-none motion-reduce:transition-none sm:right-4 md:bottom-24"
      >
        {isOpen ? (
          <X className="h-6 w-6" aria-hidden="true" />
        ) : (
          <MessageCircle className="h-6 w-6" aria-hidden="true" />
        )}
        {!isOpen && unread > 0 && (
          <span
            className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[11px] font-bold text-white"
            aria-label={`${unread} unread dental assistant message${unread === 1 ? "" : "s"}`}
          >
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {isOpen && (
        <dialog
          open
          id="dental-chatbot-panel"
          aria-labelledby="dental-chatbot-title"
          className="fixed bottom-[calc(9rem+env(safe-area-inset-bottom,0px))] left-2 right-2 z-[70] m-0 flex max-w-none h-[min(70vh,32rem)] flex-col overflow-hidden rounded-2xl border border-gold-400/30 bg-navy-900 shadow-2xl sm:left-auto sm:right-4 sm:w-96 md:bottom-24"
        >
          <header className="flex items-center gap-3 border-b border-navy-700 bg-navy-800 px-4 py-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gold-400/20 text-gold-300">
              <Stethoscope className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <h2
                id="dental-chatbot-title"
                className="font-heading text-sm font-semibold text-gray-100"
              >
                Dr. Denta
              </h2>
              <p className="flex items-center gap-1 text-[11px] text-gray-400">
                <WifiOff className="h-3 w-3" aria-hidden="true" />
                Offline dental guidance
              </p>
            </div>
            <button
              type="button"
              onClick={clearHistory}
              aria-label="Clear dental chat history"
              className="rounded-md p-2 text-gray-400 transition-colors hover:bg-navy-700 hover:text-gray-200"
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              aria-label="Close dental assistant"
              className="rounded-md p-2 text-gray-400 transition-colors hover:bg-navy-700 hover:text-gray-200"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </header>

          <div
            role="log"
            aria-live="polite"
            aria-relevant="additions text"
            className="flex-1 space-y-3 overflow-y-auto px-3 py-3"
          >
            {messages.map((message) => (
              <ChatMessageBubble
                key={message.id}
                message={message}
                onEmergencyClick={() => setIsOpen(false)}
              />
            ))}
            {isTyping && (
              <output className="flex justify-start" aria-label="Dr. Denta is typing">
                <div className="flex items-center gap-1 rounded-2xl rounded-bl-md bg-navy-700/80 px-3 py-2">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-gold-300/70" />
                  <span className="h-2 w-2 animate-pulse rounded-full bg-gold-300/70 [animation-delay:150ms]" />
                  <span className="h-2 w-2 animate-pulse rounded-full bg-gold-300/70 [animation-delay:300ms]" />
                </div>
              </output>
            )}
            <div ref={messageEndRef} aria-hidden="true" />
          </div>

          <div className="flex flex-wrap gap-1.5 px-3 pb-2" aria-label="Suggested questions">
            {chips.map((chip) => (
              <button
                key={chip}
                type="button"
                onClick={() => void sendMessage(chip)}
                disabled={isTyping}
                className="rounded-full border border-navy-600 bg-navy-800 px-3 py-1.5 text-[11px] text-gray-300 transition-colors hover:border-gold-400/50 hover:text-gold-300 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {chip}
              </button>
            ))}
          </div>

          <form
            onSubmit={handleSubmit}
            className="flex items-center gap-2 border-t border-navy-700 bg-navy-800 px-3 py-2.5"
          >
            <label htmlFor="dental-chatbot-input" className="sr-only">
              Ask Dr. Denta a dental question
            </label>
            <input
              ref={inputRef}
              id="dental-chatbot-input"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Ask about teeth, gums, braces..."
              maxLength={500}
              className="min-w-0 flex-1 rounded-full border border-navy-600 bg-navy-900 px-4 py-2 text-sm text-gray-100 placeholder:text-gray-500 focus:border-gold-400/60 focus:outline-none"
            />
            <button
              type="submit"
              disabled={!input.trim() || isTyping}
              aria-label="Send message to dental assistant"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-orange-500 text-white transition-colors hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Send className="h-4 w-4" aria-hidden="true" />
            </button>
          </form>

          <p className="bg-navy-800 px-3 pb-2 text-center text-[10px] leading-relaxed text-gray-500">
            General information only. For urgent or severe symptoms, use Emergency care.
          </p>
        </dialog>
      )}
    </>
  );
}

export interface ChatMessageBubbleProps {
  message: ChatMessage;
  onEmergencyClick?: () => void;
}

export function ChatMessageBubble({ message, onEmergencyClick }: ChatMessageBubbleProps) {
  const mine = message.role === "user";

  return (
    <div className={`flex w-full ${mine ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] whitespace-pre-line rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed shadow-sm ${
          mine
            ? "rounded-br-md bg-gold-500/20 text-gray-100"
            : message.isEmergency
              ? "rounded-bl-md border border-red-500/40 bg-red-500/10 text-red-50"
              : "rounded-bl-md bg-navy-700/80 text-gray-200"
        }`}
      >
        <p>{message.body}</p>
        {message.isEmergency && (
          <Link
            to="/emergency"
            onClick={onEmergencyClick}
            className="mt-3 inline-flex min-h-[36px] items-center gap-2 rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-red-500"
          >
            <AlertCircle className="h-4 w-4" aria-hidden="true" />
            Go to emergency help
          </Link>
        )}
        {message.disclaimer && (
          <p className="mt-2 border-t border-navy-600/60 pt-1.5 text-[11px] italic text-gray-400">
            {message.disclaimer}
          </p>
        )}
      </div>
    </div>
  );
}

export const Chatbot = DentalChatbot;
