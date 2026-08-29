import { convertFileSrc } from "@tauri-apps/api/core";

/** True when running inside the Tauri webview (native APIs available). */
export function isTauri(): boolean {
  return (
    typeof window !== "undefined" &&
    ("__TAURI_INTERNALS__" in window || "__TAURI_IPC__" in window || "__TAURI__" in window)
  );
}

/**
 * Resolves a stored attachment path to a browser-usable URL.
 *
 * Inside Tauri this goes through `convertFileSrc` (asset protocol). In a plain
 * browser preview the `path` is a blob:/data: URL already, so it is used as-is.
 */
export function attachmentSrc(path: string): string {
  if (!path) return "";
  return isTauri() ? convertFileSrc(path) : path;
}