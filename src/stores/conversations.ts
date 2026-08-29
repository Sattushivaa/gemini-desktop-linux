import { create } from "zustand";
import type { Conversation, Message, SearchResult } from "@/types";
import * as db from "@/services/database/db";
import { uid } from "@/lib/utils";
import { generateTitleFromText, shouldAutoTitle } from "@/lib/title";

interface ConversationState {
  ready: boolean;
  conversations: Conversation[];
  activeConversationId: string | null;
  activeConversation: Conversation | null;
  messages: Message[];
  searchResults: SearchResult[];
  searchQuery: string;

  init: () => Promise<void>;
  newChat: (model: string) => Promise<string>;
  openConversation: (id: string) => Promise<void>;
  selectNone: () => void;
  search: (query: string) => Promise<void>;
  clearSearch: () => void;
  rename: (id: string, title: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
  setConversationModel: (conversationId: string, model: string) => Promise<void>;
  addMessage: (msg: Message) => Promise<void>;
  updateMessageContent: (id: string, content: string) => Promise<void>;
  maybeAutoTitle: (message: Message) => Promise<void>;
  touch: (conversationId: string) => Promise<void>;
}

export const useConversationStore = create<ConversationState>((set, get) => {
  async function refreshList(keepActiveId?: string | null) {
    const conversations = await db.listConversations();
    set({ conversations });
    const current = get().activeConversationId;
    const nextId = current ?? keepActiveId ?? null;
    const active = conversations.find((c) => c.id === nextId) ?? null;
    set(() => ({
      conversations,
      activeConversationId: active ? active.id : null,
      activeConversation: active,
    }));
  }

  return {
    ready: false,
    conversations: [],
    activeConversationId: null,
    activeConversation: null,
    messages: [],
    searchResults: [],
    searchQuery: "",

    init: async () => {
      if (get().ready) return;
      try {
        await db.initDb();
        await db.pruneEmptyConversations();
        await refreshList();
      } catch (err) {
        console.error("Failed to initialize conversation store:", err);
      } finally {
        set({ ready: true });
      }
    },

    newChat: async (model) => {
      const id = uid("conv");
      const now = new Date().toISOString();
      await db.createConversation({ id, title: "New chat", model, createdAt: now });
      set({
        activeConversationId: id,
        activeConversation: { id, title: "New chat", model, createdAt: now, updatedAt: now },
        messages: [],
        searchResults: [],
        searchQuery: "",
      });
      await refreshList(id);
      return id;
    },

    openConversation: async (id) => {
      const data = await db.getConversation(id);
      if (!data) return;
      set({
        activeConversationId: id,
        activeConversation: data.conversation,
        messages: data.messages,
        searchQuery: "",
        searchResults: [],
      });
    },

    selectNone: () =>
      set({
        activeConversationId: null,
        activeConversation: null,
        messages: [],
        searchQuery: "",
        searchResults: [],
      }),

    search: async (query) => {
      set({ searchQuery: query });
      if (!query.trim()) {
        set({ searchResults: [] });
        return;
      }
      const results = await db.searchConversations(query);
      set({ searchResults: results });
    },

    clearSearch: () => set({ searchQuery: "", searchResults: [] }),

    rename: async (id, title) => {
      await db.renameConversation(id, title);
      set({
        conversations: get().conversations.map((c) => (c.id === id ? { ...c, title } : c)),
      });
      if (get().activeConversation?.id === id) {
        set({ activeConversation: { ...get().activeConversation!, title } });
      }
    },

    remove: async (id) => {
      await db.deleteConversation(id);
      const wasActive = get().activeConversationId === id;
      const conversations = get().conversations.filter((c) => c.id !== id);
      set({
        conversations,
        searchResults: get().searchResults.filter((r) => r.conversationId !== id),
      });
      if (wasActive) {
        set({ activeConversationId: null, activeConversation: null, messages: [] });
      }
    },

    setConversationModel: async (conversationId, model) => {
      const now = new Date().toISOString();
      if (conversationId === get().activeConversationId) {
        await db.touchConversation(conversationId, now);
        set({
          conversations: get().conversations.map((c) =>
            c.id === conversationId ? { ...c, model, updatedAt: now } : c,
          ),
          activeConversation: get().activeConversation
            ? { ...get().activeConversation!, model, updatedAt: now }
            : get().activeConversation,
        });
      } else {
        await db.touchConversation(conversationId, now);
        await refreshList(get().activeConversationId);
      }
    },

    addMessage: async (msg) => {
      await db.appendMessage(msg);
      const isActive = get().activeConversationId === msg.conversationId;
      if (isActive) {
        set({ messages: [...get().messages, msg] });
      }
      const now = new Date().toISOString();
      await db.touchConversation(msg.conversationId, now);
      const conv = isActive ? get().activeConversation : null;
      if (conv) {
        set({
          conversations: get().conversations.map((c) =>
            c.id === conv.id ? { ...c, updatedAt: now } : c,
          ),
          activeConversation: { ...conv, updatedAt: now },
        });
      } else {
        await refreshList(get().activeConversationId);
      }
    },

    updateMessageContent: async (id, content) => {
      await db.updateMessageContent(id, content);
      set({
        messages: get().messages.map((m) => (m.id === id ? { ...m, content } : m)),
      });
    },

    maybeAutoTitle: async (message) => {
      const conv = get().activeConversation;
      if (!conv || conv.title !== "New chat" || !shouldAutoTitle(message)) return;
      const title = generateTitleFromText(message.content);
      if (!title) return;
      await get().rename(conv.id, title);
    },

    touch: async (conversationId) => {
      await db.touchConversation(conversationId, new Date().toISOString());
      await refreshList(get().activeConversationId);
    },
  };
});