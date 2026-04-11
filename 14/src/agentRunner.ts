import type { Message, ToolDefinitionJson } from "@openrouter/sdk/models";
import { openrouter } from "./openrouter.js";

export type AgentDefinition = {
  systemPrompt: string;
  tools: ToolDefinitionJson[];
  handlers: Record<string, (args: unknown) => Promise<unknown>>;
  model: string;
  hooks?: {
    onToolCallFinish?: (toolName: string, args: unknown, result: unknown, messages: Message[]) => Promise<string | null>;
  }
};

const MAX_TOOL_CALLS = 40;

export async function runAgent(agentDef: AgentDefinition, task: string ): Promise<unknown> {
  const messages: Message[] = [
    { role: "system", content: agentDef.systemPrompt },
    { role: "user", content: task },
  ];

  let toolCallCount = 0;

  while (toolCallCount < MAX_TOOL_CALLS) {
    const response = await openrouter.chat.send({
      chatGenerationParams: {
        model: agentDef.model,
        messages,
        tools: agentDef.tools,
      },
    });

    const message = response.choices[0]?.message;
    if (!message) throw new Error("No message in response");

    messages.push(message as Message);

    if (message.toolCalls && message.toolCalls.length > 0) {
      for (const toolCall of message.toolCalls) {
        toolCallCount++;

        const args = JSON.parse(toolCall.function.arguments) as unknown;
        console.log(`  [${toolCall.function.name}] ${JSON.stringify(args)}`);

        if (toolCall.function.name === "returnResult") {
          return args;
        }

        const handler = agentDef.handlers[toolCall.function.name];

        if (!handler) {
          messages.push({
            role: "tool",
            toolCallId: toolCall.id,
            content: JSON.stringify({ error: `Unknown tool: ${toolCall.function.name}` }),
          } as Message);
          continue;
        }

        const result = await handler(args);

        messages.push({
          role: "tool",
          toolCallId: toolCall.id,
          content: JSON.stringify(result),
        } as Message);

        const toolCallFinishMessage = await agentDef.hooks?.onToolCallFinish?.(toolCall.function.name, args, result, messages);

        if (toolCallFinishMessage) {
          messages.push({
            role: "user",
            content: toolCallFinishMessage
          })
        }
      }
    } else {
      console.log(`  [text] ${message.content}`);
      messages.push({
        role: "user",
        content: "Keep going. Call tools to complete the task.",
      } as Message);
    }
  }

  throw new Error("Agent exceeded max tool calls without calling returnResult");
}
