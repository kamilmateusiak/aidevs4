import type { ToolDefinitionJson } from "@openrouter/sdk/models";
import { data } from "../../../loadData.js";

export type Item = { itemCode: string; itemName: string };

export async function searchItemsHandler(args: unknown): Promise<{ results: Item[]; message: string }> {
  const { keywords } = args as { keywords: string[] };

  const results = data.itemsList
    .filter((item) => {
      const nameLower = item.name.toLowerCase();
      return keywords.every((k) => nameLower.includes(k.toLowerCase()));
    })
    .slice(0, 10)
    .map((r) => ({ itemCode: r.code, itemName: r.name }));

  if (results.length === 0) {
    return { results: [], message: "No results. Try different or fewer Polish keywords." };
  }
  return { results, message: `Found ${results.length} item(s).` };
}

export const searchItemsToolDefinition: ToolDefinitionJson = {
  type: "function",
  function: {
    name: "searchItems",
    description: "Search the Polish electronics database using keywords. Returns matching items.",
    parameters: {
      type: "object",
      properties: {
        keywords: {
          type: "array",
          items: { type: "string" },
          description: "Individual Polish keywords to match against item names (e.g. ['inwerter', '48v'])",
        },
      },
      required: ["keywords"],
      additionalProperties: false,
    },
  },
};
