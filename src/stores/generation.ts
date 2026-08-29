import { create } from "zustand";
import type { GenerationErrorShape, GenerationStatus } from "@/types";

interface GenerationState {
  status: GenerationStatus;
  /** Streamed text of the in-flight model response. */
  text: string;
  error: GenerationErrorShape | null;
  startedAt: number | null;
  /** True when the model response finished (committed) or was cancelled. */
  completed: boolean;

  start: () => void;
  append: (delta: string) => void;
  setError: (error: GenerationErrorShape) => void;
  finish: () => void;
  reset: () => void;
}

export const useGenerationStore = create<GenerationState>((set) => ({
  status: "idle",
  text: "",
  error: null,
  startedAt: null,
  completed: false,

  start: () =>
    set({ status: "streaming", text: "", error: null, startedAt: Date.now(), completed: false }),
  append: (delta) => set((s) => ({ text: s.text + delta })),
  setError: (error) => set({ error, status: "idle", completed: true }),
  finish: () => set({ status: "idle", completed: true }),
  reset: () =>
    set({
      status: "idle",
      text: "",
      error: null,
      startedAt: null,
      completed: false,
    }),
}));