import "dotenv/config";
import type { Message, ToolDefinitionJson } from "@openrouter/sdk/models";
import { openrouter } from "./openrouter.js";
import { fetchBoardPng, fetchTargetPng, rotateCell } from "./hubApi.js";
import { describeBoard, type BoardState } from "./vision.js";

const AGENT_MODEL = "openai/gpt-4o";
const MAX_ITERATIONS = 15;

function buildSystemPrompt(targetState: BoardState): string {
  return `You are solving a 3x3 electrical cable puzzle. Your goal is to rotate cells
until the board matches the TARGET STATE below.

## Rotation rules (each call = 90° clockwise)
- top → right → bottom → left → top
- To rotate counterclockwise: call rotate 3 times on the same cell

## Target state (fixed, never changes)
${JSON.stringify(targetState, null, 2)}

## Instructions
- You MUST call the rotate tool for every cell that does not match the target
- After all rotations are sent, stop calling tools
- The system will re-read the board and call you again if needed`;
}

const rotateTool: ToolDefinitionJson = {
  type: "function" as const,
  function: {
    name: "rotate",
    description: "Rotate a cell 90 degrees clockwise. Each call = 1 rotation = 1 API request.",
    parameters: {
      type: "object",
      properties: {
        cell: {
          type: "string",
          description: 'Cell address in RowxCol format, e.g. "2x3". Row 1 is top, col 1 is left.',
        },
      },
      required: ["cell"],
      additionalProperties: false,
    },
  },
};

async function runAgentIteration(
  systemPrompt: string,
  currentState: BoardState
): Promise<{ flag?: string }> {
  const messages: Message[] = [
    { role: "system", content: systemPrompt },
    {
      role: "user",
      content: `Current board state:\n${JSON.stringify(currentState, null, 2)}\n\nPlease rotate the cells to match the target.`,
    },
  ];

  while (true) {
    const response = await openrouter.chat.send({
      chatGenerationParams: {
        model: AGENT_MODEL,
        messages,
        tools: [rotateTool],
      },
    });

    const message = response.choices[0]?.message;
    if (!message) throw new Error("No message in response");

    messages.push(message as Message);

    if (message.toolCalls && message.toolCalls.length > 0) {
      for (const toolCall of message.toolCalls) {
        const args = JSON.parse(toolCall.function.arguments) as { cell: string };
        console.log(`  → rotating ${args.cell}`);

        const result = await rotateCell(args.cell);
        console.log(`    response:`, result.raw);

        if (result.flag) {
          console.log(`\n✓ Flag found: ${result.flag}`);
          return { flag: result.flag };
        }

        // Feed result back so the agent knows what happened and can continue
        messages.push({
          role: "tool",
          toolCallId: toolCall.id,
          content: JSON.stringify(result.raw),
        } as Message);
      }
    } else {
      // No tool calls — nudge the agent to keep going if board isn't solved yet
      console.log("Agent said:", message.content);
      messages.push({ role: "user", content: "Continue using the rotate tool if any cells still differ from the target." } as Message);

      // Safety: if agent explicitly says it's done, break
      if (message.content?.toLowerCase().includes("done") || message.content?.toLowerCase().includes("match")) {
        break;
      }
    }
  }

  return {};
}

// ── Main ──────────────────────────────────────────────────────────────────────

console.log("Resetting board...");
await fetchBoardPng(true);

console.log("Fetching target board and describing with vision model...");
const targetPng = await fetchTargetPng();
const targetState = await describeBoard(targetPng);
console.log("Target state:", JSON.stringify(targetState, null, 2));

const systemPrompt = buildSystemPrompt(targetState);

for (let i = 0; i < MAX_ITERATIONS; i++) {
  console.log(`\n=== Iteration ${i + 1} / ${MAX_ITERATIONS} ===`);

  const currentPng = await fetchBoardPng();
  const currentState = await describeBoard(currentPng);
  console.log("Current state:", JSON.stringify(currentState, null, 2));

  const { flag } = await runAgentIteration(systemPrompt, currentState);
  if (flag) process.exit(0);
}

console.log("Max iterations reached without finding flag.");
