import { useEffect } from "react";
import { useUiStore } from "@/stores/ui";
import { useConversationStore } from "@/stores/conversations";
import { useSettingsStore } from "@/stores/settings";

/**
 * Global application keyboard shortcuts.
 *
 * Ctrl+N  - new chat
 * Ctrl+K  - command palette
 * Ctrl+,  - settings
 * Ctrl+Shift+S - toggle sidebar
 */
export function useKeyboardShortcuts() {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();

      if (mod && !e.shiftKey && key === "n") {
        e.preventDefault();
        void useConversationStore.getState().newChat(
          useSettingsStore.getState().settings.defaultModel,
        );
        return;
      }
      if (mod && key === "k") {
        e.preventDefault();
        const ui = useUiStore.getState();
        ui.setCommandPaletteOpen(!ui.commandPaletteOpen);
        return;
      }
      if (mod && !e.shiftKey && key === ",") {
        e.preventDefault();
        const ui = useUiStore.getState();
        ui.setSettingsOpen(!ui.settingsOpen);
        return;
      }
      if (mod && e.shiftKey && key === "s") {
        e.preventDefault();
        useUiStore.getState().toggleSidebar();
        return;
      }
      if (mod && (key === "=" || key === "+" || e.code === "NumpadAdd")) {
        e.preventDefault();
        useSettingsStore.getState().increaseFontSize();
        return;
      }
      if (mod && (key === "-" || key === "_" || e.code === "NumpadSubtract")) {
        e.preventDefault();
        useSettingsStore.getState().decreaseFontSize();
        return;
      }
      if (mod && (key === "0" || e.code === "Numpad0")) {
        e.preventDefault();
        useSettingsStore.getState().resetFontSize();
        return;
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}