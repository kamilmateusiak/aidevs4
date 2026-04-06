import { config } from "../config.js";

export type ReactorCommand = "start" | "left" | "right" | "wait" | "reset";

export async function reactorCommand(args: unknown): Promise<unknown> {
  const { command } = args as { command: ReactorCommand };

  const res = await fetch(`${config.AIDEVS_HUB_BASE_URL}/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      apikey: config.AIDEVS_HUB_API_KEY,
      task: "reactor",
      answer: { command },
    }),
  });

  const data: unknown = await res.json();
  console.log(`  [reactor:${command}]`, JSON.stringify(data));
  return data;
}

export const reactorCommandToolDefinition = {
  type: "function",
  function: {
    name: "reactorCommand",
    description:
      "Send a command to the reactor robot and receive the updated board state. " +
      "Available commands: start (must be first), right (move one column right), " +
      "left (move one column left), wait (stay in place, blocks still move), " +
      "reset (restart from beginning if robot is destroyed).",
    parameters: {
      type: "object",
      properties: {
        command: {
          type: "string",
          enum: ["start", "left", "right", "wait", "reset"],
          description: "The command to send to the robot.",
        },
      },
      required: ["command"],
      additionalProperties: false,
    },
  },
} as const;
