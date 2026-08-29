import { Component, useEffect, type ReactNode } from "react";
import { Sidebar } from "@/components/sidebar/Sidebar";
import { ChatPage } from "@/pages/ChatPage";
import { SettingsPage } from "@/pages/SettingsPage";
import { CommandPalette } from "@/components/palette/CommandPalette";
import { AttachmentPreviewPanel } from "@/components/palette/AttachmentPreviewPanel";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { hydrateSettings } from "@/stores/settings";
import { useConversationStore } from "@/stores/conversations";

function Boot() {
  useEffect(() => {
    hydrateSettings();
    void useConversationStore.getState().init();
  }, []);
  return null;
}

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <div className="flex h-screen flex-col items-center justify-center gap-3 px-6 text-center">
          <h1 className="text-lg font-semibold">Something went wrong</h1>
          <p className="max-w-md text-sm text-muted-foreground">{String(this.state.error)}</p>
          <button
            className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-accent"
            onClick={() => this.setState({ error: null })}
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function App() {
  useKeyboardShortcuts();
  return (
    <ErrorBoundary>
      <TooltipProvider delayDuration={300}>
        <Boot />
        <div className="flex h-screen w-screen min-w-0 overflow-hidden bg-background text-foreground">
          <Sidebar />
          <ChatPage />
          <SettingsPage />
          <CommandPalette />
          <AttachmentPreviewPanel />
        </div>
      </TooltipProvider>
    </ErrorBoundary>
  );
}

export default App;