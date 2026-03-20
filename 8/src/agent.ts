import "dotenv/config";
import { z } from "zod";
import type { Message, ToolDefinitionJson } from "@openrouter/sdk/models";
import { openrouter } from "./openrouter.js";
import { downloadLogs } from "./hubApi.js";
import { searchLogs, countTokens, sendLogs, accumulateLogs, resetAccumulator } from "./tools.js";

const SearchLogsArgs = z.object({
  query: z.string().optional(),
  level: z.enum(["CRIT", "ERRO", "WARN", "INFO"]).optional(),
  limit: z.number().optional(),
});
const CountTokensArgs = z.object({ logs: z.string() });
const SendLogsArgs = z.object({ logs: z.string() });
const AccumulateLogsArgs = z.object({ newEntries: z.string() });

const AgentDecision = z.object({
  done: z.boolean(),
  reasoning: z.string(),
});

const AGENT_MODEL = "openai/gpt-4o-mini";
const MAX_ITERATIONS = 10;

const SYSTEM_PROMPT = `You are a log analysis assistant. Your job is to find and condense the most relevant log entries from a power plant failure log file, then iteratively improve them based on feedback.

## Workflow
1. Run searchLogs with level "CRIT" and limit 1 — get the single most important CRIT entry.
2. Call accumulateLogs with that entry — it returns { logs, tokens }.
3. Call sendLogs with the logs string from accumulateLogs.
4. Read the feedback — it tells you exactly which component is missing.
5. Search for that component (CRIT preferred, then ERRO, limit 1-3).
6. Call accumulateLogs with the new entries — it appends and deduplicates automatically.
7. Call sendLogs with the updated logs string.
8. Repeat steps 4-7 until you receive a flag.

## Required log line format
Each line must contain:
- Timestamp: YYYY-MM-DD HH:MM:SS
- Severity level: [INFO], [WARN], [ERRO], or [CRIT]
- Component ID (e.g. PWR01, WTANK07)
- Short description (you may paraphrase to save tokens)

Example: [2026-02-26 06:04] [CRIT] ECCS8 runaway outlet temp. Reactor trip initiated.

## Rules
- One event per line, separated by \\n
- ALWAYS call countTokens before sendLogs — never send if token count >= 1500
- Add entries in priority order: CRIT first, then ERRO, then WARN — never mix priorities in the first submission
- If over 1500 tokens: drop WARN first, then drop ERRO with low relevance, never drop CRIT
- Drop INFO entries entirely unless they mark a critical state change
- You may shorten descriptions, but keep timestamp, severity, and component ID intact
- If the logs are too short append more logs.
- NEVER ask the user for confirmation or input — make all decisions autonomously and keep calling tools`;

const tools: ToolDefinitionJson[] = [
  {
    type: "function",
    function: {
      name: "searchLogs",
      description: "Search the local log file for lines matching a query string. Optionally filter by severity level and limit the number of results.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Keyword or phrase to search for, e.g. 'coolant', 'FIRMWARE', 'PWR01'" },
          level: { type: "string", enum: ["CRIT", "ERRO", "WARN", "INFO"], description: "Filter by severity level." },
          limit: { type: "number", description: "Max number of lines to return. Use 1 for the first submission." },
        },
        required: ["query"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "countTokens",
      description: "Estimate the token count of the given log string. Always call this before sendLogs.",
      parameters: {
        type: "object",
        properties: {
          logs: { type: "string", description: "The condensed log string to count tokens for." },
        },
        required: ["logs"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "accumulateLogs",
      description: "Append new log entries to the accumulated log state. Deduplicates and sorts by timestamp. Returns the full accumulated log and current token count. Always use this instead of managing the log string manually.",
      parameters: {
        type: "object",
        properties: {
          newEntries: { type: "string", description: "New log lines to append, one per line." },
        },
        required: ["newEntries"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "sendLogs",
      description: "Send the accumulated logs to Centrala. Always call accumulateLogs first to get the current log string.",
      parameters: {
        type: "object",
        properties: {
          logs: { type: "string", description: "The full accumulated log string returned by accumulateLogs." },
        },
        required: ["logs"],
        additionalProperties: false,
      },
    },
  },
];

async function callTool(name: string, args: unknown): Promise<string> {
  if (name === "searchLogs") {
    const { query, level, limit } = SearchLogsArgs.parse(args);
    return searchLogs(query, level, limit);
  }
  if (name === "countTokens") {
    const { logs } = CountTokensArgs.parse(args);
    return String(countTokens(logs));
  }
  if (name === "accumulateLogs") {
    const { newEntries } = AccumulateLogsArgs.parse(args);
    return JSON.stringify(accumulateLogs(newEntries));
  }
  if (name === "sendLogs") {
    const { logs } = SendLogsArgs.parse(args);
    const result = await sendLogs(logs);
    return JSON.stringify(result);
  }
  throw new Error(`Unknown tool: ${name}`);
}

const MAX_TOOL_CALLS = 30;

async function runAgentIteration(messages: Message[]): Promise<{ flag?: string }> {
  let toolCallCount = 0;
  while (toolCallCount < MAX_TOOL_CALLS) {
    const response = await openrouter.chat.send({
      chatGenerationParams: {
        model: AGENT_MODEL,
        messages,
        tools,
        responseFormat: {
          type: "json_schema",
          jsonSchema: {
            name: "agent_decision",
            schema: {
              type: "object",
              properties: {
                done: { type: "boolean" },
                reasoning: { type: "string" },
              },
              required: ["done", "reasoning"],
              additionalProperties: false,
            },
            strict: true,
          },
        },
      },
    });

    const message = response.choices[0]?.message;
    if (!message) throw new Error("No message in response");

    messages.push(message as Message);

    if (message.toolCalls && message.toolCalls.length > 0) {
      for (const toolCall of message.toolCalls) {
        if (toolCallCount++ >= MAX_TOOL_CALLS) {
          console.log("Max tool calls reached.");
          return {};
        }
        const args: unknown = JSON.parse(toolCall.function.arguments);
        console.log(`  [${toolCallCount}/${MAX_TOOL_CALLS}] → ${toolCall.function.name}(${JSON.stringify(args)})`);

        const result = await callTool(toolCall.function.name, args);
        console.log(`    result: ${result.slice(0, 200)}`);

        if (toolCall.function.name === "sendLogs") {
          const parsed = JSON.parse(result) as { flag?: string; feedback?: string };
          if (parsed.flag) {
            console.log(`\n✓ Flag found: ${parsed.flag}`);
            return { flag: parsed.flag };
          }
        }

        messages.push({
          role: "tool",
          toolCallId: toolCall.id,
          content: result,
        } as Message);
      }
    } else {
      const decision = AgentDecision.parse(JSON.parse(message.content ?? "{}"));
      console.log("Agent decision:", decision.reasoning);
      if (decision.done) break;
      messages.push({
        role: "user",
        content: "Keep going. Call tools to complete the task.",
      } as Message);
    }
  }

  return {};
}

// ── Main ──────────────────────────────────────────────────────────────────────

console.log("Downloading logs...");
await downloadLogs();
resetAccumulator();

const messages: Message[] = [
  { role: "system", content: SYSTEM_PROMPT },
  { role: "user", content: "Analyse the failure log and send a condensed version to Centrala. Start by searching for critical and error events." },
];

for (let i = 0; i < MAX_ITERATIONS; i++) {
  console.log(`\n=== Iteration ${i + 1} / ${MAX_ITERATIONS} ===`);
  const { flag } = await runAgentIteration(messages);
  if (flag) process.exit(0);
}

console.log("Max iterations reached without finding flag.");
