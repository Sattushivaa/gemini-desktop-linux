import { save } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { isTauri } from "@/lib/tauri";
import * as db from "@/services/database/db";

export type ExportFormat = "markdown" | "text";

function buildExport(
  title: string,
  model: string,
  messages: { role: string; content: string }[],
  format: ExportFormat,
): string {
  const date = new Date().toISOString();
  if (format === "markdown") {
    const lines: string[] = [`# ${title}`, "", `> Exported from Gemini Desktop · ${date}`, ""];
    for (const m of messages) {
      const speaker = m.role === "user" ? "**You**" : "**Gemini**";
      lines.push(`## ${speaker.replace(/\*\*/g, "")}`, "");
      lines.push(m.content.trim());
      lines.push("");
      lines.push("---");
      lines.push("");
    }
    return lines.join("\n") + `\n_Model: ${model}_\n`;
  }
  const lines: string[] = [];
  lines.push(`${title}`);
  lines.push(`Exported from Gemini Desktop · ${date}`);
  lines.push(`Model: ${model}\n`);
  lines.push("=".repeat(60));
  lines.push("");
  for (const m of messages) {
    lines.push(m.role === "user" ? "You:" : "Gemini:");
    lines.push(m.content.trim());
    lines.push("");
    lines.push("-".repeat(60));
    lines.push("");
  }
  return lines.join("\n");
}

export async function exportConversation(
  conversationId: string,
  title: string,
  model: string,
): Promise<void> {
  const data = await db.getConversation(conversationId);
  if (!data || data.messages.length === 0) {
    throw new Error("This conversation has no messages to export.");
  }

  const defaultName = `${title.replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "-") || "conversation"}.md`;

  const format: ExportFormat = defaultName.toLowerCase().endsWith(".txt") ? "text" : "markdown";
  const content = buildExport(
    title,
    model || data.conversation.model,
    data.messages.map((m) => ({ role: m.role, content: m.content })),
    format,
  );

  if (!isTauri()) {
    // Browser preview: trigger a normal download instead of the native save dialog.
    const blob = new Blob([content], {
      type: format === "markdown" ? "text/markdown" : "text/plain",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = defaultName;
    a.click();
    URL.revokeObjectURL(url);
    return;
  }

  const path = await save({
    defaultPath: defaultName,
    filters: [
      { name: "Markdown", extensions: ["md"] },
      { name: "Plain text", extensions: ["txt"] },
      { name: "All files", extensions: ["*"] },
    ],
  });
  if (!path) return; // user cancelled

  await invoke("write_text_file", { path, contents: content });
}