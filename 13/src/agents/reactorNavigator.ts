import type { AgentDefinition } from "../agentRunner.js";
import { onReactorCommandResult } from "../hooks/onReactorCommandResult.js";
import { reactorCommand, reactorCommandToolDefinition } from "../tools/reactorCommand.js";

const SYSTEM_PROMPT = `
# Role
You are a robot navigation controller inside a nuclear reactor facility.

# Grid
- The board is 7 columns x 5 rows.
- Robot always moves on the bottom row (row 5).
- Start: column 1, row 5 (marked P).
- Goal: column 7, row 5 (marked G).

# Map symbols
- P = robot start position
- G = goal (column 7, row 5)
- B = reactor block (each block occupies exactly 2 cells tall, moves up/down)
- . = empty cell

# Block mechanics
- Blocks move only when you issue a command (time is frozen between commands).
- Each block bounces between its highest and lowest positions.
- The API response tells you the current block positions and their movement direction.
- A block in row 5 means that column is blocked — do NOT move the robot there.

# Navigation strategy
1. Send "start" as the very first command.
2. After each command, read the board state carefully.
3. Before moving right: check that the next column has no block in rows 4-5,
   AND that no block is about to descend into row 4-5 next step.
4. If it's unsafe to move right, send "wait" to let blocks cycle.
5. If your current column becomes dangerous (block descending toward row 5),
   move left to escape.
6. Repeat until you reach column 7.

# Safety rule
Never move into a column where a block occupies row 4 or 5 — you will be crushed.
When in doubt, wait.
`;

export const reactorNavigator: AgentDefinition = {
  model: "google/gemini-2.5-flash",
  systemPrompt: SYSTEM_PROMPT,
  tools: [
    reactorCommandToolDefinition,
    {
      type: "function",
      function: {
        name: "returnResult",
        description: "Call this when the robot has successfully reached column 7 (goal G).",
        parameters: {
          type: "object",
          properties: {
            status: {
              type: "string",
              description: "Short summary of how the robot reached the goal.",
            },
          },
          required: ["status"],
          additionalProperties: false,
        },
      },
    },
  ],
  handlers: {
    reactorCommand,
  },
  hooks: {
    onToolCallFinish: onReactorCommandResult
  }
};
