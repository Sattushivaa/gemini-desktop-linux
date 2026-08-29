PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS conversations (
  id         TEXT PRIMARY KEY NOT NULL,
  title      TEXT NOT NULL DEFAULT 'New chat',
  model      TEXT NOT NULL DEFAULT 'gemini-2.5-flash',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS messages (
  id              TEXT PRIMARY KEY NOT NULL,
  conversation_id TEXT NOT NULL,
  role            TEXT NOT NULL CHECK (role IN ('user', 'model')),
  content         TEXT NOT NULL DEFAULT '',
  created_at      TEXT NOT NULL,
  sequence        INTEGER NOT NULL,
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_messages_conversation_sequence
  ON messages (conversation_id, sequence);

CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages (conversation_id);
CREATE INDEX IF NOT EXISTS idx_conversations_updated_at ON conversations (updated_at);

CREATE TABLE IF NOT EXISTS attachments (
  id              TEXT PRIMARY KEY NOT NULL,
  message_id      TEXT NOT NULL,
  filename        TEXT NOT NULL,
  mime_type       TEXT NOT NULL,
  kind            TEXT NOT NULL DEFAULT 'file',
  size            INTEGER NOT NULL DEFAULT 0,
  path            TEXT NOT NULL,
  created_at      TEXT NOT NULL,
  FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_attachments_message_id ON attachments (message_id);