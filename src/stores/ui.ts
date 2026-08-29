import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AttachmentPreview } from "@/types";

interface UiState {
  sidebarCollapsed: boolean;
  commandPaletteOpen: boolean;
  settingsOpen: boolean;
  searchOpen: boolean;
  searchQuery: string;
  attachmentPreview: AttachmentPreview | null;
  previewWidth: number;

  toggleSidebar: () => void;
  setSidebarCollapsed: (v: boolean) => void;
  setCommandPaletteOpen: (v: boolean) => void;
  setSettingsOpen: (v: boolean) => void;
  setSearchOpen: (v: boolean) => void;
  setSearchQuery: (v: string) => void;
  setAttachmentPreview: (p: AttachmentPreview | null) => void;
  setPreviewWidth: (w: number) => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      commandPaletteOpen: false,
      settingsOpen: false,
      searchOpen: false,
      searchQuery: "",
      attachmentPreview: null,
      previewWidth: 480,

      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setSidebarCollapsed: (v) => set({ sidebarCollapsed: v }),
      setCommandPaletteOpen: (v) => set({ commandPaletteOpen: v }),
      setSettingsOpen: (v) => set({ settingsOpen: v }),
      setSearchOpen: (v) => set({ searchOpen: v, searchQuery: v ? "" : "" }),
      setSearchQuery: (v) => set({ searchQuery: v }),
      setAttachmentPreview: (p) => set({ attachmentPreview: p }),
      setPreviewWidth: (w) => set({ previewWidth: w }),
    }),
    {
      name: "gemini-desktop.ui",
      partialize: (s) => ({ sidebarCollapsed: s.sidebarCollapsed, previewWidth: s.previewWidth }),
    },
  ),
);