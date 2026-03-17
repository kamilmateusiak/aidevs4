import { config } from "./config.js";
import { withRetry } from "./retry.js";

const ENDPOINT = `${config.AIDEVS_HUB_BASE_URL}/verify`;
const TASK = "railway";

export async function callRailwayApi(answer: Record<string, unknown>): Promise<unknown> {
  const body = {
    apikey: config.AIDEVS_HUB_API_KEY,
    task: TASK,
    answer,
  };

  console.log(`[API →] ${JSON.stringify(answer)}`);

  const response = await withRetry(() =>
    fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
  );

  const data = await response.json();
  console.log(`[API ←] ${JSON.stringify(data)}`);
  return data;
}
