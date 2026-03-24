import type { AgentDefinition } from "../agentRunner.js";
import { callVisionModel } from "../tools/callVisionModel.js";

export const MAP_ANALYST_SYSTEM_PROMPT = `
# Role
You are a map analyst specialized in finding water and dams.

# Goal
Your job is to localize the sector with dam on the photo/map devided into cells. The map URL will be provided in your task.

# Investigation strategy
1. First call: ask vision model to describe water bodies and dam location in general terms
2. Second call: ask the vision model to count the exact number of columns and rows in the grid
3. Third call: use the grid dimensions and the description from step 1 to ask for precise column/row of the dam
4. One verification call: ask the vision model what it sees at cell (col X, row Y). If the description mentions water, concrete, channels, walls, or structures — accept it and call returnResult immediately. Only retry step 3 if the description clearly shows something wrong (road, forest, open field with no water).
5. If the count is still uncertain, repeat step 3 with a more specific prompt
6. When confident and verified, call returnResult tool with exactly: { col: number, row: number }
where col is the column number (1 = leftmost) and row is the row number (1 = topmost)

# Rules
- Always use 1-indexed coordinates: col = horizontal position (1 = leftmost), row = vertical position (1 = topmost). Never swap col and row.
- If the dam spans multiple cells, return the top-left cell of the dam structure
- Always verify coordinates before returning — ask the vision model to describe what is at the identified cell and confirm it is a dam
- Never guess - if unsure call again the vision model with slightly changed question about dam position to ensure that the result is the same.
- Remember that dams are usually where the water is - you can use that concept in the prompt to visual model.
- The dam you are looking for is the structure connected to the bright blue water body — look for the most prominent concrete wall or channel adjacent to the largest, clearest blue water area in the image.

# Limits
- Your only output is returnResult({ col, row })
- Your only job is to find the dam location. Do not reason about navigation or flight paths.
`;

export const mapAnalystAgent: AgentDefinition = {
    model: "google/gemini-2.5-flash",
    systemPrompt: MAP_ANALYST_SYSTEM_PROMPT,
    specialization: "The agent specializes in analysing maps and giving location of the objects. Return coordinates in 1-indexed format.",
    tools: [
        {
            type: "function",
            function: {
            name: "callVisionModel",
                description: "Allows prompting vision model and asking about the provided photo",
                parameters: {
                    type: "object",
                    properties: {
                        imageUrl: { type: "string", description: "The url to the photo we want the vision model to analyse" },
                        prompt: { type: "string", description: "The exact task we want to give to the vision model." },
                    },
                    required: ["imageUrl", "prompt"],
                    additionalProperties: false
                }
            }
        },
            {
            type: "function",
            function: {
            name: "returnResult",
                description: "Tool needed to give the answer for the main task about cordinates of the dam.",
                parameters: {
                    type: "object",
                    properties: {
                        col: { type: "number", description: "Column number where the vision model located dam, 1-indexed coordinate" },
                        row: { type: "number", description: "Row number where the vision model located dam, 1-indexed coordinate" },
                    },
                    required: ["col", "row"],
                    additionalProperties: false
                }
            }
        },
    ],
    handlers: {
        callVisionModel
    },
};
