import { memo } from "react";
import { Check, Copy } from "lucide-react";
import type { Message as MessageType } from "@/types";
import { Markdown } from "./Markdown";
import { AttachmentView } from "./AttachmentView";
import { Avatar } from "./Avatar";
import { useCopyText } from "@/hooks/useCopyText";

export const ModelAvatar = () => <Avatar variant="model" />;
export const UserAvatar = () => <Avatar variant="user" />;

const MessageBubble = memo(function MessageBubble({
  message,
  isStreaming,
}: {
  message: MessageType;
  isStreaming: boolean;
}) {
  const copied = useCopyText(message.content);

  if (message.role === "user") {
    return (
      <div
        className="message-in flex flex-col items-end gap-2"
        data-testid="user-message"
      >
        <AttachmentView attachments={message.attachments} className="justify-end" />
        <div className="max-w-[82%] whitespace-pre-wrap rounded-lg rounded-tr-sm border border-border bg-secondary/70 px-3.5 py-2.5 text-[0.9375rem] leading-relaxed">
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className="message-in flex gap-3" data-testid="model-message">
      <div className="mt-0.5 shrink-0">
        <ModelAvatar />
      </div>
      <div className="group min-w-0 flex-1">
        <div className="mb-0.5 flex items-center gap-2">
          <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Gemini
          </span>
          <button
            type="button"
            onClick={() => copied.copy()}
            className="rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-accent hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100"
            aria-label="Copy response"
            title="Copy response"
          >
            {copied.copied ? <Check className="h-3.5 w-3.5 text-primary" /> : <Copy className="h-3.5 w-3.5" />}
          </button>
        </div>
        <div className="min-w-0">
          <Markdown content={message.content} />
          {isStreaming && <span className="stream-cursor" aria-hidden="true" />}
        </div>
        <AttachmentView attachments={message.attachments} className="mt-2" />
      </div>
    </div>
  );
});

interface MessageProps {
  message: MessageType;
  isStreaming?: boolean;
}

export function Message({ message, isStreaming = false }: MessageProps) {
  return <MessageBubble message={message} isStreaming={isStreaming} />;
}