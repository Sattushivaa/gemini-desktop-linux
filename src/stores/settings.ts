import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Settings } from "@/types";
import { DEFAULT_SETTINGS, FONT_SIZES } from "@/types";

interface SettingsState {
  settings: Settings;
  update: (patch: Partial<Settings>) => void;
}

function applyToDocument(settings: Settings) {
  document.documentElement.classList.toggle("dark", settings.theme === "dark");
  document.documentElement.style.setProperty(
    "--app-font-size",
    `${FONT_SIZES[settings.fontSize]}px`,
  );
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