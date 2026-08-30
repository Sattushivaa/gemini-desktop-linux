import {
  FilePlus2,
  Keyboard,
  Settings2,
  FileText,
  Search,
  Trash2,
  MessageSquare,
  ZoomIn,
  ZoomOut,
  RotateCcw,
} from "lucide-react";
import { flushSync } from "react-dom";
import { Command } from "cmdk";
import { useUiStore } from "@/stores/ui";
import { useConversationStore } from "@/stores/conversations";
import { useSettingsStore } from "@/stores/settings";
import { getModel } from "@/services/gemini/models";

export function CommandPalette() {
  const open = useUiStore((s) => s.commandPaletteOpen);
  const setOpen = useUiStore((s) => s.setCommandPaletteOpen);
  const { newChat, openConversation, remove, conversations } = useConversationStore();
  const defaultModel = useSettingsStore((s) => s.settings.defaultModel);
  const increaseFontSize = useSettingsStore((s) => s.increaseFontSize);
  const decreaseFontSize = useSettingsStore((s) => s.decreaseFontSize);
  const resetFontSize = useSettingsStore((s) => s.resetFontSize);

  if (!open) return null;

  const run = (fn: () => void) => {
    flushSync(() => setOpen(false));
    fn();
  };

  return (
    <Command.Dialog
      open={open}
      onOpenChange={setOpen}
      label="Command palette"
      className="fixed left-1/2 top-24 z-50 w-[min(560px,calc(100vw-2rem))] -translate-x-1/2 overflow-hidden rounded-xl border border-border bg-popover shadow-xl"
    >
      <div className="flex items-center border-b border-border px-3">
        <Search className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
        <Command.Input
          placeholder="Search chats, or run a command…"
          className="h-11 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
      </div>
      <Command.List className="max-h-80 overflow-y-auto p-1.5">
        <Command.Empty className="px-3 py-6 text-center text-sm text-muted-foreground">
          No results found.
        </Command.Empty>

        <Command.Group heading="Actions">
          <Command.Item
            value="new-chat"
            onSelect={() => run(() => void newChat(defaultModel))}
            className="palette-item"
          >
            <FilePlus2 className="mr-2 h-4 w-4" /> New chat
            <span className="ml-auto text-[10px] text-muted-foreground">Ctrl+N</span>
          </Command.Item>
          <Command.Item
            value="increase-font"
            onSelect={() => run(() => increaseFontSize())}
            className="palette-item"
          >
            <ZoomIn className="mr-2 h-4 w-4" /> Increase font size
            <span className="ml-auto text-[10px] text-muted-foreground">Ctrl++</span>
          </Command.Item>
          <Command.Item
            value="decrease-font"
            onSelect={() => run(() => decreaseFontSize())}
            className="palette-item"
          >
            <ZoomOut className="mr-2 h-4 w-4" /> Decrease font size
            <span className="ml-auto text-[10px] text-muted-foreground">Ctrl+-</span>
          </Command.Item>
          <Command.Item
            value="reset-font"
            onSelect={() => run(() => resetFontSize())}
            className="palette-item"
          >
            <RotateCcw className="mr-2 h-4 w-4" /> Reset font size
            <span className="ml-auto text-[10px] text-muted-foreground">Ctrl+0</span>
          </Command.Item>
          <Command.Item
            value="settings"
            onSelect={() => run(() => useUiStore.getState().setSettingsOpen(true))}
            className="palette-item"
          >
            <Settings2 className="mr-2 h-4 w-4" /> Open settings
            <span className="ml-auto text-[10px] text-muted-foreground">Ctrl+,</span>
          </Command.Item>
          <Command.Item
            value="shortcuts"
            onSelect={() => run(() => useUiStore.getState().setCommandPaletteOpen(false))}
            disabled
            className="palette-item"
          >
            <Keyboard className="mr-2 h-4 w-4" /> Keyboard shortcuts —
            <span className="ml-1 truncate text-[11px] text-muted-foreground">
              Ctrl+N · Ctrl++ · Ctrl+- · Ctrl+0 · Ctrl+K · Esc
            </span>
          </Command.Item>
        </Command.Group>

        {conversations.length > 0 && (
          <Command.Group heading="Recent chats">
            {conversations.slice(0, 8).map((c) => (
              <Command.Item
                key={c.id}
                value={`chat-${c.title}`}
                onSelect={() => run(() => void openConversation(c.id))}
                className="palette-item"
              >
                <MessageSquare className="mr-2 h-4 w-4 shrink-0" />
                <span className="flex-1 truncate">{c.title}</span>
                <span className="text-[10px] text-muted-foreground">{getModel(c.model).name}</span>
                <span
                  role="button"
                  tabIndex={0}
                  className="ml-2 rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                  aria-label="Delete chat"
                  onClick={(e) => {
                    e.stopPropagation();
                    void remove(c.id);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.stopPropagation();
                      void remove(c.id);
                    }
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </span>
              </Command.Item>
            ))}
          </Command.Group>
        )}

        <Command.Group heading="Export">
          <Command.Item
            value="export-active"
            onSelect={() =>
              run(() => {
                const id = useConversationStore.getState().activeConversationId;
                const c = useConversationStore.getState().activeConversation;
                if (id && c) {
                  void import("@/services/files/export").then((m) =>
                    m.exportConversation(id, c.title, c.model),
                  );
                }
              })
            }
            className="palette-item"
          >
            <FileText className="mr-2 h-4 w-4" /> Export active conversation
          </Command.Item>
        </Command.Group>
      </Command.List>
    </Command.Dialog>
  );
}