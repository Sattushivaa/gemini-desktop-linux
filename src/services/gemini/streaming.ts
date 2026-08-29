import { GoogleGenAI, type Content, type Part } from "@google/genai";
import type { Message } from "@/types";
import { resolveApiKey } from "./client";
import type { ModelDef } from "./models";
import { attachmentToPart, type PromptAttachment } from "./files";

export interface GenerateStreamOptions {
  model: string;
  modelDef?: ModelDef;
  /** Persisted messages that form the conversation so far. */
  history: Message[];
  prompt: string;
  promptAttachments?: PromptAttachment[];
  temperature?: number;
  maxOutputTokens?: number;
  signal?: AbortSignal;
  onDelta: (delta: string) => void;
}

export interface GenerateStreamResult {
  text: string;
  cancelled: boolean;
}

let client: GoogleGenAI | null = null;
let clientKey: string | null = null;

async function getClient(key: string): Promise<GoogleGenAI> {
  if (!client || clientKey !== key) {
    client = new GoogleGenAI({ apiKey: key });
    clientKey = key;
  }
  return client;
}

function historyToContents(history: Message[]): Content[] {
  const contents: Content[] = [];
  for (const msg of history) {
    if (msg.role !== "user" && msg.role !== "model") continue;
    const parts: Part[] = [];
    if (msg.content.trim()) parts.push({ text: msg.content });
    if (parts.length === 0) continue;
    contents.push({ role: msg.role, parts });
  }
  return contents;
}

export async function hasApiKey(): Promise<boolean> {
  const resolved = await resolveApiKey();
  return Boolean(resolved.apiKey);
}

/**
 * Streams a response from the official Google Gen AI SDK.
 *
 * The caller is responsible for handling streaming state; this function merely
 * streams text deltas through `onDelta` and returns the final accumulated text.
 */
export async function generateStream(
  options: GenerateStreamOptions,
): Promise<GenerateStreamResult> {
  const { model, history, prompt, promptAttachments, signal } = options;
  const resolved = await resolveApiKey();
  const key = resolved.apiKey;
  if (!key) {
    throw new Error("missing_api_key");
  }

  const ai = await getClient(key);
  // Exclude the current prompt turn if it was already appended to history store before streaming
  const priorHistory = history.filter(
    (m, idx) => !(idx === history.length - 1 && m.role === "user" && m.content.trim() === prompt.trim()),
  );
  const contents: Content[] = historyToContents(priorHistory);

  // Build the current user turn (text + attachments).
  const userParts: Part[] = [];
  if (prompt.trim()) userParts.push({ text: prompt });
  if (promptAttachments && promptAttachments.length > 0) {
    for (const pa of promptAttachments) {
      userParts.push(await attachmentToPart(ai, pa));
    }
  }
  if (userParts.length > 0) {
    contents.push({ role: "user", parts: userParts });
  }

  const config: Record<string, unknown> = {};
  if (typeof options.temperature === "number") config.temperature = options.temperature;
  if (typeof options.maxOutputTokens === "number") config.maxOutputTokens = options.maxOutputTokens;
  if (signal) config.abortSignal = signal;

  const stream = await ai.models.generateContentStream({
    model,
    contents,
    config,
  });

  let text = "";
  let cancelled = false;
  try {
    for await (const chunk of stream) {
      const block = chunk.promptFeedback?.blockReason;
      if (block) {
        throw new Error("prompt_blocked");
      }
      const delta = chunk.text;
      if (delta) {
        text += delta;
        options.onDelta(delta);
      }
      if (signal?.aborted) {
        cancelled = true;
        break;
      }
    }
  } catch (err) {
    if (signal?.aborted) {
      cancelled = true;
    } else {
      throw err;
    }
  }

  return { text, cancelled };
}