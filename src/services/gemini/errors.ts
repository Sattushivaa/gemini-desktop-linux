import type { GenerationErrorShape } from "@/types";

/**
 * Classifies an error thrown by the Gemini API (or the network) into a
 * friendly, human-readable shape that the UI can render without leaking raw
 * stack traces, API keys or internal details.
 */
export function classifyError(
  raw: unknown,
  keyResolved: boolean,
): GenerationErrorShape {
  const err = raw as {
    status?: number;
    message?: string;
    name?: string;
    code?: number;
  };
  const status = err?.status ?? err?.code ?? 0;
  const message = String(err?.message ?? "").toLowerCase();
  const combined = `${status} ${message}`;

  // Cancellations are handled by the caller, but be safe here too.
  if (err?.name === "AbortError" || (message.includes("aborted") && status !== 0)) {
    return { title: "Generation stopped", message: "The response was interrupted.", kind: "unknown" };
  }

  if (message.includes("missing_api_key") || message.includes("api key not configured")) {
    return {
      title: "API key not configured",
      message:
        "Set your Gemini API key in Settings, or launch with GEMINI_API_KEY set.",
      kind: "missing-key",
    };
  }
  if (message.includes("prompt_blocked")) {
    return {
      title: "Prompt blocked",
      message: "The model declined to respond to this request.",
      kind: "prompt-blocked",
    };
  }
  if (
    message.includes("file_too_large") ||
    message.includes("upload_failed") ||
    message.includes("unsupported file")
  ) {
    return {
      title: "File not supported",
      message: "This file can't be sent to Gemini. Check the size and type.",
      kind: "file",
    };
  }

  if (!keyResolved) {
    return {
      title: "API key not configured",
      message:
        "Set your Gemini API key in Settings, or launch with GEMINI_API_KEY set.",
      kind: "missing-key",
    };
  }

  if (status === 400 && combined.includes("invalid")) {
    return {
      title: "Invalid API key",
      message: "The Gemini API key is not valid. Check Settings and try again.",
      kind: "invalid-key",
    };
  }
  if (status === 401 || status === 403) {
    return {
      title: "Access denied",
      message:
        "The API key was rejected. It may be invalid, expired, or lack access to this model.",
      kind: "invalid-key",
    };
  }
  if (status === 429) {
    return {
      title: "Rate limit exceeded",
      message: "You have hit the Gemini API rate or quota limit. Wait a moment and retry.",
      kind: "rate-limit",
    };
  }
  if (status === 404) {
    return {
      title: "Model unavailable",
      message: "The selected model is not available for this API key. Try another model.",
      kind: "model",
    };
  }
  if (
    status === 0 ||
    combined.includes("failed to fetch") ||
    combined.includes("networkerror") ||
    combined.includes("network error") ||
    combined.includes("fetch failed") ||
    combined.includes("load failed") ||
    combined.includes("econnrefused") ||
    combined.includes("err_internet_disconnected")
  ) {
    return {
      title: "Unable to reach Gemini",
      message: "Check your internet connection and try again.",
      kind: "network",
    };
  }
  if (
    combined.includes("block") ||
    combined.includes("safety") ||
    combined.includes("content policy")
  ) {
    return {
      title: "Prompt blocked",
      message: "The model declined to respond to this request.",
      kind: "prompt-blocked",
    };
  }
  if (status >= 500) {
    return {
      title: "Gemini service error",
      message: "Gemini returned a server error. Please try again in a moment.",
      kind: "network",
    };
  }

  return {
    title: "Something went wrong",
    message: "The request failed. Please retry.",
    kind: "unknown",
  };
}