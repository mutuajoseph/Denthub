import {
  type ChatHistoryMessage,
  type ChatReply,
  getEmergencyReply,
  getLocalReply,
} from "./chatbotEngine";
import { SAFETY_DISCLAIMER } from "./dentalKnowledge";

export type ChatbotMode = "offline" | "ai";

const remoteUrl = import.meta.env.VITE_CHATBOT_API_URL as string | undefined;
export const CHATBOT_MODE: ChatbotMode = remoteUrl ? "ai" : "offline";

interface RemoteResponse {
  reply?: unknown;
  text?: unknown;
  content?: unknown;
  message?: unknown;
  related?: unknown;
  isEmergency?: unknown;
}

function remoteText(data: RemoteResponse) {
  const value = data.reply ?? data.text ?? data.content ?? data.message;
  return typeof value === "string" && value.trim() ? value.trim().slice(0, 5000) : null;
}

function remoteRelated(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    .slice(0, 4);
}

export async function getBotReply(
  message: string,
  history: ChatHistoryMessage[] = [],
): Promise<ChatReply> {
  const localReply = getLocalReply(message);
  if (!remoteUrl || localReply.isEmergency) return localReply;

  try {
    const response = await fetch(remoteUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message,
        messages: history.map((item) => ({ role: item.role, content: item.body })),
      }),
    });
    if (!response.ok) return localReply;

    const data = (await response.json()) as RemoteResponse;
    const text = remoteText(data);
    if (!text) return localReply;
    if (data.isEmergency === true) return getEmergencyReply();

    return {
      text,
      related: remoteRelated(data.related),
      isEmergency: false,
      topicId: "remote",
      disclaimer: SAFETY_DISCLAIMER,
    };
  } catch {
    return localReply;
  }
}
