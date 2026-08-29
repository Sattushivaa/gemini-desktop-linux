import { useEffect, useMemo, useState } from "react";
import { Search, Plus, Settings2, PanelLeftClose, PanelLeftOpen, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUiStore } from "@/stores/ui";
import { useConversationStore } from "@/stores/conversations";
import { useSettingsStore } from "@/stores/settings";
import { ConversationList } from "./ConversationList";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { getModel } from "@/services/gemini/models";
import { resolveApiKey } from "@/services/gemini/client";

function SearchResults() {
  const { searchResults, searchQuery, clearSearch, openConversation } =
    useConversationStore();
  if (!searchQuery.trim()) return null;
  if (searchResults.length === 0) {
    return (
      <div className="px-2 py-6 text-center text-xs text-muted-foreground">
        No conversations match “{searchQuery}”.
      </div>
    );
  }
  return (
    <div className="space-y-0.5">
      {searchResults.map((r) => (
        <button
          key={r.conversationId}
          type="button"
          onClick={() => {
            void openConversation(r.conversationId);
            clearSearch();
          }}
          className="flex w-full flex-col gap-0.5 rounded-md px-2 py-1.5 text-left hover:bg-accent"
        >
          <span className="truncate text-[13px] text-foreground">{r.title}</span>
          {r.snippet && (
            <span className="truncate text-[11px] text-muted-foreground">{r.snippet}</span>
          )}
        </button>
      ))}
    </div>
  );
}

export function Sidebar() {
  const collapsed = useUiStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useUiStore((s) => s.toggleSidebar);
  const setSettingsOpen = useUiStore((s) => s.setSettingsOpen);
  const {
    conversations,
    activeConversationId,
    ready,
    newChat,
    openConversation,
    searchQuery,
    search,
  } = useConversationStore();
  const defaultModel = useSettingsStore((s) => s.settings.defaultModel);
  const model = useMemo(
    () => conversations.find((c) => c.id === activeConversationId)?.model ?? defaultModel,
    [conversations, activeConversationId, defaultModel],
  );
  const [keyStatus, setKeyStatus] = useState<"ok" | "missing" | "checking">("checking");
  const [online, setOnline] = useState(navigator.onLine);

  useEffect(() => {
    void resolveApiKey().then((k) => setKeyStatus(k.apiKey ? "ok" : "missing"));
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  if (collapsed) {
    return (
      <aside className="flex w-[52px] shrink-0 flex-col items-center border-r border-border bg-sidebar py-3 transition-[width] duration-200">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={toggleSidebar}
              className="mb-3 rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-foreground"
              aria-label="Expand sidebar"
              title="Expand sidebar"
            >
              <PanelLeftOpen className="h-4 w-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">Expand sidebar</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => void newChat(model)}
              aria-label="New chat"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">New chat (Ctrl+N)</TooltipContent>
        </Tooltip>

        <div className="flex-1" />

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSettingsOpen(true)}
              aria-label="Settings"
            >
              <Settings2 className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">Settings</TooltipContent>
        </Tooltip>
      </aside>
    );
  }

  return (
    <aside className="flex w-[264px] shrink-0 flex-col border-r border-border bg-sidebar transition-[width] duration-200">
      <div className="flex items-center justify-between px-3 pb-2 pt-3">
        <div className="flex items-center gap-2">
          <svg viewBox="0 0 128 128" className="h-5 w-5 text-primary">
            <path d="M64 26 L72.5 55.5 L102 64 L72.5 72.5 L64 102 L55.5 72.5 L26 64 L55.5 55.5 Z" fill="currentColor" />
          </svg>
          <span className="text-sm font-semibold tracking-tight">Gemini Desktop</span>
        </div>
        <button
          type="button"
          onClick={toggleSidebar}
          className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
          aria-label="Collapse sidebar"
          title="Collapse sidebar (Ctrl+Shift+S)"
        >
          <PanelLeftClose className="h-4 w-4" />
        </button>
      </div>

      <div className="flex flex-col gap-2 px-3">
        <Button size="sm" variant="secondary" className="w-full justify-start" onClick={() => void newChat(model)} data-testid="new-chat-button">
          <Plus className="h-4 w-4" /> New chat
        </Button>

        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => void search(e.target.value)}
            placeholder="Search chats…"
            className="h-8 pl-8 pr-7 text-[13px]"
            aria-label="Search conversations"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => void search("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
              aria-label="Clear search"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      <div className="mt-3 flex-1 overflow-y-auto px-2 pb-4">
        {ready ? (
          searchQuery.trim() ? (
            <SearchResults />
          ) : conversations.length === 0 ? (
            <div className="px-2 py-6 text-center text-xs text-muted-foreground">
              No conversations yet.
              <br />
              Start a chat below.
            </div>
          ) : (
            <ConversationList
              conversations={conversations}
              activeId={activeConversationId}
              onOpen={(id) => void openConversation(id)}
            />
          )
        ) : (
          <div className="px-2 py-4 text-xs text-muted-foreground">Loading…</div>
        )}
      </div>

      <div className="border-t border-border p-2">
        <button
          type="button"
          onClick={() => setSettingsOpen(true)}
          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
          data-testid="settings-button"
        >
          <Settings2 className="h-4 w-4" />
          Settings
        </button>
        <div className="mt-1 flex items-center gap-1.5 px-2 pb-0.5" title={`Model: ${getModel(model).name}`}>
          <span
            className={cn(
              "h-1.5 w-1.5 rounded-full",
              !online ? "bg-amber-400" : keyStatus === "ok" ? "bg-emerald-400" : keyStatus === "missing" ? "bg-amber-400" : "bg-muted-foreground",
            )}
            aria-hidden="true"
          />
          <span className="truncate text-[10px] text-muted-foreground">
            {!online ? "Offline" : getModel(model).name}
          </span>
        </div>
      </div>
    </aside>
  );
}