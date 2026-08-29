import Database from "@tauri-apps/plugin-sql";
import type {
  Attachment,
  AttachmentKind,
  Conversation,
  Message,
  SearchResult,
} from "@/types";

const DB_URL = "sqlite:gemini-desktop.db";

export interface DbBackend {
  initDb: () => Promise<void>;
  pruneEmptyConversations: () => Promise<void>;
  listConversations: () => Promise<Conversation[]>;
  getConversation: (
    id: string,
  ) => Promise<{ conversation: Conversation; messages: Message[] } | null>;
  createConversation: (input: {
    id: string;
    title: string;
    model: string;
    createdAt: string;
  }) => Promise<void>;
  renameConversation: (id: string, title: string) => Promise<void>;
  touchConversation: (id: string, updatedAt: string) => Promise<void>;
  deleteConversation: (id: string) => Promise<void>;
  appendMessage: (input: {
    id: string;
    conversationId: string;
    role: Message["role"];
    content: string;
    createdAt: string;
    attachments?: Attachment[];
  }) => Promise<void>;
  updateMessageContent: (id: string, content: string) => Promise<void>;
  searchConversations: (query: string) => Promise<SearchResult[]>;
}

export function createSqliteBackend(): DbBackend {
  let dbClient: Database | null = null;

  async function initDb(): Promise<void> {
    if (dbClient) return;
    const db = await Database.load(DB_URL);
    await db.execute("PRAGMA journal_mode = WAL;");
    dbClient = db;
  }

  function getDb(): Database {
    if (!dbClient) throw new Error("Database not initialised");
    return dbClient;
  }

  return {
    initDb,

    async pruneEmptyConversations() {
      const db = getDb();
      await db.execute(
        `DELETE FROM conversations
         WHERE title = 'New chat'
           AND NOT EXISTS (SELECT 1 FROM messages WHERE conversation_id = conversations.id)`,
      );
    },

    async listConversations() {
      const db = getDb();
      const rows = await db.select<Record<string, unknown>[]>(
        "SELECT id, title, model, created_at, updated_at FROM conversations ORDER BY updated_at DESC",
      );
      return rows.map((row: Record<string, unknown>) => ({
        id: String(row.id),
        title: String(row.title),
        model: String(row.model ?? "gemini-2.5-flash"),
        createdAt: String(row.created_at),
        updatedAt: String(row.updated_at),
      }));
    },

    async getConversation(id) {
      const db = getDb();
      const convRows = await db.select<Record<string, unknown>[]>(
        "SELECT id, title, model, created_at, updated_at FROM conversations WHERE id = ?",
        [id],
      );
      if (convRows.length === 0) return null;
      const conv = convRows[0];
      const conversation: Conversation = {
        id: String(conv.id),
        title: String(conv.title),
        model: String(conv.model ?? "gemini-2.5-flash"),
        createdAt: String(conv.created_at),
        updatedAt: String(conv.updated_at),
      };

      const msgRows = await db.select<Record<string, unknown>[]>(
        "SELECT id, conversation_id, role, content, created_at, sequence FROM messages WHERE conversation_id = ? ORDER BY sequence ASC",
        [id],
      );
      const messages: Message[] = msgRows.map((row) => ({
        id: String(row.id),
        conversationId: String(row.conversation_id),
        role: String(row.role) as Message["role"],
        content: String(row.content ?? ""),
        createdAt: String(row.created_at),
        sequence: Number(row.sequence ?? 0),
        attachments: [],
      }));

      if (messages.length > 0) {
        const attRows = await db.select<Record<string, unknown>[]>(
          "SELECT id, message_id, filename, mime_type, kind, size, path, created_at FROM attachments WHERE message_id IN (SELECT id FROM messages WHERE conversation_id = ?) ORDER BY created_at ASC",
          [id],
        );
        const byMessage = new Map<string, Attachment[]>();
        for (const a of attRows) {
          const mid = String(a.message_id);
          const arr = byMessage.get(mid) ?? [];
          arr.push({
            id: String(a.id),
            filename: String(a.filename),
            mimeType: String(a.mime_type),
            kind: String(a.kind) as AttachmentKind,
            size: Number(a.size ?? 0),
            path: String(a.path),
          });
          byMessage.set(mid, arr);
        }
        for (const m of messages) {
          m.attachments = byMessage.get(m.id) ?? [];
        }
      }

      return { conversation, messages };
    },

    async createConversation(input) {
      const db = getDb();
      await db.execute(
        "INSERT INTO conversations (id, title, model, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
        [input.id, input.title, input.model, input.createdAt, input.createdAt],
      );
    },

    async renameConversation(id, title) {
      const db = getDb();
      await db.execute("UPDATE conversations SET title = ? WHERE id = ?", [title, id]);
    },

    async touchConversation(id, updatedAt) {
      const db = getDb();
      await db.execute("UPDATE conversations SET updated_at = ? WHERE id = ?", [updatedAt, id]);
    },

    async deleteConversation(id) {
      const db = getDb();
      await db.execute("DELETE FROM conversations WHERE id = ?", [id]);
    },

    async appendMessage(input) {
      const db = getDb();
      const result = await db.select<{ n: number }[]>(
        "SELECT COALESCE(MAX(sequence), -1) + 1 AS n FROM messages WHERE conversation_id = ?",
        [input.conversationId],
      );
      const sequence = result[0]?.n ?? 0;
      await db.execute(
        "INSERT INTO messages (id, conversation_id, role, content, created_at, sequence) VALUES (?, ?, ?, ?, ?, ?)",
        [input.id, input.conversationId, input.role, input.content, input.createdAt, sequence],
      );
      for (const att of input.attachments ?? []) {
        await db.execute(
          "INSERT INTO attachments (id, message_id, filename, mime_type, kind, size, path, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
          [att.id, input.id, att.filename, att.mimeType, att.kind, att.size, att.path, input.createdAt],
        );
      }
    },

    async updateMessageContent(id, content) {
      const db = getDb();
      await db.execute("UPDATE messages SET content = ? WHERE id = ?", [content, id]);
    },

    async searchConversations(query) {
      if (!query.trim()) return [];
      const db = getDb();
      const like = `%${query.trim()}%`;
      const rows = await db.select<Record<string, unknown>[]>(
        `SELECT DISTINCT c.id, c.title, c.updated_at,
           (SELECT m2.content FROM messages m2
             WHERE m2.conversation_id = c.id AND m2.content LIKE ?
             ORDER BY m2.sequence ASC LIMIT 1) AS snippet
         FROM conversations c
         LEFT JOIN messages m ON m.conversation_id = c.id
         WHERE c.title LIKE ? OR m.content LIKE ?
         ORDER BY c.updated_at DESC
         LIMIT 50`,
        [like, like, like],
      );
      return rows.map((r) => ({
        conversationId: String(r.id),
        title: String(r.title),
        snippet: String(r.snippet ?? ""),
        updatedAt: String(r.updated_at),
      }));
    },
  };
}