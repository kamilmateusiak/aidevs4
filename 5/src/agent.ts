import "dotenv/config";
import { openrouter } from "./openrouter.js";
import type { Message } from "@openrouter/sdk/models";
import { SYSTEM_PROMPT } from "./prompt.js";
import { callRailwayApi } from "./railwayApi.js";

const MAX_ITERATIONS = 15;
const MODEL = "openai/gpt-4.1";

const messages: Message[] = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: "Activate route X-01 following instructions." },
];

const toolName = "call_railway_api";

for (let i = 0; i < MAX_ITERATIONS; i++) {
    console.log(`\n--- Iteration ${i + 1} ---`);

    const response = await openrouter.chat.send({
        chatGenerationParams: {
            model: MODEL,
            messages,
            tools: [{
                type: "function",
                function: {
                    name: toolName,
                    description: "Sends a request to the railway control system. Build the 'answer' object according to the API documentation.",
                    parameters: {
                        type: "object",
                        properties: {
                            answer: {
                                type: "object",
                                description: "The complete request body. Must include 'action' and any other parameters the API docs require for that action.",
                                additionalProperties: true,
                            }
                        },
                        required: ["answer"],
                    },
                }

            }],
        },
    });

    const message = response.choices[0]?.message;
    if (!message) throw new Error("No message in response");

    messages.push(message as Message);

    if (message.toolCalls && message.toolCalls.length > 0) {
        for (const toolCall of message.toolCalls) {
            const { name, arguments: argsStr } = toolCall.function;
            console.log(`Tool call: ${name}(${argsStr})`);

            if (name !== toolName) throw new Error(`Unknown tool: ${name}`);

            const parsedArgs = JSON.parse(argsStr);
            const result = await callRailwayApi(parsedArgs.answer);

            messages.push({
                role: "tool",
                toolCallId: toolCall.id,
                content: JSON.stringify(result),
            } as Message);

            if (JSON.stringify(result).includes("{FLG:")) {
                console.log("Flag found! Task complete.");
                process.exit(0);
            }
        }
    } else {
        messages.push({ role: "user", content: "Continue using the tool to complete the task." } as Message);
    }
}
