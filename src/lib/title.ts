import type { Message } from "@/types";

const LEADING_VERBS = new Set([
  "explain",
  "describe",
  "define",
  "detail",
  "what",
  "whats",
  "what's",
  "what is",
  "what are",
  "why",
  "why is",
  "why does",
  "how",
  "how to",
  "how do",
  "how does",
  "how can",
  "tell me",
  "give me",
  "show me",
  "write",
  "create",
  "make",
  "build",
  "generate",
  "help me",
  "compare",
  "summarize",
  "summarise",
  "fix",
  "debug",
  "translate",
  "convert",
  "implement",
  "review",
]);

function cleanText(raw: string): string {
  return raw
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/[*_~#>|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Produces a short human-style title from the first meaningful user message.
 * Pure local heuristic - no API call needed. e.g.
 *   "Explain red black trees" -> "Red Black Trees"
 *   "1910 * 4.37 = ?"        -> "1910 * 4.37"
 */
export function generateTitleFromText(raw: string): string | null {
  const text = cleanText(raw);
  if (!text) return null;

  let words = text.split(" ");

  // Drop a leading imperative/phrase like "explain"/"what is".
  let consumed = 0;
  for (let i = 1; i <= Math.min(3, words.length); i++) {
    const prefix = words.slice(0, i).join(" ").toLowerCase();
    if (LEADING_VERBS.has(prefix)) {
      consumed = i;
      break;
    }
  }
  // If the whole message was a single verb, don't strip it all.
  if (consumed > 0 && consumed < words.length) {
    words = words.slice(consumed);
  }

  let title = words.join(" ");
  if (title.length > 60) {
    title = title.slice(0, 57).trimEnd() + "…";
  }
  title = title.replace(/[.!,;:?]+$/g, "").trim();
  if (!title) title = words.join(" ");

  if (title.length > 120) title = title.slice(0, 117).trimEnd() + "…";
  return title.length > 0 ? title.charAt(0).toUpperCase() + title.slice(1) : null;
}

/** Only auto-title on the first user message of a conversation. */
export function shouldAutoTitle(message: Message): boolean {
  return message.role === "user";
}