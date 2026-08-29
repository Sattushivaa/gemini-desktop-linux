import { Check, ChevronsUpDown, Sparkles } from "lucide-react";
import { MODELS, getModel } from "@/services/gemini/models";

interface ModelSelectorProps {
  value: string;
  onChange: (model: string) => void;
  disabled?: boolean;
}

/**
 * Styled native `<select>` keeps the desktop feel, keyboard navigation and
 * accessibility for free while avoiding a heavy popover dependency.
 */
export function ModelSelector({ value, onChange, disabled }: ModelSelectorProps) {
  const current = getModel(value);

  return (
    <div className="relative" data-testid="model-selector">
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="h-7 max-w-52 cursor-pointer appearance-none rounded-md border border-border bg-transparent pl-6 pr-7 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50"
        aria-label="Select model"
        title={current.description}
      >
        {MODELS.map((m) => (
          <option key={m.id} value={m.id} className="bg-popover text-popover-foreground">
            {m.name}
          </option>
        ))}
        {!MODELS.some((m) => m.id === value) && (
          <option value={value} className="bg-popover text-popover-foreground">
            {value}
          </option>
        )}
      </select>
      <Sparkles className="pointer-events-none absolute left-1.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
      <ChevronsUpDown className="pointer-events-none absolute right-1.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
    </div>
  );
}

export { Check };