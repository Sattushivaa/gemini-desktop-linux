import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Settings, FontSize } from "@/types";
import { DEFAULT_SETTINGS, FONT_SIZES, FONT_SIZE_ORDER } from "@/types";

interface SettingsState {
  settings: Settings;
  update: (patch: Partial<Settings>) => void;
  increaseFontSize: () => void;
  decreaseFontSize: () => void;
  resetFontSize: () => void;
}

function applyToDocument(settings: Settings) {
  document.documentElement.classList.toggle("dark", settings.theme === "dark");
  const size = FONT_SIZES[settings.fontSize] ?? 14;
  document.documentElement.style.setProperty("--app-font-size", `${size}px`);
}

const initial = { settings: DEFAULT_SETTINGS };

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      ...initial,
      update: (patch) =>
        set((state) => {
          const next = { ...state.settings, ...patch };
          applyToDocument(next);
          return { settings: next };
        }),
      increaseFontSize: () =>
        set((state) => {
          const order = FONT_SIZE_ORDER;
          const currentIndex = order.indexOf(state.settings.fontSize);
          const nextIndex = Math.min(
            order.length - 1,
            currentIndex === -1 ? 2 : currentIndex + 1,
          );
          const next = { ...state.settings, fontSize: order[nextIndex] };
          applyToDocument(next);
          return { settings: next };
        }),
      decreaseFontSize: () =>
        set((state) => {
          const order = FONT_SIZE_ORDER;
          const currentIndex = order.indexOf(state.settings.fontSize);
          const prevIndex = Math.max(0, currentIndex === -1 ? 2 : currentIndex - 1);
          const next = { ...state.settings, fontSize: order[prevIndex] };
          applyToDocument(next);
          return { settings: next };
        }),
      resetFontSize: () =>
        set((state) => {
          const next = { ...state.settings, fontSize: "normal" as FontSize };
          applyToDocument(next);
          return { settings: next };
        }),
    }),
    {
      name: "gemini-desktop.settings",
      partialize: (s) => ({ settings: s.settings }),
      onRehydrateStorage: () => (state) => {
        if (state) applyToDocument(state.settings);
      },
    },
  ),
);

/** Force-apply persisted settings on boot (before rehydration completes). */
export function hydrateSettings() {
  try {
    const raw = localStorage.getItem("gemini-desktop.settings");
    if (!raw) {
      applyToDocument(DEFAULT_SETTINGS);
      return;
    }
    const parsed = JSON.parse(raw) as { settings?: Partial<Settings> };
    const settings = { ...DEFAULT_SETTINGS, ...(parsed.settings ?? {}) };
    applyToDocument(settings);
  } catch {
    applyToDocument(DEFAULT_SETTINGS);
  }
}