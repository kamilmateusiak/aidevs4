import type { ToolDefinitionJson } from "@openrouter/sdk/models";
import { readFile, writeFile } from "fs/promises";
import { callZmail, submitAnswer } from "./hubApi.js";

export type Memory = {
  found: {
    systemPassword: string | null;
    attackDate: string | null;
    securityConfirmationPassword: string | null;
  };
  triedQueries: string[];
  readEmails: string[];
  notes: string | null;
};

const DEFAULT_MEMORY: Memory = {
  found: { systemPassword: null, attackDate: null, securityConfirmationPassword: null },
  triedQueries: [],
  readEmails: [],
  notes: null,
};

let memoryPath: string;

export function initMemory(sessionId: string) {
  memoryPath = `memories/${sessionId}-memory.json`;
}

export async function readMemory(): Promise<Memory> {
  try {
    const raw = await readFile(memoryPath, "utf-8");
    return JSON.parse(raw) as Memory;
  } catch {
    return structuredClone(DEFAULT_MEMORY);
  }
}

export const tools: ToolDefinitionJson[] = [
  {
    type: "function",
    function: {
      name: "callZMail",
      description: "The main function that allows calling ZMail api. Use parameters returned by help API call.",
      parameters: {
        type: "object",
        additionalProperties: true,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "submitAnswer",
      description: "Use when you find all required information. Returns flag in the format: {FLG:...} when answer is correct.",
      parameters: {
        type: "object",
        properties: {
          systemPassword: { type: "string", description: "Password to employees system." },
          attackDate: { type: "string", description: "Planned attack date in format YYYY-MM-DD." },
          securityConfirmationPassword: { type: "string", description: "Confirmation code found in the ticket confirmation, sent by the security team" }
        },
        required: ["systemPassword", "attackDate", "securityConfirmationPassword"],
        additionalProperties: false
      }
    }
  },
  {
    type: "function",
    function: {
      name: "updateMemory",
      description: "Store last memory for later use. Only pass what changed. Tool can do partial updates.",
      parameters: {
        type: "object",
        properties: {
          found: {
            type: "object",
            description: "Your last findings about interesting us parameters.",
            properties: {
              systemPassword: { type: "string", description: "Password to employees system." },
              attackDate: { type: "string", description: "Planned attack date in format YYYY-MM-DD." },
              securityConfirmationPassword: { type: "string", description: "Confirmation code found in the ticket confirmation, sent by the security team" }
            }
          },
          triedQueries: { type: "array", items: { type: "string" }, description: "The queries you did after previous tool call. Tool will append the passed values." },
          readEmails: { type: "array", items: { type: "string" }, description: "Ids of the emails you read after previous tool call. Tool will append the passed values." },
          notes: { type: "string", description: "Your current summary of findings and open questions. Overwrite this each time with your latest understanding. Use it when you haven't found everything yet — it will be available in the next iteration." }
        },
        required: [],
        additionalProperties: false
      }
    }
  }
] as const;

async function updateMemory({ found, triedQueries, readEmails, notes }: {
  found?: { systemPassword?: string, attackDate?: string, securityConfirmationPassword?: string },
  triedQueries?: string[],
  readEmails?: string[],
  notes?: string
}): Promise<{ ok: boolean }> {
  const current = await readMemory();

  if (found) {
    if (found.systemPassword) current.found.systemPassword = found.systemPassword;
    if (found.attackDate) current.found.attackDate = found.attackDate;
    if (found.securityConfirmationPassword) current.found.securityConfirmationPassword = found.securityConfirmationPassword;
  }
  if (triedQueries) current.triedQueries.push(...triedQueries);
  if (readEmails) current.readEmails.push(...readEmails);
  if (notes !== undefined) current.notes = notes;

  await writeFile(memoryPath, JSON.stringify(current, null, 2), "utf-8");
  return { ok: true };
}

export const handlersByToolName: Record<string, Function> = {
  'callZMail': callZmail,
  'submitAnswer': submitAnswer,
  'updateMemory': updateMemory
}