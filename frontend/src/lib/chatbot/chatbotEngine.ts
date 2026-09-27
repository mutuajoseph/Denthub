import {
  DENTAL_KNOWLEDGE,
  type DentalTopic,
  EMERGENCY_KEYWORDS,
  EMERGENCY_REPLY,
  FALLBACK_REPLY,
  GREETING_REPLIES,
  GUARDRAIL_REPLY,
  SAFETY_DISCLAIMER,
  SOFT_DISCLAIMER,
  THANKS_REPLIES,
} from "./dentalKnowledge";

export interface ChatReply {
  text: string;
  related: string[];
  isEmergency: boolean;
  topicId: string;
  disclaimer?: string;
  guardrail?: boolean;
}

export interface ChatHistoryMessage {
  role: "user" | "assistant";
  body: string;
}

const greetingPatterns = [
  /^(hi|hey|hello|yo|hiya|howdy|good\s*(morning|afternoon|evening)|jambo|habari|sup)\b/i,
];
const thanksPattern = /\b(thanks|thank you|thx|asante|appreciate|cheers)\b/i;
const diagnosisPattern =
  /\b(diagnos(?:e|is)|what do i have|is it cancer|is this an infection|do i need antibiotics|what medicine|what medication|should i take)\b/i;

function normalize(value: string) {
  return ` ${value
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()} `;
}

function includesPhrase(text: string, phrase: string) {
  const normalizedPhrase = phrase
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9\s]/g, " ");
  const compact = normalizedPhrase.replace(/\s+/g, " ").trim();
  return text.includes(` ${compact} `) || text.includes(` ${compact}`);
}

function pick(values: string[]) {
  return values[Math.floor(Math.random() * values.length)] ?? values[0] ?? "";
}

export function normalizeChatText(value: unknown) {
  return normalize(String(value ?? ""));
}

export function isEmergencyMessage(value: unknown) {
  const text = normalizeChatText(value);
  return EMERGENCY_KEYWORDS.some((keyword) => includesPhrase(text, keyword));
}

function isDiagnosisRequest(value: unknown) {
  return diagnosisPattern.test(String(value ?? "").toLowerCase());
}

function scoreTopic(topic: DentalTopic, text: string) {
  let score = 0;
  for (const keyword of topic.keywords) {
    if (includesPhrase(text, keyword)) {
      const words = keyword.split(/\s+/).length;
      score += 1 + words * 0.75 + keyword.length * 0.02;
    }
  }
  return score;
}

function chips() {
  return [
    "I have a toothache",
    "How do I whiten my teeth?",
    "Tell me about braces",
    "I have a dental emergency",
  ];
}

export function getEmergencyReply(): ChatReply {
  return {
    text: EMERGENCY_REPLY,
    related: ["Find urgent dental help", "Knocked-out tooth first aid", "Is it an abscess?"],
    isEmergency: true,
    topicId: "emergency",
    disclaimer: SAFETY_DISCLAIMER,
  };
}

export function getLocalReply(message: unknown): ChatReply {
  const raw = String(message ?? "").trim();
  const normalized = normalize(raw);

  if (!raw) {
    return {
      text: pick(GREETING_REPLIES),
      related: chips(),
      isEmergency: false,
      topicId: "greeting",
    };
  }

  if (isEmergencyMessage(raw)) return getEmergencyReply();

  if (raw.length <= 25 && greetingPatterns.some((pattern) => pattern.test(raw))) {
    return {
      text: pick(GREETING_REPLIES),
      related: chips(),
      isEmergency: false,
      topicId: "greeting",
    };
  }

  if (raw.length <= 30 && thanksPattern.test(raw)) {
    return { text: pick(THANKS_REPLIES), related: chips(), isEmergency: false, topicId: "thanks" };
  }

  if (isDiagnosisRequest(raw)) {
    return {
      text: GUARDRAIL_REPLY,
      related: [
        "Find a dentist near me",
        "I have a dental emergency",
        "How often should I see a dentist?",
      ],
      isEmergency: false,
      topicId: "guardrail",
      disclaimer: SAFETY_DISCLAIMER,
      guardrail: true,
    };
  }

  let bestTopic: DentalTopic | null = null;
  let bestScore = 0;
  for (const topic of DENTAL_KNOWLEDGE) {
    const score = scoreTopic(topic, normalized);
    if (score > bestScore) {
      bestScore = score;
      bestTopic = topic;
    }
  }

  if (bestTopic && bestScore >= 1) {
    return {
      text: bestTopic.answer,
      related: bestTopic.related ?? chips(),
      isEmergency: false,
      topicId: bestTopic.id,
      disclaimer: SOFT_DISCLAIMER,
    };
  }

  return {
    text: FALLBACK_REPLY,
    related: chips(),
    isEmergency: false,
    topicId: "fallback",
    disclaimer: SAFETY_DISCLAIMER,
  };
}

export function defaultChips() {
  return chips();
}
