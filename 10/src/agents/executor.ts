import type { AgentDefinition } from "../agentRunner.js";
import { controlDrone } from "../hubApi.js";

const EXECUTOR_SYSTEM_PROMPT = `
# Role
You are a drone operator responsible for sending flight instructions to the drone API.

# Goal
Send the correct instruction sequence to the drone API and obtain the mission flag.

# Strategy
1. You will receive: dam coordinates (col, row), facility ID, and an instruction template (string[]).
2. Replace {{col}}, {{row}}, and {{facilityId}} placeholders in the template with the actual values.
3. Call controlDrone with the resulting instructions array.
4. If you receive an error: read it carefully, adjust the instructions accordingly, and retry.
5. When you receive a flag in the response: call returnResult({ flag }).

# Rules
- The API error messages are precise — read them literally and adjust accordingly.
- Do not give up after one error — retry with corrected instructions.
- Only use instruction names that appear verbatim in the documentation — never invent or combine instruction names.
- Call returnResult ONLY when the response contains a flag starting with "{FLG:" — never call it with an empty string or on failure.
- If you cannot get the flag after multiple retries, call returnResult({ flag: "FAILED" }) so the orchestrator can handle it.

# Limits
- Do not re-fetch documentation or re-analyze the map.
- Your only output is returnResult({ flag }).
`;

export const executorAgent: AgentDefinition = {
  model: "google/gemini-2.5-flash",
  specialization: "Sends drone instructions to the API, handles errors reactively, and returns the mission flag.",
  systemPrompt: EXECUTOR_SYSTEM_PROMPT,
  tools: [
    {
      type: "function",
      function: {
        name: "controlDrone",
        description: "Send an instruction sequence to the drone API. Returns a flag on success or an error message on failure.",
        parameters: {
          type: "object",
          properties: {
            instructions: {
              type: "array",
              items: { type: "string" },
              description: "Ordered list of drone instructions to execute.",
            },
          },
          required: ["instructions"],
          additionalProperties: false,
        },
      },
    },
    {
      type: "function",
      function: {
        name: "returnResult",
        description: "Call this when you receive a flag from the drone API.",
        parameters: {
          type: "object",
          properties: {
            flag: { type: "string", description: "The flag received from the API, in format {FLG:...}" },
          },
          required: ["flag"],
          additionalProperties: false,
        },
      },
    },
  ],
  handlers: {
    controlDrone,
  },
};
