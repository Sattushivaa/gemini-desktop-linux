import { useState } from "react";
import { Check, ChevronsUpDown, Plus, Sparkles } from "lucide-react";
import { MODELS, getModel } from "@/services/gemini/models";
import { useSettingsStore } from "@/stores/settings";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface ModelSelectorProps {
  value: string;
  onChange: (model: string) => void;
  disabled?: boolean;
}

export function ModelSelector({ value, onChange, disabled }: ModelSelectorProps) {
  const current = getModel(value);
  const settings = useSettingsStore((s) => s.settings);
  const updateSettings = useSettingsStore((s) => s.update);

  const [customDialogOpen, setCustomDialogOpen] = useState(false);
  const [customInput, setCustomInput] = useState("");

  const customModels = settings.customModels ?? [];

  const handleAddCustom = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = customInput.trim();
    if (!trimmed) return;
    const nextCustom = Array.from(new Set([...customModels, trimmed]));
    updateSettings({ customModels: nextCustom });
    onChange(trimmed);
    setCustomInput("");
    setCustomDialogOpen(false);
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            disabled={disabled}
            className="flex h-7 max-w-56 items-center gap-1.5 rounded-md border border-border bg-transparent px-2 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Select model"
            title={current.description}
            data-testid="model-selector"
          >
            <Sparkles className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span className="truncate">{current.name || value}</span>
            <ChevronsUpDown className="ml-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="start" className="max-h-80 w-64 overflow-y-auto">
          <DropdownMenuLabel>Gemini Models</DropdownMenuLabel>
          {MODELS.map((m) => (
            <DropdownMenuItem
              key={m.id}
              onClick={() => onChange(m.id)}
              className="flex items-center justify-between text-xs"
            >
              <div className="flex flex-col">
                <span className="font-medium text-foreground">{m.name}</span>
                <span className="text-[10px] text-muted-foreground">{m.id}</span>
              </div>
              {value === m.id && <Check className="h-3.5 w-3.5 shrink-0 text-primary" />}
            </DropdownMenuItem>
          ))}

          {customModels.length > 0 && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Custom Models</DropdownMenuLabel>
              {customModels.map((id) => (
                <DropdownMenuItem
                  key={id}
                  onClick={() => onChange(id)}
                  className="flex items-center justify-between text-xs"
                >
                  <span className="font-mono text-xs">{id}</span>
                  {value === id && <Check className="h-3.5 w-3.5 shrink-0 text-primary" />}
                </DropdownMenuItem>
              ))}
            </>
          )}

          {!MODELS.some((m) => m.id === value) && !customModels.includes(value) && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Current Model</DropdownMenuLabel>
              <DropdownMenuItem
                onClick={() => onChange(value)}
                className="flex items-center justify-between text-xs"
              >
                <span className="font-mono text-xs">{value}</span>
                <Check className="h-3.5 w-3.5 shrink-0 text-primary" />
              </DropdownMenuItem>
            </>
          )}

          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => setCustomDialogOpen(true)}
            className="flex items-center gap-1.5 text-xs text-primary"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Set custom model ID…</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={customDialogOpen} onOpenChange={setCustomDialogOpen}>
        <DialogContent className="max-w-md">
          <form onSubmit={handleAddCustom}>
            <DialogHeader>
              <DialogTitle>Set Custom Model</DialogTitle>
              <DialogDescription>
                Enter any model ID supported by your Gemini API key (e.g.{" "}
                <code className="font-mono text-xs">gemini-3.1-flash</code>,{" "}
                <code className="font-mono text-xs">gemini-3.7-flash</code>,{" "}
                <code className="font-mono text-xs">gemini-exp-1206</code>).
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Input
                value={customInput}
                onChange={(e) => setCustomInput(e.target.value)}
                placeholder="e.g. gemini-3.1-flash"
                className="font-mono text-sm"
                autoFocus
              />
            </div>
            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setCustomDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={!customInput.trim()}>
                Use Model
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

export { Check };