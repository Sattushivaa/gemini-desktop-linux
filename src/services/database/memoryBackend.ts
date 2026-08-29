import type { Attachment, Conversation, Message, SearchResult } from "@/types";
import type { DbBackend } from "./sqliteBackend";
import { isTauri } from "@/lib/tauri";
import { invoke } from "@tauri-apps/api/core";

const IDB_NAME = "gemini_desktop_idb";
const IDB_VERSION = 1;
const STORE_CONVS = "conversations";
const STORE_MSGS = "messages";

export function createMemoryBackend(): DbBackend {
  const conversations = new Map<string, Conversation>();
  const messages = new Map<string, Map<string, Message>>();
  const attachments = new Map<string, Attachment[]>();
  let dataDir: string | null = null;
  let idbDb: IDBDatabase | null = null;

  async function getTauriPaths() {
    if (dataDir) return dataDir;
    try {
      const paths = await invoke<{ dataDir: string }>("get_app_paths");
      dataDir = paths.dataDir;
      return dataDir;
    } catch {
      return null;
    }
  }

  async function openIndexedDb(): Promise<IDBDatabase | null> {
    if (idbDb) return idbDb;
    if (typeof indexedDB === "undefined") return null;
    return new Promise((resolve) => {
      const req = indexedDB.open(IDB_NAME, IDB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_CONVS)) {
          db.createObjectStore(STORE_CONVS, { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains(STORE_MSGS)) {
          db.createObjectStore(STORE_MSGS, { keyPath: "id" });
        }
      };
      req.onsuccess = () => {
        idbDb = req.result;
        resolve(idbDb);
      };
      req.onerror = () => resolve(null);
    });
  }

  async function saveToStorage() {
    if (isTauri()) {
      try {
        const dir = await getTauriPaths();
        if (dir) {
          const convsArr = [...conversations.values()];
          await invoke("write_text_file", {
            path: `${dir}/conversations.json`,
            contents: JSON.stringify(convsArr, null, 2),
          });

          const msgsObj: Record<string, Message[]> = {};
          for (const [convId, map] of messages.entries()) {
            msgsObj[convId] = [...map.values()];
          }
          await invoke("write_text_file", {
            path: `${dir}/messages.json`,
            contents: JSON.stringify(msgsObj, null, 2),
          });
          return;
        }
      } catch (e) {
        console.warn("Tauri filesystem write failed, falling back to IndexedDB:", e);
      }
    }

    const idb = await openIndexedDb();
    if (idb) {
      try {
        const tx = idb.transaction([STORE_CONVS, STORE_MSGS], "readwrite");
        const convStore = tx.objectStore(STORE_CONVS);
        const msgStore = tx.objectStore(STORE_MSGS);

        convStore.clear();
        for (const conv of conversations.values()) {
          convStore.put(conv);
        }

        msgStore.clear();
        for (const [convId, map] of messages.entries()) {
          for (const msg of map.values()) {
            msgStore.put({ ...msg, conversationId: convId });
          }
        }
      } catch (e) {
        console.warn("IndexedDB save failed:", e);
      }
    }
  }

  async function loadFromStorage() {
    if (isTauri()) {
      try {
        const dir = await getTauriPaths();
        if (dir) {
          const rawConvs = await invoke<string | null>("read_file_text", {
            path: `${dir}/conversations.json`,
          }).catch(() => null);
          if (rawConvs) {
            const parsed: Conversation[] = JSON.parse(rawConvs);
            for (const c of parsed) {
              conversations.set(c.id, c);
            }
          }

          const rawMsgs = await invoke<string | null>("read_file_text", {
            path: `${dir}/messages.json`,
          }).catch(() => null);
          if (rawMsgs) {
            const parsed: Record<string, Message[]> = JSON.parse(rawMsgs);
            for (const [convId, msgList] of Object.entries(parsed)) {
              const map = new Map<string, Message>();
              for (const m of msgList) {
                map.set(m.id, m);
                if (m.attachments?.length) {
                  attachments.set(m.id, m.attachments);
                }
              }
              messages.set(convId, map);
            }
          }
          if (conversations.size > 0) return;
        }
      } catch (e) {
        console.warn("Tauri filesystem read failed:", e);
      }
    }

    const idb = await openIndexedDb();
    if (idb) {
      try {
        const tx = idb.transaction([STORE_CONVS, STORE_MSGS], "readonly");
        const convStore = tx.objectStore(STORE_CONVS);
        const msgStore = tx.objectStore(STORE_MSGS);

        const convReq = convStore.getAll();
        convReq.onsuccess = () => {
          for (const c of convReq.result as Conversation[]) {
            conversations.set(c.id, c);
          }
        };

        const msgReq = msgStore.getAll();
        msgReq.onsuccess = () => {
          for (const m of msgReq.result as Message[]) {
            const map = messages.get(m.conversationId) ?? new Map();
            map.set(m.id, m);
            messages.set(m.conversationId, map);
            if (m.attachments?.length) {
              attachments.set(m.id, m.attachments);
            }
          }
        };

        await new Promise((res) => {
          tx.oncomplete = res;
          tx.onerror = res;
        });
      } catch (e) {
        console.warn("IndexedDB load failed:", e);
      }
    }
  }

  function sortedConversations(): Conversation[] {
    return [...conversations.values()].sort((a, b) =>
      b.updatedAt.localeCompare(a.updatedAt),
    );
  }

  return {
    async initDb() {
      await loadFromStorage();
    },

    async pruneEmptyConversations() {
      let changed = false;
      for (const [id, conv] of conversations) {
        const hasMessages = (messages.get(id)?.size ?? 0) > 0;
        if (!hasMessages && conv.title === "New chat") {
          conversations.delete(id);
          messages.delete(id);
          attachments.delete(id);
          changed = true;
        }
      }
      if (changed) await saveToStorage();
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
      await saveToStorage();
    },

    async renameConversation(id, title) {
      const conv = conversations.get(id);
      if (conv) {
        conversations.set(id, { ...conv, title });
        await saveToStorage();
      }
    },

    async touchConversation(id, updatedAt) {
      const conv = conversations.get(id);
      if (conv) {
        conversations.set(id, { ...conv, updatedAt });
        await saveToStorage();
      }
    },

    async deleteConversation(id) {
      conversations.delete(id);
      messages.delete(id);
      attachments.delete(id);
      await saveToStorage();
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
      await saveToStorage();
    },

    async updateMessageContent(id, content) {
      for (const bucket of messages.values()) {
        const msg = bucket.get(id);
        if (msg) {
          bucket.set(id, { ...msg, content });
          await saveToStorage();
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