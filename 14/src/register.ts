import { config } from "./config.js";
import { withRetry, withPoll } from "./utils/retry.js";

const SEARCH_ITEM_DESCRIPTION = `
Searches the items database for electronic components matching a description. 
Pass a natural language query in params (e.g. "copper wire 10 meters"). Use polish language.
Returns JSON with property 'output' containing an array of matching items, each with itemCode and itemName. 
`;

const LOCATE_CITIES_DESCRIPTION = `
Finds cities that sell ALL specified items simultaneously. Pass a stringified 
JSON array of item codes in params (e.g. '["CODE1","CODE2","CODE3"]'). Returns JSON with 
property 'output' containing an array of city names that carry all requested items.
`;

export async function register(): Promise<void> {
  const body = {
    apikey: config.AIDEVS_HUB_API_KEY,
    task: "negotiations",
    answer: {
      tools: [
        {
          URL: `${config.PUBLIC_URL}/search-item`,
          description: SEARCH_ITEM_DESCRIPTION
        },
        {
          URL: `${config.PUBLIC_URL}/locate-cities`,
          description: LOCATE_CITIES_DESCRIPTION
        },
      ],
    },
  };

  const response = await withRetry(() => fetch(`${config.AIDEVS_HUB_BASE_URL}/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }));

  const data = await response.json();
  console.log("[register] Response:", JSON.stringify(data, null, 2));
}

async function fetchResult(): Promise<Record<string, unknown>> {
  const body = {
    apikey: config.AIDEVS_HUB_API_KEY,
    task: "negotiations",
    answer: { action: "check" },
  };

  const response = await fetch(`${config.AIDEVS_HUB_BASE_URL}/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  return response.json() as Promise<Record<string, unknown>>;
}

register()
  .then(() => withPoll(
    fetchResult,
    (data) => {
      console.log("[checkResult] Checking response: ", JSON.stringify(data, null, 2))
      return typeof data["code"] === "number" && data["code"] < 0
    },
    { maxRetries: 15, delay: 5000 }
  ))
  .then((data) => console.log("[checkResult] Final response:", JSON.stringify(data, null, 2)))
  .catch((err: Error) => console.error("[error]", err.message));
