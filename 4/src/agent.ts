import "dotenv/config";
import { OpenRouter } from "@openrouter/sdk";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { config } from "./config.js";
import type { Message, ToolDefinitionJson } from "@openrouter/sdk/models";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { SYSTEM_PROMPT } from "./prompt.js";

const MAX_ITERATIONS = 20;
const MODEL = "google/gemini-2.0-flash-001";

async function main() {
    // --- MCP client: spawn the server and connect ---
    const transport = new StdioClientTransport({
        command: "node_modules/.bin/tsx",
        args: ["src/mcp-server.ts"],
    });
    const mcp = new Client({ name: "aidev-s01e04-client", version: "1.0.0" });
    await mcp.connect(transport);

    // Convert MCP tool schemas → OpenAI tool format
    const { tools: mcpTools } = await mcp.listTools();
    const tools: Array<ToolDefinitionJson> = mcpTools.map((t) => ({
        type: "function",
        function: {
        name: t.name,
        description: t.description ?? "",
        parameters: t.inputSchema as Record<string, unknown>,
        },
    }));

    console.log("Tools available:", tools.map((t) => t.function.name));

    const openrouter = new OpenRouter({
        apiKey: config.OPEN_ROUTER_KEY,
    });

        const messages: Message[] = [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: "Please complete and submit the transport declaration." },
        ];

        const toolDefs = tools.map((t) => ({ type: "function" as const, function: t.function }));
        const toolSet = new Set(tools.map((t) => t.function.name));

        for (let i = 0; i < MAX_ITERATIONS; i++) {
        console.log(`\n--- Iteration ${i + 1} ---`);

        const response = await openrouter.chat.send({
            chatGenerationParams: {
            model: MODEL,
            messages,
            tools: toolDefs,
            },
        });

        const message = response.choices[0]?.message;
        if (!message) throw new Error("No message in response");

        messages.push(message as Message);

        if (message.toolCalls && message.toolCalls.length > 0) {
            let submitted = false;

            for (const toolCall of message.toolCalls) {
                const { name, arguments: argsStr } = toolCall.function;
                console.log(`Tool call: ${name}(${argsStr})`);

                const hasTool = toolSet.has(name);
                if (!hasTool) throw new Error(`Unknown tool: ${name}`);

                const args = JSON.parse(argsStr);
                const result = await mcp.callTool({ name, arguments: args }) as CallToolResult;
                console.log(`Result:`, JSON.stringify(result));

                const textContent = result.content.filter(c => c.type === "text")
                    .map(c => "text" in c ? c.text : "")
                    .join("\n");

                messages.push({
                    role: "tool",
                    toolCallId: toolCall.id,
                    content: textContent,
                } as Message);

                if (name === "submitDeclaration" && textContent.includes("FLG:")) {
                    console.log("Declaration submitted successfully!");
                    submitted = true;
                }
            }

            if (submitted) break;
        } else {
            // Agent gave up without submitting — push it back into the loop
            console.log("Agent responded with text (no tool calls). Nudging to continue...");
            messages.push({
                role: "user",
                content: "You have not submitted the declaration yet. Keep using tools to diagnose the issue and fix it. Do not give up.",
            } as Message);
        }
    }

  await mcp.close();
}

main().catch(console.error);
