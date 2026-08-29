# Gemini Desktop

A native Linux desktop client for Google's Gemini API — built with Tauri 2,
React, TypeScript, Vite and SQLite.

Far from a browser tab: a real app window with streaming responses, conversation
history stored locally in SQLite, file attachments (images, PDFs, text/source),
a command palette, keyboard shortcuts and native file pickers.

## Features

- **Streaming responses** — tokens stream in live with a blinking cursor and a
  stop button.
- **Local history** — every conversation and message lives in a SQLite database
  in your app-data folder; nothing is sent anywhere except to the Gemini API.
- **Attachments** — attach images, PDFs and text/source files via the file
  picker, drag & drop, or clipboard paste. Small files go inline to Gemini;
  larger ones are uploaded through the Gemini Files API.
- **Multiple models** — gemini-2.5-flash (default), pro, and flash-lite, switch
 able per conversation.
- **Command palette** — `Ctrl+K` to switch/start chats and run actions.
- **Keyboard shortcuts** — see below.
- **Settings** — API key, default model, temperature, max output tokens, theme,
  font size, storage location.
- **Export** — save any conversation as Markdown or plain text.

## Prerequisites

- Node.js 22+ and pnpm
- A Gemini API key from <https://aistudio.google.com/apikey> (free tier works)
- Rust toolchain + the Tauri Linux system dependencies
  (webkit2gtk-4.1, gtk3, libsoup-3.0, javascriptcoregtk-4.1, ...). See
  [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/).

## Setup

```bash
pnpm install
pnpm tauri dev
```

Set your API key either in Settings → Gemini API once the app is running, or
provide it at launch with an environment variable:

```bash
GEMINI_API_KEY="..." pnpm tauri dev
```

The environment variable always takes precedence over a stored key. Stored keys
are kept in the native config directory with `0600` permissions — never in
localStorage or logs.

## Building release binaries

```bash
pnpm tauri build
```

Produces `.deb`, `.rpm` and AppImage bundles under `src-tauri/target/release/bundle/`.

## Keyboard shortcuts

| Shortcut         | Action                |
| ---------------- | --------------------- |
| `Ctrl+N`         | New chat              |
| `Ctrl+K`         | Command palette       |
| `Ctrl+,`         | Settings              |
| `Ctrl+Shift+S`   | Toggle sidebar        |
| `Esc`            | Stop generation / close dialogs |
| `Enter`          | Send                  |
| `Shift+Enter`    | Newline in composer   |

## Data & privacy

- Database, attachments and config live under your OS app-data directory
  (see Settings → Data → Storage location).
- The API key is only ever transmitted to Google's Gemini API endpoint over
  HTTPS.
- Deleting a conversation removes its rows and exported files are written only
  where you choose.

## Development notes

- Frontend: `src/` (Vite + React + Tailwind v4). State via zustand.
- Backend: `src-tauri/` (Rust). Contains the SQLite migrations in
  `src-tauri/migrations/` and the native commands in `src-tauri/src/commands/`.
- Attachments are copied into `<app_data>/attachments/<uuid>/` and served to
  the webview through Tauri's asset protocol with a scope restricted to that
  folder.
- The Gemini API key never crosses the frontend/backend IPC boundary as an
  argument; only the webview calls Gemini through the official
  `@google/genai` SDK after fetching the key from the native `get_config`
  command.