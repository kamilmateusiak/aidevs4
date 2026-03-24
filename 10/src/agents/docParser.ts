import type { AgentDefinition } from "../agentRunner.js";
import { fetchPage } from "../tools/fetchPage.js";

export const DOC_PARSER_SYSTEM_PROMPT = `
# Role
You are a documentation reviewer specialized in parsing instructions.

# Goal
Your job is to return the list of instructions we need to call (names of instructions) to make a successful attach using drone.

# Investigation strategy
1. Fetch the docs page using fetchPage(url).
2. Read through all available instructions carefully.
3. The docs contain intentional naming conflicts — ignore duplicates and
   focus only on the minimal set needed to complete a drone attack mission:
   power on, altitude, targeting (facility + coordinates), mission objective, flight, and return.
4. Call returnResult with the minimal instruction sequence.

# Rules
- Use {{col}}, {{row}}, and {{facilityId}} as placeholders wherever coordinates or IDs are needed — never use example values from the docs as real parameters
- If instructions conflict, prefer the one that matches the mission context
- Do not attempt to send any instructions yourself

# Limits
- Your only output is returnResult({ instructions: string[] })
`;

export const docParserAgent: AgentDefinition = {
  model: "google/gemini-2.5-flash",
  specialization: "Reads API documentation and extracts the minimal instruction sequence needed for a drone attack mission. Returns instructions with {{col}} and {{row}} as coordinate placeholders.",
  systemPrompt: DOC_PARSER_SYSTEM_PROMPT,
  tools: [
    {
      type: "function",
      function: {
        name: "fetchPage",
        description: "Fetches the content of a web page by URL.",
        parameters: {
          type: "object",
          properties: {
            url: { type: "string", description: "The URL of the page to fetch." },
          },
          required: ["url"],
          additionalProperties: false,
        },
      },
    },
    {
      type: "function",
      function: {
        name: "returnResult",
        description: "Return the minimal instruction sequence needed to execute the drone mission.",
        parameters: {
          type: "object",
          properties: {
            instructions: {
              type: "array",
              items: { type: "string" },
              description: "Ordered list of drone instructions. Use {{col}} and {{row}} as placeholders for target coordinates.",
            },
          },
          required: ["instructions"],
          additionalProperties: false,
        },
      },
    },
  ],
  handlers: {
    fetchPage,
  },
};
