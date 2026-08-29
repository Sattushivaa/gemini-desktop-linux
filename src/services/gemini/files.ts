import { GoogleGenAI, type Part } from "@google/genai";
import { invoke } from "@tauri-apps/api/core";
import type { Attachment } from "@/types";

export interface PromptAttachment {
  attachment: Attachment;
  /** Original File object when the attachment came from a drop/paste this session. */
  file?: File;
}

/** Gemini's inline-data limit is 20 MB per part. Stay comfortably below. */
export const INLINE_LIMIT = 19 * 1024 * 1024;
/** Practical ceiling for a single attachment through the webview. */
export const MAX_ATTACHMENT = 50 * 1024 * 1024;

/** Files that we actually let the user attach. */
export const ACCEPTED_EXTENSIONS = new Set([
  "png", "jpg", "jpeg", "gif", "webp", "bmp", "svg",
  "pdf",
  "txt", "md", "markdown", "csv", "json", "html", "htm", "xml", "yaml", "yml",
  "toml", "log", "py", "js", "mjs", "cjs", "ts", "tsx", "jsx", "rs", "c", "h",
  "cpp", "cc", "hpp", "go", "java", "rb", "php", "sh", "bash", "zsh", "sql", "lua",
]);

const TEXT_MIME_PREFIXES = [
  "text/",
  "application/json",
  "application/xml",
  "application/x-",
  "application/javascript",
];

export function isAcceptedFile(name: string, mimeType: string): boolean {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (ACCEPTED_EXTENSIONS.has(ext)) return true;
  if (mimeType.startsWith("image/")) return true;
  if (TEXT_MIME_PREFIXES.some((p) => mimeType.startsWith(p))) return true;
  return false;
}

export function kindOf(_name: string, mimeType: string): Attachment["kind"] {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType === "application/pdf") return "pdf";
  if (
    mimeType.startsWith("text/") ||
    TEXT_MIME_PREFIXES.some((p) => mimeType.startsWith(p))
  ) {
    return "text";
  }
  return "file";
}

async function readBase64(path: string): Promise<string> {
  const out = await invoke<string | null>("read_file_base64", {
    path,
    maxBytes: MAX_ATTACHMENT,
  });
  if (!out) throw new Error("file_too_large");
  return out;
}

async function readText(path: string): Promise<string> {
  const out = await invoke<string | null>("read_file_text", {
    path,
    maxBytes: INLINE_LIMIT,
  });
  if (out === null) throw new Error("file_too_large");
  return out;
}

/**
 * Turns a stored attachment into a Gemini API `Part`.
 * - small files / all images: inline base64 data
 * - text/source files: embedded as a labelled text block
 * - large files: uploaded through the Gemini Files API (fileData reference)
 */
export async function attachmentToPart(
  ai: GoogleGenAI,
  input: PromptAttachment,
): Promise<Part> {
  const { attachment, file } = input;

  if (attachment.kind === "text") {
    const text =
      file && typeof file.text === "function"
        ? await file.text()
        : await readText(attachment.path);
    return {
      text: `\`\`\`${attachment.filename}\n${text}\n\`\`\``,
    };
  }

  const bytes = file?.size ? await file.arrayBuffer() : await base64ToBytes(await readBase64(attachment.path));

  if (bytes.byteLength <= INLINE_LIMIT) {
    const data = uint8ToBase64(bytes);
    return {
      inlineData: { mimeType: attachment.mimeType, data },
    };
  }

  // Large file: upload through the Files API (supports up to ~2GB).
  const blob = new Blob([bytes], { type: attachment.mimeType });
  const uploaded = await ai.files.upload({
    file: blob,
    config: { mimeType: attachment.mimeType, displayName: attachment.filename },
  });
  const uri = uploaded.uri;
  if (!uri) throw new Error("upload_failed");
  return {
    fileData: { fileUri: uri, mimeType: attachment.mimeType },
  };
}

async function base64ToBytes(b64: string): Promise<Uint8Array> {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function uint8ToBase64(bytes: Uint8Array | ArrayBuffer): string {
  let binary = "";
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const chunk = 0x8000;
  for (let i = 0; i < view.length; i += chunk) {
    binary += String.fromCharCode.apply(
      null,
      Array.from(view.subarray(i, i + chunk)),
    );
  }
  return btoa(binary);
}

/**
 * Validates a file the user tried to attach. Throws a human-readable Error
 * when the file can't be used with Gemini.
 */
export function validateAttachment(
  filename: string,
  size: number,
  mimeType: string,
): void {
  if (!isAcceptedFile(filename, mimeType)) {
    throw new Error(
      `Unsupported file type "${mimeType || filename}". Gemini supports images, PDFs and common text/source files.`,
    );
  }
  if (size > MAX_ATTACHMENT) {
    throw new Error(
      `"${filename}" is larger than 50 MB, which this desktop client can handle.`,
    );
  }
  if (size === 0) {
    throw new Error(`"${filename}" is empty.`);
  }
}