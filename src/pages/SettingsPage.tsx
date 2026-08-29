import { useEffect, useState } from "react";
import { Check, FolderOpen, KeyRound, Loader2, Save, Trash2 } from "lucide-react";
import { openPath } from "@tauri-apps/plugin-opener";
import { isTauri } from "@/lib/tauri";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useUiStore } from "@/stores/ui";
import { useSettingsStore } from "@/stores/settings";
import { useConversationStore } from "@/stores/conversations";
import { MODELS } from "@/services/gemini/models";
import { resolveApiKey, setApiKeyInNativeStore, getAppPaths } from "@/services/gemini/client";
import type { AppPaths, FontSize, Theme } from "@/types";
import { FONT_SIZES } from "@/types";
import { cn } from "@/lib/utils";

const TOKEN_OPTIONS = [1024, 2048, 4096, 8192, 16384, 32768];

function PreferenceRow({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-6 py-3">
      <div className="min-w-0">
        <p className="text-sm">{label}</p>
        {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
      </div>
      <div className="flex shrink-0 items-center justify-end">{children}</div>
    </div>
  );
}

export function SettingsPage() {
  const open = useUiStore((s) => s.settingsOpen);
  const setOpen = useUiStore((s) => s.setSettingsOpen);
  const settings = useSettingsStore((s) => s.settings);
  const update = useSettingsStore((s) => s.update);
  const { conversations } = useConversationStore();

  const [keyInput, setKeyInput] = useState("");
  const [keySource, setKeySource] = useState<"env" | "config" | "none">("none");
  const [keySaving, setKeySaving] = useState(false);
  const [keySaved, setKeySaved] = useState(false);
  const [paths, setPaths] = useState<AppPaths | null>(null);
  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    if (!open) return;
    setKeySaved(false);
    setKeyInput("");
    void resolveApiKey(true).then((k) => {
      setKeySource(k.source);
      setKeyInput(k.apiKey ?? "");
    });
    void getAppPaths().then(setPaths);
  }, [open]);

  const saveKey = async () => {
    const trimmed = keyInput.trim();
    if (!trimmed) return;
    setKeySaving(true);
    try {
      await setApiKeyInNativeStore(trimmed);
      setKeySource("config");
      setKeySaved(true);
      window.setTimeout(() => setKeySaved(false), 2500);
    } finally {
      setKeySaving(false);
    }
  };

  const removeKey = async () => {
    setKeySaving(true);
    try {
      await setApiKeyInNativeStore("");
      setKeyInput("");
      setKeySource("none");
    } finally {
      setKeySaving(false);
    }
  };

  const clearAll = async () => {
    setClearing(true);
    try {
      for (const c of [...conversations]) {
        await useConversationStore.getState().remove(c.id);
      }
    } finally {
      setClearing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-h-[85vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-primary" /> Settings
          </DialogTitle>
          <DialogDescription>Configure the Gemini API key and app behavior.</DialogDescription>
        </DialogHeader>

        <div className="overflow-hidden rounded-md border border-border">
          <div className="border-b border-border bg-muted/50 px-4 py-2 text-xs font-medium text-muted-foreground">
            Gemini API
          </div>
          <div className="px-4 pb-4">
            <div className="flex items-center gap-2 pt-3">
              <Input
                type="password"
                value={keyInput}
                onChange={(e) => {
                  setKeyInput(e.target.value);
                  setKeySaved(false);
                }}
                placeholder="Paste your API key…"
                aria-label="Gemini API key"
                className="font-mono text-sm"
                autoComplete="off"
                spellCheck={false}
              />
              <Button size="sm" onClick={() => void saveKey()} disabled={keySaving || !keyInput.trim()}>
                {keySaving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : keySaved ? <Check className="mr-1.5 h-3.5 w-3.5" /> : <Save className="mr-1.5 h-3.5 w-3.5" />}
                Save
              </Button>
              <Button size="sm" variant="outline" onClick={() => void removeKey()} disabled={keySaving || keySource === "none"}>
                Remove
              </Button>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {keySource === "env" && "Using the GEMINI_API_KEY environment variable (this overrides any stored key)."}
              {keySource === "config" && "Key stored in your native config with restricted permissions."}
              {keySource === "none" && "No key configured yet. Get one at ai.google.dev and paste it above."}
            </p>
          </div>
        </div>

        <div className="overflow-hidden rounded-md border border-border">
          <div className="border-b border-border bg-muted/50 px-4 py-2 text-xs font-medium text-muted-foreground">
            Chat defaults
          </div>
          <div className="space-y-1 px-4">
            <PreferenceRow label="Default model" hint="Selected when starting a new chat.">
              <Select
                value={settings.defaultModel}
                onValueChange={(v) => update({ defaultModel: v })}
              >
                <SelectTrigger className="w-52">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MODELS.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </PreferenceRow>

            <PreferenceRow
              label="Temperature"
              hint="Creativity vs randomness. 1 is the recommended default."
            >
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={0}
                  max={2}
                  step={0.1}
                  value={settings.temperature}
                  onChange={(e) => update({ temperature: Number(e.target.value) })}
                  className="w-40 accent-primary"
                  aria-label="Temperature"
                />
                <span className="w-8 text-right text-xs tabular-nums text-muted-foreground">
                  {settings.temperature.toFixed(1)}
                </span>
              </div>
            </PreferenceRow>

            <PreferenceRow
              label="Max output tokens"
              hint="Upper bound for the length of generated responses."
            >
              <Select
                value={String(settings.maxOutputTokens)}
                onValueChange={(v) => update({ maxOutputTokens: Number(v) })}
              >
                <SelectTrigger className="w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TOKEN_OPTIONS.map((t) => (
                    <SelectItem key={t} value={String(t)}>
                      {t >= 1024 ? `${t / 1024}k` : t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </PreferenceRow>
          </div>
        </div>

        <div className="overflow-hidden rounded-md border border-border">
          <div className="border-b border-border bg-muted/50 px-4 py-2 text-xs font-medium text-muted-foreground">
            Appearance
          </div>
          <div className="space-y-1 px-4">
            <PreferenceRow label="Theme">
              <Select value={settings.theme} onValueChange={(v) => update({ theme: v as Theme })}>
                <SelectTrigger className="w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="dark">Dark</SelectItem>
                  <SelectItem value="light">Light</SelectItem>
                </SelectContent>
              </Select>
            </PreferenceRow>
            <PreferenceRow label="Interface font size">
              <Select
                value={settings.fontSize}
                onValueChange={(v) => update({ fontSize: v as FontSize })}
              >
                <SelectTrigger className="w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(FONT_SIZES).map(([key, size]) => (
                    <SelectItem key={key} value={key}>
                      {size}px
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </PreferenceRow>
            <PreferenceRow label="Start maximized" hint="Applies on the next launch.">
              <Switch
                checked={settings.startMaximized}
                onCheckedChange={(v) => update({ startMaximized: v })}
                aria-label="Start maximized"
              />
            </PreferenceRow>
          </div>
        </div>

        <div className="overflow-hidden rounded-md border border-border">
          <div className="border-b border-border bg-muted/50 px-4 py-2 text-xs font-medium text-muted-foreground">
            Data
          </div>
          <div className="px-4">
            <PreferenceRow
              label="Storage location"
              hint={paths ? cn("SQLite DB, attachments and settings are stored here.", "") : undefined}
            >
              <div className="flex flex-col items-end gap-1.5">
                <span className="max-w-60 truncate text-xs text-muted-foreground" title={paths?.dataDir}>
                  {paths?.dataDir ?? "…"}
                </span>
                {paths && isTauri() && (
                  <Button size="sm" variant="ghost" onClick={() => void openPath(paths.dataDir)}>
                    <FolderOpen className="mr-1.5 h-3.5 w-3.5" /> Open folder
                  </Button>
                )}
              </div>
            </PreferenceRow>
            <div className="border-t border-border py-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm">Chat history</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {conversations.length} conversation{conversations.length === 1 ? "" : "s"}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => void clearAll()}
                  disabled={clearing || conversations.length === 0}
                >
                  {clearing ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Trash2 className="mr-1.5 h-3.5 w-3.5" />}
                  Clear history
                </Button>
              </div>
            </div>
          </div>
        </div>

        <p className="text-center text-[11px] text-muted-foreground">
          Gemini Desktop · v0.1.0 · Privacy: your key is never sent anywhere except Google's Gemini API.
        </p>
      </DialogContent>
    </Dialog>
  );
}