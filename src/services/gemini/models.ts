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
    id: "gemini-3.7-flash",
    name: "Gemini 3.7 Flash",
    description: "State-of-the-art hybrid reasoning model with superior speed and multimodal quality.",
    supportsFiles: true,
    supportsImages: true,
    supportsPdf: true,
  },
  {
    id: "gemini-3.7-pro",
    name: "Gemini 3.7 Pro",
    description: "Most capable flagship model for complex coding, STEM, and advanced reasoning.",
    supportsFiles: true,
    supportsImages: true,
    supportsPdf: true,
  },
  {
    id: "gemini-3.1-flash",
    name: "Gemini 3.1 Flash",
    description: "High-speed 3.1 reasoning model with multimodal capabilities.",
    supportsFiles: true,
    supportsImages: true,
    supportsPdf: true,
  },
  {
    id: "gemini-3.1-pro",
    name: "Gemini 3.1 Pro",
    description: "Advanced 3.1 model for deep reasoning and coding.",
    supportsFiles: true,
    supportsImages: true,
    supportsPdf: true,
  },
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
    description: "Most capable 2.5 model for complex reasoning and coding.",
    supportsFiles: true,
    supportsImages: true,
    supportsPdf: true,
  },
  {
    id: "gemini-2.5-flash-lite",
    name: "Gemini 2.5 Flash-Lite",
    description: "Smallest and most cost-effective model for high volume.",
    supportsFiles: true,
    supportsImages: true,
    supportsPdf: true,
  },
  {
    id: "gemini-2.0-flash",
    name: "Gemini 2.0 Flash",
    description: "Fast, versatile multimodal model for general tasks.",
    supportsFiles: true,
    supportsImages: true,
    supportsPdf: true,
  },
  {
    id: "gemini-2.0-flash-lite",
    name: "Gemini 2.0 Flash-Lite",
    description: "Lightweight and responsive model.",
    supportsFiles: true,
    supportsImages: true,
    supportsPdf: true,
  },
  {
    id: "gemini-1.5-flash",
    name: "Gemini 1.5 Flash",
    description: "Fast and versatile performance across a wide range of tasks.",
    supportsFiles: true,
    supportsImages: true,
    supportsPdf: true,
  },
  {
    id: "gemini-1.5-pro",
    name: "Gemini 1.5 Pro",
    description: "Mid-size multimodal model optimized for a wide range of reasoning tasks.",
    supportsFiles: true,
    supportsImages: true,
    supportsPdf: true,
  },
] as const;

export function getModel(id: string): ModelDef {
  return (
    MODELS.find((m) => m.id === id) ?? {
      id,
      name: id,
      description: `Custom model (${id})`,
      supportsFiles: true,
      supportsImages: true,
      supportsPdf: true,
    }
  );
}

export function isDefaultModel(id: string): boolean {
  return MODELS.some((m) => m.id === id);
}