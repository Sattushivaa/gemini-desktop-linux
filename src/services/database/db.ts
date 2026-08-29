import type { Attachment, Conversation, Message, SearchResult } from "@/types";
import { isTauri } from "@/lib/tauri";
import { createSqliteBackend, type DbBackend } from "./sqliteBackend";
import { createMemoryBackend } from "./memoryBackend";

let backend: DbBackend | null = null;

/** Picks the native SQLite backend in Tauri and an in-memory one in the browser. */
function getBackend(): DbBackend {
  if (!backend) {
    backend = isTauri() ? createSqliteBackend() : createMemoryBackend();
  }
  return backend;
}

export async function initDb(): Promise<void> {
  await getBackend().initDb();
}

export async function pruneEmptyConversations(): Promise<void> {
  await getBackend().pruneEmptyConversations();
}

export async function listConversations(): Promise<Conversation[]> {
  return getBackend().listConversations();
}

export async function getConversation(
  id: string,
): Promise<{ conversation: Conversation; messages: Message[] } | null> {
  return getBackend().getConversation(id);
}

export async function createConversation(input: {
  id: string;
  title: string;
  model: string;
  createdAt: string;
}): Promise<void> {
  await getBackend().createConversation(input);
}

export async function renameConversation(id: string, title: string): Promise<void> {
  await getBackend().renameConversation(id, title);
}

export async function touchConversation(id: string, updatedAt: string): Promise<void> {
  await getBackend().touchConversation(id, updatedAt);
}

export async function deleteConversation(id: string): Promise<void> {
  await getBackend().deleteConversation(id);
}

export async function appendMessage(input: {
  id: string;
  conversationId: string;
  role: Message["role"];
  content: string;
  createdAt: string;
  attachments?: Attachment[];
}): Promise<void> {
  await getBackend().appendMessage(input);
}

export async function updateMessageContent(id: string, content: string): Promise<void> {
  await getBackend().updateMessageContent(id, content);
}

export async function searchConversations(query: string): Promise<SearchResult[]> {
  return getBackend().searchConversations(query);
}