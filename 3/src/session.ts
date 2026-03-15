import { mkdirSync, existsSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import type { Message } from "@openrouter/sdk/models";

export type StoredEntry =
  | { type: "message"; data: Message }
  | { type: "compressed"; msg: string };

const SESSIONS_DIR = "sessions";

function getSessionDir(sessionId: string): string {
  return join(SESSIONS_DIR, sessionId);
}

function ensureSessionDir(sessionId: string): void {
  const dir = getSessionDir(sessionId);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

function getMessagesPath(sessionId: string): string {
  return join(getSessionDir(sessionId), "messages.json");
}

function getArchivePath(sessionId: string): string {
  return join(getSessionDir(sessionId), "archive.json");
}

export function loadMessages(sessionId: string): StoredEntry[] {
  ensureSessionDir(sessionId);
  const path = getMessagesPath(sessionId);
  if (!existsSync(path)) return [];
  return JSON.parse(readFileSync(path, "utf-8")) as StoredEntry[];
}

export function saveMessages(sessionId: string, entries: StoredEntry[]): void {
  ensureSessionDir(sessionId);
  writeFileSync(getMessagesPath(sessionId), JSON.stringify(entries, null, 2));
}

function appendToArchive(sessionId: string, entries: StoredEntry[]): void {
  ensureSessionDir(sessionId);
  const path = getArchivePath(sessionId);
  const existing: StoredEntry[] = existsSync(path)
    ? (JSON.parse(readFileSync(path, "utf-8")) as StoredEntry[])
    : [];
  writeFileSync(path, JSON.stringify([...existing, ...entries], null, 2));
}

export function loadArchive(sessionId: string): StoredEntry[] {
  const path = getArchivePath(sessionId);
  if (!existsSync(path)) return [];
  return JSON.parse(readFileSync(path, "utf-8")) as StoredEntry[];
}

/** Text search through archive entries. Returns matching entries. */
export function searchArchive(sessionId: string, query: string): StoredEntry[] {
  const archive = loadArchive(sessionId);
  const q = query.toLowerCase();

  return archive.filter((entry) => {
    if (entry.type === "compressed") {
      return entry.msg.toLowerCase().includes(q);
    }
    const content = entry.data.content;
    if (typeof content === "string") return content.toLowerCase().includes(q);
    if (Array.isArray(content)) {
      return content.some((part) => {
        if (typeof part === "object" && part !== null && "text" in part) {
          return String(part.text).toLowerCase().includes(q);
        }
        return false;
      });
    }
    return false;
  });
}

/**
 * Compress: archive all current messages, replace with a single compressed entry.
 *
 * Note: the assistant message that triggered this tool call is already in messages.json
 * at this point (appended before tool dispatch). That message — and its orphaned tool
 * result — will also be archived. The next LLM turn will see only:
 *   [system, compressed_entry, tool_result_for_compress_context]
 * This is a known edge case; capable models handle it gracefully with a good system prompt.
 */
export function compressMessages(
  sessionId: string,
  summary: string
): { archived: number } {
  const current = loadMessages(sessionId);
  appendToArchive(sessionId, current);
  saveMessages(sessionId, [{ type: "compressed", msg: summary }]);
  return { archived: current.length };
}

export function appendMessage(sessionId: string, message: Message): void {
  const entries = loadMessages(sessionId);
  entries.push({ type: "message", data: message });
  saveMessages(sessionId, entries);
}

/** Convert stored entries to the Message[] format expected by the LLM. */
export function entriesToMessages(entries: StoredEntry[]): Message[] {
  return entries.map((entry): Message => {
    if (entry.type === "message") return entry.data;
    return {
      role: "system",
      content: `[Compressed context summary]\n${entry.msg}`,
    };
  });
}
