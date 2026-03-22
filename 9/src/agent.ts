import { initMemory, readMemory, tools, handlersByToolName } from "./tools.js";
import { buildSystemPrompt } from "./prompt.js";
import type { Message } from "@openrouter/sdk/models";
import { openrouter } from "./openrouter.js";

const AGENT_MODEL = "google/gemini-3-flash-preview";
const MAX_ITERATIONS = 10;
const INNER_LOOP_MAX_TOOL_CALLS = 8;
const sessionId = String(Date.now());

async function runAgentIteration(messages: Message[]): Promise<{ flag?: string }> {
  let toolCallCount = 0;
  while (toolCallCount < INNER_LOOP_MAX_TOOL_CALLS) {
    console.log(`\n=== Inner loop iterration ${toolCallCount + 1} / ${INNER_LOOP_MAX_TOOL_CALLS} ===`);

    const response = await openrouter.chat.send({
      chatGenerationParams: {
        model: AGENT_MODEL,
        messages,
        tools,
      },
    });

    const message = response.choices[0]?.message;
    if (!message) throw new Error("No message in response");

    messages.push(message as Message);

    if (message.toolCalls && message.toolCalls.length > 0) {
      for (const toolCall of message.toolCalls) {
        toolCallCount += 1;

        if (toolCallCount === INNER_LOOP_MAX_TOOL_CALLS - 2) {
          messages.push({
            role: "user",
            content: "You are running low on tool calls. Call updateMemory with notes summarizing your progress and what still needs to be found before stopping.",
          } as Message);
        }

        if (toolCallCount >= INNER_LOOP_MAX_TOOL_CALLS) {
          console.log("Max tool calls reached.");
          return {};
        }

        const args: unknown = JSON.parse(toolCall.function.arguments);
        console.log(`Agent calls tool: ${toolCall.function.name}(${JSON.stringify(args)})`);

        const handler = handlersByToolName[toolCall.function.name];

        if (!handler) {
            console.log(`Tool not found: ${toolCall.function.name}`);
            continue;
        }

        const result = await handler(args);

        const resultStr = JSON.stringify(result);
        const flagMatch = resultStr.match(/\{FLG:[^}]+\}/);
        if (flagMatch) return { flag: flagMatch[0] };

        messages.push({
          role: "tool",
          toolCallId: toolCall.id,
          content: resultStr,
        } as Message);
      }
    } else {
      console.log("Agent said:", message.content);
      messages.push({
        role: "user",
        content: "Keep going. Call tools to complete the task.",
      } as Message);
    }
  }

  return {};
}

initMemory(sessionId);

for (let i = 0; i < MAX_ITERATIONS; i++) {
    console.log(`\n=== Iteration ${i + 1} / ${MAX_ITERATIONS} ===`);

    const memory = await readMemory();
    const systemPrompt = buildSystemPrompt(memory);

    const messages: Message[] = [
        { role: "system", content: systemPrompt },
        { role: "user", content: "Search for the information in the mailbox using tools returned by help action." },
    ];

    const { flag } = await runAgentIteration(messages);
    if (flag) process.exit(0);
}
