import { config } from "./config.js";

const BASE = config.AIDEVS_HUB_BASE_URL;
const KEY = config.AIDEVS_HUB_API_KEY;

export async function controlDrone(args: unknown): Promise<unknown> {
  const { instructions } = args as { instructions: string[] };

  const res = await fetch(`${BASE}/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ apikey: KEY, task: "drone", answer: { instructions } }),
  });

  const data: unknown = await res.json();
  console.log("Drone API response:", JSON.stringify(data, null, 2));

  return data;
}
