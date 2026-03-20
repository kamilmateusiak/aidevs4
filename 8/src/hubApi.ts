import { writeFile, mkdir, unlink } from "fs/promises";
import { config } from "./config.js";

const BASE = config.AIDEVS_HUB_BASE_URL;
const KEY = config.AIDEVS_HUB_API_KEY;
const TASK = "failure";
const LOG_PATH = new URL("../data/failure.log", import.meta.url).pathname;

export async function downloadLogs(): Promise<string> {
  await mkdir(new URL("../data", import.meta.url).pathname, { recursive: true });
  await unlink(LOG_PATH).catch(() => {});
  console.log("Downloading log file...");
  const res = await fetch(`${BASE}/data/${KEY}/${TASK}.log`);
  if (!res.ok) throw new Error(`Log download failed: ${res.status}`);
  const text = await res.text();
  await writeFile(LOG_PATH, text, "utf-8");
  console.log(`Saved to ${LOG_PATH}`);
  return LOG_PATH;
}

export async function verifyAnswer(logs: string): Promise<unknown> {
  const res = await fetch(`${BASE}/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ apikey: KEY, task: TASK, answer: { logs } }),
  });
  const data: unknown = await res.json();
  console.log("Centrala response:", JSON.stringify(data, null, 2));
  return data;
}
