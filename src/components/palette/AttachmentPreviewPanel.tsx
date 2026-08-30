import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { AlertCircle, File, FileCode2, FileText, Image as ImageIcon, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { isTauri } from "@/lib/tauri";
import { formatBytes, clamp } from "@/lib/utils";
import { useUiStore } from "@/stores/ui";
import type { AttachmentPreview } from "@/types";

const PdfViewer = lazy(() =>
  import("@/components/palette/PdfViewer").then((m) => ({ default: m.PdfViewer })),
);

const MIN_WIDTH = 320;

const KIND_LABEL: Partial<Record<AttachmentPreview["kind"], string>> = {
  image: "Image",
  pdf: "PDF",
  text: "Text file",
  file: "File",
};

function KindIcon({ kind }: { kind: AttachmentPreview["kind"] }) {
  if (kind === "image") return <ImageIcon className="h-4 w-4 shrink-0" />;
  if (kind === "pdf") return <FileText className="h-4 w-4 shrink-0" />;
  if (kind === "text") return <FileCode2 className="h-4 w-4 shrink-0" />;
  return <File className="h-4 w-4 shrink-0" />;
}

function TextBody({ preview }: { preview: AttachmentPreview }) {
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    setContent("");

    async function load() {
      try {
        let text: string | null = null;
        if (isTauri() && preview.path) {
          text = await invoke<string | null>("read_file_text", {
            path: preview.path,
            maxBytes: 2 * 1024 * 1024,
          });
        } else if (preview.src) {
          const res = await fetch(preview.src);
          if (!res.ok) throw new Error("read-failed");
          text = (await res.text()).slice(0, 2 * 1024 * 1024);
        } else {
          throw new Error("no-source");
        }
        if (!active) return;
        if (text === null) throw new Error("empty");
        setContent(text);
      } catch {
        if (active) setError("Couldn't read this file as text.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [preview]);

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading…
      </div>
    );
  }
  if (error) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center text-sm text-muted-foreground">
        <AlertCircle className="h-5 w-5" />
        <p>{error}</p>
      </div>
    );
  }
  return (
    <pre className="flex-1 whitespace-pre-wrap break-words bg-muted/30 p-4 font-mono text-[13px] leading-relaxed">
      {content}
    </pre>
  );
}

function PreviewBody({ preview }: { preview: AttachmentPreview }) {
  if (preview.kind === "image") {
    return (
      <div className="flex flex-1 items-center justify-center overflow-auto bg-black/40 p-4">
        <img
          src={preview.src}
          alt={preview.filename}
          className="max-h-full max-w-full rounded-md object-contain"
        />
      </div>
    );
  }
  if (preview.kind === "pdf") {
    return (
      <Suspense
        fallback={
          <div className="flex flex-1 items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading PDF…
          </div>
        }
      >
        <PdfViewer src={preview.src} path={preview.path} />
      </Suspense>
    );
  }
  if (preview.kind === "text") {
    return <TextBody preview={preview} />;
  }
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center text-sm text-muted-foreground">
      <File className="h-10 w-10 opacity-50" />
      <p>No built-in preview for this file type.</p>
      <p className="text-xs">{preview.filename}</p>
    </div>
  );
}

export function AttachmentPreviewPanel() {
  const preview = useUiStore((s) => s.attachmentPreview);
  const setPreview = useUiStore((s) => s.setAttachmentPreview);
  const previewWidth = useUiStore((s) => s.previewWidth);
  const setPreviewWidth = useUiStore((s) => s.setPreviewWidth);
  const open = Boolean(preview);

  const dragStart = useRef<{ x: number; width: number } | null>(null);
  const [dragging, setDragging] = useState(false);

  const clampWidth = useCallback((w: number) => {
    const max = Math.max(MIN_WIDTH, Math.round(window.innerWidth * 0.85));
    return clamp(w, Math.min(MIN_WIDTH, max), max);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPreview(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, setPreview]);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    dragStart.current = { x: e.clientX, width: previewWidth };
    setDragging(true);
  };

  useEffect(() => {
    if (!dragging) return;
    const move = (e: PointerEvent) => {
      if (!dragStart.current) return;
      const next = clampWidth(dragStart.current.width + (dragStart.current.x - e.clientX));
      setPreviewWidth(next);
    };
    const up = () => {
      dragStart.current = null;
      setDragging(false);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [dragging, clampWidth, setPreviewWidth]);

  const width = open ? clampWidth(previewWidth) : 0;

  return (
    <aside
      className={cn(
        "group relative flex h-full shrink-0 flex-col overflow-hidden border-l border-border bg-background",
        open ? "border-l" : "border-l-0",
        dragging && "select-none",
      )}
      style={{ width, minWidth: width, transition: dragging ? "none" : "width 300ms ease-out" }}
      aria-hidden={!open}
      aria-label="Attachment preview"
      data-testid="attachment-preview-panel"
    >
      <div
        className={cn(
          "absolute inset-y-0 -left-1 z-10 flex w-2 cursor-col-resize touch-none items-stretch justify-center",
          !open && "hidden",
        )}
        onPointerDown={onPointerDown}
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize preview panel"
        title="Drag to resize"
      >
        <div className="w-px bg-border opacity-0 transition-opacity group-hover:opacity-100" />
      </div>
      <div
        className={cn("flex h-full w-full flex-col", !open && "pointer-events-none")}
        style={{ minWidth: width }}
      >
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <span className="text-muted-foreground">
            <KindIcon kind={preview?.kind ?? "file"} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{preview?.filename ?? ""}</p>
            <p className="text-[11px] text-muted-foreground">
              {preview ? KIND_LABEL[preview.kind] : ""}
              {preview?.size != null ? ` · ${formatBytes(preview.size)}` : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setPreview(null)}
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            aria-label="Close preview"
            title="Close (Esc)"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex min-h-0 flex-1 flex-col">{open && preview && <PreviewBody preview={preview} />}</div>
      </div>
    </aside>
  );
}