import { FileText, File, X, Loader2 } from "lucide-react";
import { attachmentSrc } from "@/lib/tauri";
import type { AttachState } from "./Composer";
import { formatBytes } from "@/lib/utils";
import { useUiStore } from "@/stores/ui";

export function AttachmentPreview({
  attach,
  onRemove,
  disabled,
}: {
  attach: AttachState;
  onRemove: (id: string) => void;
  disabled: boolean;
}) {
  const setPreview = useUiStore((s) => s.setAttachmentPreview);
  const { attachment, status, error } = attach;
  const isImage = attachment.kind === "image";

  return (
    <div
      className="message-in group relative flex items-center gap-2 rounded-md border border-border bg-secondary/60 px-2 py-1.5 pr-8"
      data-status={status}
    >
      {status === "saving" ? (
        <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
      ) : isImage ? (
        <button
          type="button"
          onClick={() =>
            setPreview({
              src: attachmentSrc(attachment.path),
              filename: attachment.filename,
              kind: attachment.kind,
              size: attachment.size,
              path: attachment.path,
            })
          }
          className="overflow-hidden rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          aria-label={`Preview ${attachment.filename}`}
        >
          <img
            src={attachmentSrc(attachment.path)}
            alt={attachment.filename}
            className="h-10 w-10 rounded-sm object-cover"
            draggable={false}
          />
        </button>
      ) : attachment.kind === "pdf" ? (
        <FileText className="h-4 w-4 shrink-0 text-red-400/80" />
      ) : (
        <File className="h-4 w-4 shrink-0 text-muted-foreground" />
      )}

      <div className="min-w-0">
        <p className="max-w-48 truncate text-xs">{attachment.filename}</p>
        <p className="text-[10px] text-muted-foreground">
          {status === "saving"
            ? "Importing…"
            : status === "error"
              ? error || "Failed to attach"
              : formatBytes(attachment.size)}
        </p>
      </div>

      {status !== "saving" && (
        <button
          type="button"
          onClick={() => onRemove(attach.attachment.id)}
          disabled={disabled}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-40"
          aria-label={`Remove ${attachment.filename}`}
          title="Remove attachment"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}