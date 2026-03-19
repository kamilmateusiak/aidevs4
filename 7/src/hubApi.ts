import { config } from "./config.js";

const BASE = config.AIDEVS_HUB_BASE_URL;
const KEY = config.AIDEVS_HUB_API_KEY;
const TASK = "electricity";

export async function fetchBoardPng(reset = false): Promise<Buffer> {
  const url = `${BASE}/data/${KEY}/${TASK}.png${reset ? "?reset=1" : ""}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Board fetch failed: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

export async function fetchTargetPng(): Promise<Buffer> {
  const res = await fetch(`${BASE}/i/solved_electricity.png`);
  if (!res.ok) throw new Error(`Target fetch failed: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

export async function rotateCell(cell: string): Promise<{ flag?: string; raw: unknown }> {
  const res = await fetch(`${BASE}/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ apikey: KEY, task: TASK, answer: { rotate: cell } }),
  });
  const data: unknown = await res.json();
  const raw = JSON.stringify(data);
  const match = raw.match(/\{FLG:[^}]+\}/);
  return match ? { flag: match[0], raw: data } : { raw: data };
}
