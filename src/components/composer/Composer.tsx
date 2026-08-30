import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { ArrowUp, Paperclip, Square, AlertCircle } from "lucide-react";
import { open } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { homeDir } from "@tauri-apps/api/path";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import type { Attachment } from "@/types";
import { cn, uid } from "@/lib/utils";
import { isTauri } from "@/lib/tauri";
import { Button } from "@/components/ui/button";
import { AttachmentPreview } from "./AttachmentPreview";
import { ModelSelector } from "./ModelSelector";
import { validateAttachment, kindOf } from "@/services/gemini/files";
import { useSendMessage, stopGeneration } from "@/hooks/useSendMessage";
import { useConversationStore } from "@/stores/conversations";
import { useGenerationStore } from "@/stores/generation";
import { useSettingsStore } from "@/stores/settings";

export interface AttachState {
  attachment: Attachment;
  file: File | null;
  status: "saving" | "ready" | "error";
  error?: string;
}

const MAX_COMPOSER_HEIGHT = 220;

export function Composer() {
  const { send } = useSendMessage();
  const activeConversation = useConversationStore((s) => s.activeConversation);
  const defaultModel = useSettingsStore((s) => s.settings.defaultModel);

  const [text, setText] = useState("");
  const [pending, setPending] = useState<AttachState[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState<string>(
    activeConversation?.model ?? defaultModel,
  );
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const generating = useGenerationStore((s) => s.status === "streaming");

  // Sync the selector with the active conversation model.
  useEffect(() => {
    setSelectedModel(activeConversation?.model ?? defaultModel);
  }, [activeConversation?.model, defaultModel]);

  // Auto-grow textarea.
  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, MAX_COMPOSER_HEIGHT)}px`;
  }, [text]);

  const setModel = useCallback(
    (model: string) => {
      setSelectedModel(model);
      if (activeConversation) {
        void useConversationStore.getState().setConversationModel(activeConversation.id, model);
      }
    },
    [activeConversation],
  );

  const clearAttachments = () => setPending([]);

  const focusComposer = useCallback(() => {
    requestAnimationFrame(() => {
      textareaRef.current?.focus();
    });
  }, []);

  const addAttachments = useCallback(
    async (inputs: { path?: string; file?: File; name: string; mimeType?: string; size?: number }[]) => {
      const next: AttachState[] = [];
      const errors: string[] = [];
      for (const input of inputs) {
        const rawName = input.name || "attachment";
        const mime = input.mimeType ?? input.file?.type ?? "application/octet-stream";
        const rawSize = input.size ?? input.file?.size ?? 0;
        const id = uid("att");

        // For path-based files (native file picker / drag-drop in Tauri), we don't
        // know the real size or MIME yet — Rust will infer them. Only validate
        // client-side when we actually have a File object with real metadata.
        const hasKnownSize = !input.path && (input.file != null || input.size != null);
        if (hasKnownSize) {
          try {
            validateAttachment(rawName, rawSize, mime);
          } catch (e) {
            errors.push(e instanceof Error ? e.message : "Unsupported file");
            continue;
          }
        }

        next.push({
          attachment: {
            id,
            filename: rawName,
            mimeType: mime,
            size: rawSize,
            kind: "file",
            path: "",
          },
          file: input.file ?? null,
          status: "saving",
        });
        setPending((cur) => [...cur, next[next.length - 1]]);

        try {
          let stored: Attachment;
          if (!isTauri()) {
            // Browser preview has no native file store; keep an object URL so
            // the thumbnail is still previewable this session.
            stored = {
              id,
              filename: rawName,
              mimeType: mime,
              kind: kindOf(rawName, mime),
              size: rawSize,
              path: input.file ? URL.createObjectURL(input.file) : "",
            };
          } else {
            stored = input.path
              ? await invoke<Attachment>("save_attachment", {
                  sourcePath: input.path,
                  filename: rawName,
                  mimeType: mime === "application/octet-stream" ? undefined : mime,
                })
              : await invoke<Attachment>("save_attachment_data", {
                  filename: rawName,
                  dataBase64: await fileToBase64(input.file!),
                  mimeType: mime,
                });
          }

          // Post-save validation with the real size from the stored file.
          if (input.path) {
            try {
              validateAttachment(stored.filename, stored.size, stored.mimeType);
            } catch (e) {
              errors.push(e instanceof Error ? e.message : "Unsupported file");
              next[next.length - 1] = {
                attachment: next[next.length - 1].attachment,
                file: input.file ?? null,
                status: "error",
                error: e instanceof Error ? e.message : "Unsupported file",
              };
              setPending((cur) => cur.map((a) => (a.attachment.id === id ? next[next.length - 1] : a)));
              continue;
            }
          }

          next[next.length - 1] = {
            attachment: stored,
            file: input.file ?? null,
            status: "ready",
          };
        } catch (e2) {
          next[next.length - 1] = {
            attachment: next[next.length - 1].attachment,
            file: input.file ?? null,
            status: "error",
            error: e2 instanceof Error ? e2.message : "Failed to import file",
          };
        }
        setPending((cur) => cur.map((a) => (a.attachment.id === id ? next[next.length - 1] : a)));
      }
      if (errors.length > 0) {
        setBanner(errors[0]);
        window.setTimeout(() => setBanner(null), 5000);
      }
      focusComposer();
    },
    [focusComposer],
  );

  const pickFiles = useCallback(async () => {
    if (!isTauri()) {
      fileInputRef.current?.click();
      return;
    }
    try {
      let defaultPath: string | undefined;
      try {
        defaultPath = await homeDir();
      } catch {
        // fallback
      }

      const paths = await open({
        multiple: true,
        directory: false,
        title: "Attach files",
        defaultPath,
        filters: [
          { name: "All files", extensions: ["*"] },
          { name: "Images", extensions: ["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg"] },
          {
            name: "Documents & source",
            extensions: [
              "pdf", "txt", "md", "markdown", "csv", "json", "html", "htm", "xml", "yaml", "yml",
              "toml", "log", "py", "js", "mjs", "cjs", "ts", "tsx", "jsx", "rs", "c", "h", "cpp",
              "cc", "hpp", "go", "java", "rb", "php", "sh", "bash", "zsh", "sql", "lua",
            ],
          },
        ],
      });
      if (!paths) return;
      const list = Array.isArray(paths) ? paths : [paths];
      const inputs = list.map((p) => {
        const name = p.split("/").pop() ?? p;
        return { path: p, name };
      });
      if (inputs.length > 0) void addAttachments(inputs);
      focusComposer();
    } catch {
      setBanner("Unable to open the file picker.");
    }
  }, [addAttachments, focusComposer]);

  // Native window drag & drop gives real file paths in Tauri.
  useEffect(() => {
    if (!isTauri()) return;
    let cancelled = false;
    let unlisten: (() => void) | null = null;
    getCurrentWebviewWindow()
      .onDragDropEvent((ev) => {
        const { payload } = ev;
        if (payload.type === "over") {
          setDragOver(true);
        } else if (payload.type === "leave") {
          setDragOver(false);
        } else if (payload.type === "drop") {
          setDragOver(false);
          if (cancelled) return;
          const inputs = payload.paths.map((p) => {
            const name = p.split("/").pop() ?? p;
            return { path: p, name };
          });
          if (inputs.length > 0) void addAttachments(inputs);
        }
      })
      .then((fn) => {
        unlisten = fn;
      });
    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, [addAttachments]);

  // Browser preview: HTML5 drag & drop exposes File objects directly.
  const onBrowserDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const files = Array.from(e.dataTransfer?.files ?? []);
      if (files.length === 0) return;
      const inputs = files.map((f) => ({ file: f, name: f.name, mimeType: f.type }));
      void addAttachments(inputs);
    },
    [addAttachments],
  );

  // Paste support: images, file blobs, and copied files from file managers.
  const onPaste = useCallback(
    async (e: React.ClipboardEvent | ClipboardEvent) => {
      // 1. Check for binary File blobs (e.g. pasted screenshots / images).
      const items = Array.from(e.clipboardData?.items ?? []);
      const blobs: File[] = [];
      for (const item of items) {
        if (item.kind === "file") {
          const file = item.getAsFile();
          if (file) blobs.push(file);
        }
      }
      const directFiles = Array.from(e.clipboardData?.files ?? []);
      for (const f of directFiles) {
        if (!blobs.some((b) => b.name === f.name && b.size === f.size)) {
          blobs.push(f);
        }
      }
      if (blobs.length > 0) {
        e.preventDefault();
        const inputs = blobs.map((f) => ({
          file: f,
          name: f.name || "screenshot.png",
          mimeType: f.type || "image/png",
        }));
        void addAttachments(inputs);
        focusComposer();
        return;
      }

      // 2. Check for copied files from file managers (text/uri-list, x-special/gnome-copied-files, or text/plain).
      const uriList = e.clipboardData?.getData("text/uri-list");
      const gnomeFiles = e.clipboardData?.getData("x-special/gnome-copied-files");
      const plainText = e.clipboardData?.getData("text/plain");

      const candidateUris: string[] = [];

      if (gnomeFiles) {
        const lines = gnomeFiles.split(/[\r\n]+/).map((l) => l.trim()).filter(Boolean);
        for (const line of lines) {
          if (line.startsWith("file://")) {
            candidateUris.push(line);
          }
        }
      }

      if (uriList) {
        const lines = uriList.split(/[\r\n]+/).map((l) => l.trim()).filter(Boolean);
        for (const line of lines) {
          if (!line.startsWith("#") && line.startsWith("file://")) {
            candidateUris.push(line);
          }
        }
      }

      if (plainText) {
        const lines = plainText.split(/[\r\n]+/).map((l) => l.trim()).filter(Boolean);
        const allLookLikePaths =
          lines.length > 0 &&
          lines.every((l) => l.startsWith("file://") || (l.startsWith("/") && !l.includes("\n")));
        if (allLookLikePaths) {
          for (const line of lines) {
            candidateUris.push(line);
          }
        }
      }

      const rawPaths = candidateUris
        .map((uri) => {
          let p = uri;
          if (p.startsWith("file://localhost/")) {
            p = p.slice("file://localhost".length);
          } else if (p.startsWith("file:///")) {
            p = p.slice("file://".length);
          } else if (p.startsWith("file://")) {
            p = p.slice("file:/".length);
          }
          try {
            return decodeURIComponent(p);
          } catch {
            return p;
          }
        })
        .filter((p) => p.length > 0);

      const uniquePaths = Array.from(new Set(rawPaths));

      if (uniquePaths.length > 0 && isTauri()) {
        const existingPaths: string[] = [];
        for (const p of uniquePaths) {
          try {
            const isFile = await invoke<boolean>("check_is_file", { path: p });
            if (isFile) existingPaths.push(p);
          } catch {
            // ignore
          }
        }

        if (existingPaths.length > 0) {
          e.preventDefault();
          const inputs = existingPaths.map((p) => {
            const name = p.split("/").pop() ?? p;
            return { path: p, name };
          });
          void addAttachments(inputs);
          focusComposer();
          return;
        }
      }

      // 3. Fallback for native Linux clipboard images (Flameshot, GIMP, system screenshots)
      if (isTauri()) {
        try {
          const imgBase64 = await invoke<string | null>("read_clipboard_image");
          if (imgBase64) {
            e.preventDefault();
            const stored = await invoke<Attachment>("save_attachment_data", {
              filename: "screenshot.png",
              dataBase64: imgBase64,
              mimeType: "image/png",
            });
            setPending((cur) => [
              ...cur,
              {
                attachment: stored,
                file: null,
                status: "ready",
              },
            ]);
            focusComposer();
            return;
          }
        } catch {
          // ignore
        }
      }
    },
    [addAttachments, focusComposer],
  );

  // Global window paste listener: allows pasting screenshots/files even if textarea lost focus
  useEffect(() => {
    const handleWindowPaste = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          (target.tagName === "TEXTAREA" && target !== textareaRef.current))
      ) {
        return;
      }
      if (target === textareaRef.current) {
        return;
      }
      void onPaste(e);
    };

    window.addEventListener("paste", handleWindowPaste);
    return () => window.removeEventListener("paste", handleWindowPaste);
  }, [onPaste]);

  const removeAttachment = useCallback((id: string) => {
    setPending((cur) => cur.filter((a) => a.attachment.id !== id));
    focusComposer();
  }, [focusComposer]);

  const onSubmit = useCallback(() => {
    if (generating) {
      stopGeneration();
      return;
    }
    const ready = pending.filter((p) => p.status === "ready");
    if (!text.trim() && ready.length === 0) return;
    void send({ text, pendingAttachments: ready, model: selectedModel });
    setText("");
    clearAttachments();
  }, [generating, pending, text, send, selectedModel]);

  const canSend = (text.trim().length > 0 || pending.some((p) => p.status === "ready")) && !generating;

  return (
    <div
      className="relative"
      onDragOver={isTauri() ? undefined : (e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={isTauri() ? undefined : () => setDragOver(false)}
      onDrop={isTauri() ? undefined : onBrowserDrop}
    >
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        aria-hidden="true"
        tabIndex={-1}
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          if (files.length > 0) {
            void addAttachments(
              files.map((f) => ({ file: f, name: f.name, mimeType: f.type })),
            );
          }
          e.target.value = "";
        }}
      />

      {dragOver && (
        <div className="pointer-events-none absolute bottom-full left-0 right-0 z-20 -mb-3 rounded-lg border border-dashed border-ring/50 bg-background/90 p-6 text-center">
          <p className="text-sm text-foreground">Drop files to attach</p>
        </div>
      )}

      <div className="mx-auto w-full max-w-3xl px-4 pb-4">
        {banner && (
          <div
            className="mb-2 flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive"
            role="alert"
          >
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{banner}</span>
          </div>
        )}

        {pending.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2">
            {pending.map((a) => (
              <AttachmentPreview
                key={a.attachment.id}
                attach={a}
                onRemove={removeAttachment}
                disabled={generating}
              />
            ))}
          </div>
        )}

        <div
          className={cn(
            "flex flex-col rounded-2xl border bg-card transition-colors focus-within:border-ring/60",
            generating && "border-ring/30",
          )}
          data-testid="composer"
        >
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                onSubmit();
              } else if (e.key === "Escape" && generating) {
                e.preventDefault();
                stopGeneration();
              }
            }}
            onPaste={onPaste}
            rows={1}
            placeholder="Ask Gemini..."
            aria-label="Message Gemini"
            className="max-h-[220px] w-full resize-none bg-transparent px-3.5 py-3 text-[0.9375rem] leading-relaxed placeholder:text-muted-foreground focus:outline-none"
          />
          <div className="flex items-center gap-1 border-t border-border px-2 py-1.5">
            <ModelSelector value={selectedModel} onChange={setModel} disabled={generating} />
            <div className="flex-1" />
            <Button
              type="button"
              variant="ghost"
              size="iconSm"
              onClick={() => void pickFiles()}
              disabled={generating}
              aria-label="Attach file"
              title="Attach a file (images, PDFs, text/source)"
            >
              <Paperclip className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              onClick={onSubmit}
              disabled={!canSend}
              className="h-8 w-8 rounded-full p-0"
              data-testid="send-button"
              aria-label={generating ? "Stop generating" : "Send message"}
              title={generating ? "Stop generating (Esc)" : "Send (Enter)"}
              variant={generating ? "destructive" : "default"}
            >
              {generating ? <Square className="h-3.5 w-3.5" /> : <ArrowUp className="h-4 w-4" />}
            </Button>
          </div>
        </div>
        <p className="mt-1.5 text-center text-[10px] text-muted-foreground">
          Gemini can make mistakes. Double-check important information.
        </p>
      </div>
    </div>
  );
}

async function fileToBase64(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  let binary = "";
  const view = new Uint8Array(buf);
  const chunk = 0x8000;
  for (let i = 0; i < view.length; i += chunk) {
    binary += String.fromCharCode.apply(null, Array.from(view.subarray(i, i + chunk)));
  }
  return btoa(binary);
}