import { ImageIcon, FileText, File } from "lucide-react";
import { attachmentSrc } from "@/lib/tauri";
import type { Attachment } from "@/types";
import { cn, formatBytes } from "@/lib/utils";
import { useUiStore } from "@/stores/ui";

function previewFor(attachment: Attachment) {
  return {
    src: attachmentSrc(attachment.path),
    filename: attachment.filename,
    kind: attachment.kind,
    size: attachment.size,
    path: attachment.path,
  };
}

function AttachmentThumbnail({ attachment }: { attachment: Attachment }) {
  const setPreview = useUiStore((s) => s.setAttachmentPreview);
  const url = attachmentSrc(attachment.path);
  return (
    <button
      type="button"
      onClick={() => setPreview(previewFor(attachment))}
      className="group relative overflow-hidden rounded-md border border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
      aria-label={`Preview ${attachment.filename}`}
      title={attachment.filename}
    >
      <img
        src={url}
        alt={attachment.filename}
        className="h-20 w-20 object-cover transition-transform group-hover:scale-[1.04]"
        draggable={false}
      />
      <span className="absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/20" />
    </button>
  );
}

function AttachmentChip({ attachment }: { attachment: Attachment }) {
  const setPreview = useUiStore((s) => s.setAttachmentPreview);
  const Icon = attachment.kind === "pdf" ? FileText : File;
  return (
    <button
      type="button"
      onClick={() => setPreview(previewFor(attachment))}
      className={cn(
        "flex w-fit max-w-56 cursor-pointer items-center gap-2 rounded-md border border-border bg-secondary/50 px-2.5 py-1.5",
        "transition-colors hover:border-ring/40 hover:bg-secondary",
      )}
      aria-label={`Preview ${attachment.filename}`}
      title={`Preview ${attachment.filename}`}
    >
      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
      <span className="truncate text-xs">{attachment.filename}</span>
      <span className="shrink-0 text-[10px] text-muted-foreground">
        {formatBytes(attachment.size)}
      </span>
    </button>
  );
}

export function AttachmentView({
  attachments,
  className,
}: {
  attachments: Attachment[];
  className?: string;
}) {
  if (attachments.length === 0) return null;
  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {attachments.map((a) =>
        a.kind === "image" ? (
          <AttachmentThumbnail key={a.id} attachment={a} />
        ) : (
          <AttachmentChip key={a.id} attachment={a} />
        ),
      )}
    </div>
  );
}

export { ImageIcon };