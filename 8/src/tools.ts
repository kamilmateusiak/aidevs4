import { readFile } from "fs/promises";
import { z } from "zod";
import { verifyAnswer } from "./hubApi.js";

const LOG_PATH = new URL("../data/failure.log", import.meta.url).pathname;

const CentralaResponse = z.object({
  code: z.number(),
  message: z.string(),
});

export async function searchLogs(
  query?: string,
  level?: "CRIT" | "ERRO" | "WARN" | "INFO",
  limit?: number
): Promise<string> {
  const text = await readFile(LOG_PATH, "utf-8");
  const lines = text.split("\n");
  const matches = lines.filter((line) => {
    if (query && !line.toLowerCase().includes(query.toLowerCase())) return false;
    if (level && !line.includes(`[${level}]`)) return false;
    return true;
  });
  const result = limit ? matches.slice(0, limit) : matches;
  return result.length > 0 ? result.join("\n") : "(no matches)";
}

export function countTokens(logs: string): number {
  return Math.ceil(logs.length / 4);
}

// ── Accumulated log state ─────────────────────────────────────────────────────

let accumulatedLines: string[] = [];

export function resetAccumulator(): void {
  accumulatedLines = [];
}

export function accumulateLogs(newEntries: string): { logs: string; tokens: number } {
  const incoming = newEntries.split("\n").map((l) => l.trim()).filter(Boolean);
  const existing = new Set(accumulatedLines);
  for (const line of incoming) {
    if (!existing.has(line)) accumulatedLines.push(line);
  }
  accumulatedLines.sort((a, b) => a.localeCompare(b));
  const logs = accumulatedLines.join("\n");
  return { logs, tokens: countTokens(logs) };
}

export async function sendLogs(
  logs: string
): Promise<{ feedback: string } | { flag: string }> {
  const data = CentralaResponse.parse(await verifyAnswer(logs));
  const match = data.message.match(/\{FLG:[^}]+\}/);
  if (match) return { flag: match[0] };
  return { feedback: data.message };
}
