import { useCallback, useLayoutEffect, useRef } from "react";
import { Sparkles } from "lucide-react";
import { useConversationStore } from "@/stores/conversations";
import { useGenerationStore } from "@/stores/generation";
import { useSettingsStore } from "@/stores/settings";
import { useUiStore } from "@/stores/ui";
import { Message } from "@/components/chat/Message";
import { StreamingMessage } from "@/components/chat/StreamingMessage";
import { Composer } from "@/components/composer/Composer";
import { Button } from "@/components/ui/button";
import { useSendMessage } from "@/hooks/useSendMessage";

function EmptyState() {
  const { send } = useSendMessage();
  const defaultModel = useSettingsStore((s) => s.settings.defaultModel);
  const prompts = [
    { label: "Code", text: "Write a function to reverse a string in Python." },
    { label: "Learn", text: "Give me a step-by-step plan to learn Rust in three months." },
    { label: "Compare", text: "Summarize the key differences between WebP and AVIF." },
    { label: "Write", text: "Help me draft a concise weekly stand-up update." },
    { label: "Health", text: "Suggest a healthy 15-minute morning routine." },
  ];
  return (
    <div className="flex h-full flex-col items-center justify-center px-6 text-center">
      <svg viewBox="0 0 128 128" className="mb-5 h-14 w-14 text-primary/90">
        <path d="M64 26 L72.5 55.5 L102 64 L72.5 72.5 L64 102 L55.5 72.5 L26 64 L55.5 55.5 Z" fill="currentColor" />
      </svg>
      <h1 className="text-2xl font-semibold tracking-tight">How can I help today?</h1>
      <p className="mt-1.5 max-w-md text-sm text-muted-foreground">
        Ask anything, attach images or documents, and work across past conversations — all
        locally, native on your desktop.
      </p>
      <div className="mt-5 flex max-w-md flex-wrap items-center justify-center gap-2">
        {prompts.map((p) => (
          <Button
            key={p.label}
            variant="outline"
            size="sm"
            onClick={() => void send({ text: p.text, model: defaultModel })}
          >
            <Sparkles className="mr-1.5 h-3.5 w-3.5" /> {p.label}
          </Button>
        ))}
      </div>
    </div>
  );
}

export function ChatPage() {
  const messages = useConversationStore((s) => s.messages);
  const { retryLast } = useSendMessage();
  const setSettingsOpen = useUiStore((s) => s.setSettingsOpen);
  const status = useGenerationStore((s) => s.status);
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (el && (stickToBottom.current || status === "streaming")) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages, status]);

  const onScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  }, []);

  const onRetry = useCallback(() => {
    void retryLast();
  }, [retryLast]);

  const onOpenSettings = useCallback(() => setSettingsOpen(true), [setSettingsOpen]);

  return (
    <main className="flex h-full min-w-0 flex-1 flex-col">
      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="flex min-h-0 flex-1 flex-col overflow-y-auto"
        data-testid="message-scroller"
      >
        <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-5 px-4 py-6">
          {messages.length === 0 ? (
            <div className="flex flex-1 items-center">
              <EmptyState />
            </div>
          ) : (
            <>
              {messages.map((m) => (
                <Message key={m.id} message={m} />
              ))}
              <StreamingMessage onRetry={onRetry} onOpenSettings={onOpenSettings} />
            </>
          )}
        </div>
      </div>
      <Composer />
    </main>
  );
}