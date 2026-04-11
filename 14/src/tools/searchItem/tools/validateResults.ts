import { z } from "zod";
import type { ToolDefinitionJson } from "@openrouter/sdk/models";
import { openrouter } from "../../../openrouter.js";
import type { Item } from "./searchItems.js";

export function makeValidateResultsHandler(originalQuery: string) {
  return async function validateResultsHandler(args: unknown): Promise<{ approved: boolean; reason: string }> {
    const { items } = args as { items: Item[] };

    if (items.length === 0) {
      return { approved: false, reason: "No items to validate." };
    }

    const response = await openrouter.chat.send({
      chatGenerationParams: {
        model: "google/gemini-2.5-flash-lite",
        messages: [
          {
            role: "system",
            content: `You are a quality validator for an electronics component search.
You receive an original search query and a list of found items.
Decide if the found items genuinely match what was requested.
Be strict: if the items are wrong category, wrong spec, or clearly unrelated — reject them.
Return JSON: { "approved": boolean, "reason": string }`,
          },
          {
            role: "user",
            content: `Original query: "${originalQuery}"

Found items:
${items.map((i) => `- ${i.itemName} (${i.itemCode})`).join("\n")}

Do these items match the query?`,
          },
        ],
        responseFormat: {
          type: "json_schema",
          jsonSchema: {
            name: "validation_result",
            strict: true,
            schema: {
              type: "object",
              properties: {
                approved: { type: "boolean" },
                reason: { type: "string" },
              },
              required: ["approved", "reason"],
              additionalProperties: false,
            },
          },
        },
      },
    });

    const content = response.choices[0]?.message?.content;
    if (typeof content !== "string") throw new Error("Validator returned no content");

    const parsed = z
      .object({ approved: z.boolean(), reason: z.string() })
      .safeParse(JSON.parse(content));

    if (!parsed.success) throw new Error("Validator response invalid");
    return parsed.data;
  };
}

export const validateResultsToolDefinition: ToolDefinitionJson = {
  type: "function",
  function: {
    name: "validateResults",
    description: "Validates whether the found items actually match the original query. Returns approved + reason.",
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
          description: "Items returned by searchItems to be validated.",
        },
      },
      required: ["items"],
      additionalProperties: false,
    },
  },
};
