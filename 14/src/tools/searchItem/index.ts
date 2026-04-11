import { runAgent, type AgentDefinition } from "../../agentRunner.js";
import { searchItemsHandler, searchItemsToolDefinition, type Item } from "./tools/searchItems.js";
import { makeValidateResultsHandler, validateResultsToolDefinition } from "./tools/validateResults.js";

const SYSTEM_PROMPT = `You are searching a Polish electronics components database.
Your goal: find items that best match the user's query.

Steps:
1. Call searchItems with 2-4 individual Polish keywords (single words, no phrases).
   Include product name words AND specs (e.g. "inwerter", "48v", "400w").
2. Call validateResults with the found items.
   - If approved: call returnResult with items (top 5 max).
   - If rejected: read the reason, adjust your keywords, and try again.

Rules:
- Keywords must be Polish (not English).
- Each keyword is a single word.
- Specs: normalize to lowercase without spaces ("48V" → "48v").
- Never give up without trying at least 2 different keyword combinations.`;

const returnResultToolDefinition: AgentDefinition["tools"][number] = {
  type: "function",
  function: {
    name: "returnResult",
    description: "Return the final approved items (max 5). Call only after validation passes.",
    parameters: {
      type: "object",
      properties: {
        items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              itemCode: { type: "string" },
              itemName: { type: "string" },
            },
            required: ["itemCode", "itemName"],
            additionalProperties: false,
          },
        },
      },
      required: ["items"],
      additionalProperties: false,
    },
  },
};

function makeSearchAgent(validateResults: (args: unknown) => Promise<unknown>): AgentDefinition {
  return {
    model: "google/gemini-2.5-flash-lite",
    systemPrompt: SYSTEM_PROMPT,
    tools: [searchItemsToolDefinition, validateResultsToolDefinition, returnResultToolDefinition],
    handlers: {
      searchItems: searchItemsHandler,
      validateResults,
    },
  };
}

export async function handleSearchItem(params: string): Promise<{ output: string }> {
  const validateResults = makeValidateResultsHandler(params);
  const agent = makeSearchAgent(validateResults);

  const result = (await runAgent(agent, `Find items matching: "${params}"`)) as { items: Item[] };

  return {
    output: JSON.stringify(result.items.slice(0, 5)),
  };
}
