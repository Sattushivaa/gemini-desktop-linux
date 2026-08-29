import { invoke } from "@tauri-apps/api/core";
import { isTauri } from "@/lib/tauri";
import type { AppPaths } from "@/types";

const BROWSER_KEY = "gemini-desktop.apiKey";

export interface ResolvedKey {
  apiKey: string | null;
  source: "env" | "config" | "none";
}

let cached: ResolvedKey | null = null;

/**
 * Resolves the Gemini API key from the native backend.
 *
 * The key is sourced from the `GEMINI_API_KEY` environment variable (highest
 * priority) or the native config file written by the Settings screen. It only
 * ever lives in this module's memory on the frontend - it is never written to
 * localStorage, never logged, and never rendered into the DOM.
 */
export async function resolveApiKey(force = false): Promise<ResolvedKey> {
  if (cached && !force) return cached;

  if (!isTauri()) {
    // Browser preview: keep the key in localStorage so the chat loop works
    // end-to-end without a native backend.
    const apiKey = localStorage.getItem(BROWSER_KEY)?.trim() || null;
    cached = { apiKey, source: apiKey ? "config" : "none" };
    return cached;
  }

  try {
    const res = await invoke<{ apiKey: string | null; apiKeySource: string }>(
      "get_config",
    );
    const source = res.apiKeySource === "env" ? "env" : res.apiKeySource === "config" ? "config" : "none";
    cached = { apiKey: res.apiKey, source };
  } catch {
    cached = { apiKey: null, source: "none" };
  }
  return cached;
}

export function clearCachedKey() {
  cached = null;
}

export async function setApiKeyInNativeStore(key: string): Promise<void> {
  if (!isTauri()) {
    localStorage.setItem(BROWSER_KEY, key.trim());
    clearCachedKey();
    return;
  }
  await invoke("set_api_key", { key });
  clearCachedKey();
}

export async function getAppPaths(): Promise<AppPaths> {
  if (!isTauri()) {
    return {
      dataDir: "Browser preview — storage is in-memory and not persisted.",
      configDir: "",
      dbPath: "",
      attachmentsDir: "",
    };
  }
  return invoke<AppPaths>("get_app_paths");
}