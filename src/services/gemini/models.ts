export interface ModelDef {
  id: string;
  name: string;
  description: string;
  supportsFiles: boolean;
  supportsImages: boolean;
  supportsPdf: boolean;
}

/**
 * Models available through the Gemini API. Kept as a single source of truth so
 * the selector and the API layer stay in sync. When a model becomes
 * unavailable the API layer surfaces a friendly error and the selector can be
 * extended (or reduced) via the settings screen.
 *
 * See the current model list at https://ai.google.dev/gemini-api/docs/models
 */
export const MODELS: ModelDef[] = [
  {
    id: "gemini-2.5-flash",
    name: "Gemini 2.5 Flash",
    description: "Fast, hybrid-reasoning workhorse with a 1M token context.",
    supportsFiles: true,
    supportsImages: true,
    supportsPdf: true,
  },
  {
    id: "gemini-2.5-pro",
    name: "Gemini 2.5 Pro",
    description: "Most capable model, best for complex reasoning and coding.",
    supportsFiles: true,
    supportsImages: true,
    supportsPdf: true,
  },
  {
    id: "gemini-2.5-flash-lite",
    name: "Gemini 2.5 Flash-Lite",
    description: "Smallest and most cost-effective model for high volume.",
    supportsFiles: true,
    supportsImages: false,
    supportsPdf: false,
  },
] as const;

export function getModel(id: string): ModelDef {
  return MODELS.find((m) => m.id === id) ?? MODELS[0];
}

export function isDefaultModel(id: string): boolean {
  return MODELS.some((m) => m.id === id);
}