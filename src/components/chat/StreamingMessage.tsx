import { Button } from "@/components/ui/button";
import { Markdown } from "./Markdown";
import { ModelAvatar } from "./Message";
import { AlertTriangle } from "lucide-react";
import { useGenerationStore } from "@/stores/generation";
import { useRafThrottledValue } from "@/hooks/useRafThrottledValue";

interface StreamingMessageProps {
  onRetry: () => void;
  onOpenSettings: () => void;
}

export function StreamingMessage({ onRetry, onOpenSettings }: StreamingMessageProps) {
  const status = useGenerationStore((s) => s.status);
  const rawText = useGenerationStore((s) => s.text);
  const error = useGenerationStore((s) => s.error);
  const text = useRafThrottledValue(rawText);

  if (status !== "streaming" && !error) return null;

  if (error) {
    return (
      <div className="message-in flex gap-3" data-testid="generation-error">
        <div className="mt-0.5 shrink-0">
          <ModelAvatar />
        </div>
        <div className="min-w-0 flex-1 rounded-md border border-destructive/40 bg-destructive/5 px-4 py-3">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <div className="min-w-0">
              <p className="text-sm font-medium">{error.title}</p>
              <p className="mt-0.5 text-sm text-muted-foreground">{error.message}</p>
              <div className="mt-3 flex gap-2">
                <Button size="sm" variant="secondary" onClick={onRetry}>
                  Retry
                </Button>
                {error.kind === "missing-key" && (
                  <Button size="sm" variant="outline" onClick={onOpenSettings}>
                    Open settings
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="message-in flex gap-3" data-testid="streaming-message">
      <div className="mt-0.5 shrink-0">
        <ModelAvatar />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          Gemini
        </span>
        {text ? (
          <div className="min-w-0">
            <Markdown content={text} />
            <span className="stream-cursor" aria-hidden="true" />
          </div>
        ) : (
          <div
            className="flex items-center gap-1.5 px-1 py-1"
            role="status"
            aria-label="Gemini is generating"
          >
            <span className="text-xs text-muted-foreground">Thinking</span>
            <span className="flex items-center gap-1">
              {[0, 1, 2].map((i) => (
                <span key={i} className="pulse-dot h-1.5 w-1.5 rounded-full bg-muted-foreground" />
              ))}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}