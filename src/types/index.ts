export type Role = "user" | "model";
export type AttachmentKind = "image" | "pdf" | "text" | "file";

export interface Attachment {
  id: string;
  filename: string;
  mimeType: string;
  kind: AttachmentKind;
  size: number;
  /** Absolute path of the stored file inside the app data dir. */
  path: string;
}

export interface Message {
  id: string;
  conversationId: string;
  role: Role;
  content: string;
  createdAt: string;
  sequence: number;
  attachments: Attachment[];
}

export interface Conversation {
  id: string;
  title: string;
  model: string;
  createdAt: string;
  updatedAt: string;
}

export interface SearchResult {
  conversationId: string;
  title: string;
  snippet: string;
  updatedAt: string;
}

export type GenerationStatus = "idle" | "streaming";

export interface GenerationErrorShape {
  title: string;
  message: string;
  /** Category used to present friendly, actionable errors. */
  kind:
    | "missing-key"
    | "invalid-key"
    | "rate-limit"
    | "network"
    | "model"
    | "prompt-blocked"
    | "file"
    | "unknown";
}

export interface AppPaths {
  dataDir: string;
  configDir: string;
  dbPath: string;
  attachmentsDir: string;
}

/** What the right-side attachment preview drawer shows. */
export interface AttachmentPreview {
  /** Browser-usable URL (asset protocol in Tauri, blob: URL in preview). */
  src: string;
  filename: string;
  kind: AttachmentKind;
  size?: number;
  /** Absolute path when running inside Tauri (needed to read text files). */
  path?: string;
}

export type Theme = "dark" | "light";
export type FontSize = "small" | "normal" | "large" | "xlarge";
export type SidebarBehavior = "persistent" | "auto";

export interface Settings {
  theme: Theme;
  startMaximized: boolean;
  sidebarBehavior: SidebarBehavior;
  fontSize: FontSize;
  defaultModel: string;
  temperature: number;
  maxOutputTokens: number;
}

export const DEFAULT_SETTINGS: Settings = {
  theme: "dark",
  startMaximized: false,
  sidebarBehavior: "persistent",
  fontSize: "normal",
  defaultModel: "gemini-2.5-flash",
  temperature: 1,
  maxOutputTokens: 8192,
};

export const FONT_SIZES: Record<FontSize, number> = {
  small: 13,
  normal: 14,
  large: 15.5,
  xlarge: 17,
};