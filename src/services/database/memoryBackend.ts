import type { Attachment, Conversation, Message, SearchResult } from "@/types";
import type { DbBackend } from "./sqliteBackend";

/**
 * In-memory database backend used when the app is previewed in a plain browser
 * (outside the Tauri webview). None of it persists across reloads, but it gives
 * the UI a fully working chat loop for iterating on the front end.
 */
export function createMemoryBackend(): DbBackend {
  const conversations = new Map<string, Conversation>();
  const messages = new Map<string, Map<string, Message>>();
  const attachments = new Map<string, Attachment[]>();

  function sortedConversations(): Conversation[] {
    return [...conversations.values()].sort((a, b) =>
      b.updatedAt.localeCompare(a.updatedAt),
    );
  }

  return {
    async initDb() {
      // Nothing to set up.
    },

    async pruneEmptyConversations() {
      for (const [id, conv] of conversations) {
        const hasMessages = (messages.get(id)?.size ?? 0) > 0;
        if (!hasMessages && conv.title === "New chat") {
          conversations.delete(id);
          messages.delete(id);
          attachments.delete(id);
        }
      }
    },

    async listConversations() {
      return sortedConversations();
    },

    async getConversation(id) {
      const conversation = conversations.get(id);
      if (!conversation) return null;
      const list = [...(messages.get(id)?.values() ?? [])].sort(
        (a, b) => a.sequence - b.sequence,
      );
      return {
        conversation,
        messages: list.map((m) => ({
          ...m,
          attachments: attachments.get(m.id) ?? [],
        })),
      };
    },

    async createConversation(input) {
      conversations.set(input.id, {
        id: input.id,
        title: input.title,
        model: input.model,
        createdAt: input.createdAt,
        updatedAt: input.createdAt,
      });
      if (!messages.has(input.id)) messages.set(input.id, new Map());
    },

    async renameConversation(id, title) {
      const conv = conversations.get(id);
      if (conv) conversations.set(id, { ...conv, title });
    },

    async touchConversation(id, updatedAt) {
      const conv = conversations.get(id);
      if (conv) conversations.set(id, { ...conv, updatedAt });
    },

    async deleteConversation(id) {
      conversations.delete(id);
      messages.delete(id);
      attachments.delete(id);
    },

    async appendMessage(input) {
      const bucket = messages.get(input.conversationId) ?? new Map();
      if (!messages.has(input.conversationId)) {
        messages.set(input.conversationId, bucket);
      }
      const sequence = bucket.size;
      bucket.set(input.id, {
        id: input.id,
        conversationId: input.conversationId,
        role: input.role,
        content: input.content,
        createdAt: input.createdAt,
        sequence,
        attachments: input.attachments ?? [],
      });
      if (input.attachments?.length) {
        attachments.set(input.id, input.attachments);
      }
    },

    async updateMessageContent(id, content) {
      for (const bucket of messages.values()) {
        const msg = bucket.get(id);
        if (msg) {
          bucket.set(id, { ...msg, content });
          return;
        }
      }
    },

    async searchConversations(query) {
      const q = query.trim().toLowerCase();
      if (!q) return [];
      const results: SearchResult[] = [];
      for (const conv of sortedConversations()) {
        const bucket = messages.get(conv.id) ?? new Map();
        const text = [...bucket.values()]
          .sort((a, b) => a.sequence - b.sequence)
          .map((m) => m.content)
          .join("\n");
        const matches = conv.title.toLowerCase().includes(q) || text.toLowerCase().includes(q);
        if (!matches) continue;
        const match = [...bucket.values()].find((m) =>
          m.content.toLowerCase().includes(q),
        );
        results.push({
          conversationId: conv.id,
          title: conv.title,
          snippet: match?.content.slice(0, 160).trim() ?? "",
          updatedAt: conv.updatedAt,
        });
      }
      return results.slice(0, 50);
    },
  };
}