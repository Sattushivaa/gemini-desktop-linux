import { useState, useCallback } from "react";

/**
 * Copies text to the clipboard with a transient "copied" state.
 */
export function useCopyText(text: string) {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard may be unavailable in strict webview contexts
    }
  }, [text]);

  return { copied, copy };
}