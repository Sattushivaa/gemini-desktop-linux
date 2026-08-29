import { memo, useState } from "react";
import { isToday, isYesterday, differenceInCalendarDays } from "date-fns";
import { MessageSquare, MoreHorizontal, Pencil, Trash2, Download } from "lucide-react";
import type { Conversation } from "@/types";
import { useConversationStore } from "@/stores/conversations";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { exportConversation } from "@/services/files/export";

function timeLabel(date: string): string {
  return new Date(date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function dateLabel(date: string): string {
  return new Date(date).toLocaleDateString([], { month: "short", day: "numeric" });
}

function groupOf(updatedAt: string): string {
  const d = new Date(updatedAt);
  if (isToday(d)) return "Today";
  if (isYesterday(d)) return "Yesterday";
  if (differenceInCalendarDays(new Date(), d) < 7) return "Previous 7 days";
  return "Older";
}

interface ConversationItemProps {
  conversation: Conversation;
  active: boolean;
  onOpen: (id: string) => void;
}

export const ConversationItem = memo(function ConversationItem({
  conversation,
  active,
  onOpen,
}: ConversationItemProps) {
  const rename = useConversationStore((s) => s.rename);
  const remove = useConversationStore((s) => s.remove);
  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [title, setTitle] = useState(conversation.title);
  const [exportError, setExportError] = useState<string | null>(null);

  return (
    <div className="group relative">
      <button
        type="button"
        onClick={() => onOpen(conversation.id)}
        className={cn(
          "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors",
          active
            ? "bg-accent text-foreground"
            : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
        )}
      >
        <MessageSquare className="h-3.5 w-3.5 shrink-0 opacity-60" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px]">{conversation.title}</span>
          <span className="block text-[10px] text-muted-foreground/80">
            {isToday(new Date(conversation.updatedAt)) ? timeLabel(conversation.updatedAt) : dateLabel(conversation.updatedAt)}
          </span>
        </span>
      </button>

      <div className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
              aria-label={`Actions for ${conversation.title}`}
            >
              <MoreHorizontal className="h-3.5 w-3.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem onClick={() => { setTitle(conversation.title); setRenameOpen(true); }}>
              <Pencil className="mr-2" /> Rename
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() =>
                void exportConversation(conversation.id, conversation.title, conversation.model).catch(
                  (e) => setExportError(e instanceof Error ? e.message : "Export failed"),
                )
              }
            >
              <Download className="mr-2" /> Export
            </DropdownMenuItem>
            <DropdownMenuItem destructive onClick={() => setDeleteOpen(true)}>
              <Trash2 className="mr-2" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {exportError && (
        <div className="sr-only" role="alert">
          {exportError}
        </div>
      )}

      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Rename conversation</DialogTitle>
          </DialogHeader>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                void rename(conversation.id, title.trim() || conversation.title);
                setRenameOpen(false);
              }
            }}
            autoFocus
            aria-label="Conversation title"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                void rename(conversation.id, title.trim() || conversation.title);
                setRenameOpen(false);
              }}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete conversation?</DialogTitle>
            <DialogDescription>
              “{conversation.title}” and its messages will be permanently removed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                void remove(conversation.id);
                setDeleteOpen(false);
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
});

interface Group {
  label: string;
  conversations: Conversation[];
}

export function ConversationList({
  conversations,
  activeId,
  onOpen,
}: {
  conversations: Conversation[];
  activeId: string | null;
  onOpen: (id: string) => void;
}) {
  const groups = new Map<string, Conversation[]>();
  for (const c of conversations) {
    const g = groupOf(c.updatedAt);
    const arr = groups.get(g) ?? [];
    arr.push(c);
    groups.set(g, arr);
  }
  const order = ["Today", "Yesterday", "Previous 7 days", "Older"];
  const rendered = order
    .map((label) => ({ label, conversations: groups.get(label) ?? [] }))
    .filter((g) => g.conversations.length > 0) as Group[];

  return (
    <div className="space-y-4">
      {rendered.map((group) => (
        <div key={group.label}>
          <p className="mb-1 px-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            {group.label}
          </p>
          <div className="space-y-0.5">
            {group.conversations.map((c) => (
              <ConversationItem
                key={c.id}
                conversation={c}
                active={c.id === activeId}
                onOpen={onOpen}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}