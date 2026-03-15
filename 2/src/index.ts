import "dotenv/config";
import { readFileSync } from "fs";
import { getPowerPlants } from "./powerPlants.js";
import * as handlers from "./tools.js";
import { openrouter } from "./openrouter.js";
import type { Message } from "@openrouter/sdk/models";

const plants = await getPowerPlants();

const suspects = JSON.parse(readFileSync("./suspects.json", "utf-8")) as {
  name: string;
  surname: string;
  born: number;
}[];

const tools = [
  {
    handler: (args: { name: string; surname: string }) =>
      handlers.getLocations(args.name, args.surname, plants),
    function: {
      name: "get_locations",
      description: "Get locations of a given person and the distance to the nearest power plant for each location.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "First name of the suspect." },
          surname: { type: "string", description: "Last name of the suspect." },
        },
        required: ["name", "surname"],
        additionalProperties: false,
      },
      strict: true,
    },
  },
  {
    handler: (args: { name: string; surname: string; birthYear: number }) =>
      handlers.getAccessLevel(args.name, args.surname, args.birthYear),
    function: {
      name: "get_access_level",
      description: "Get the access level of a suspect. Use only after identifying the suspect via get_locations.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "First name of the suspect." },
          surname: { type: "string", description: "Last name of the suspect." },
          birthYear: { type: "number", description: "Birth year of the suspect (integer)." },
        },
        required: ["name", "surname", "birthYear"],
        additionalProperties: false,
      },
      strict: true,
    },
  },
  {
    handler: (args: { name: string; surname: string; accessLevel: number; powerPlant: string }) =>
      handlers.submitAnswer(args.name, args.surname, args.accessLevel, args.powerPlant),
    function: {
      name: "submit_suspect",
      description: "Submit the identified suspect with their access level and nearest power plant code.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "First name of the suspect." },
          surname: { type: "string", description: "Last name of the suspect." },
          accessLevel: { type: "number", description: "Access level retrieved from get_access_level." },
          powerPlant: { type: "string", description: "Power plant code, e.g. PWR1234PL." },
        },
        required: ["name", "surname", "accessLevel", "powerPlant"],
        additionalProperties: false,
      },
      strict: true,
    },
  },
];

const suspectList = suspects
  .map((s) => `- ${s.name} ${s.surname}, born ${s.born}`)
  .join("\n");

const SYSTEM_PROMPT = `You are an investigative agent. Your task is to identify which suspect was seen near a nuclear power plant and has a high access level. All power plants in the database are nuclear.

Suspects (name, surname, birthYear):
${suspectList}

Steps:
1. Call get_locations for ALL suspects.
2. Call get_access_level for ALL suspects.
3. Among the suspects with the highest access level, pick the one whose closest sighting to any power plant has the smallest distance.
4. Call submit_suspect with that person's name, surname, accessLevel and the power plant code they were closest to.`;

const MAX_ITERATIONS = 15;
const MODEL = "openai/gpt-5-mini";

const messages: Message[] = [
  { role: "system", content: SYSTEM_PROMPT },
  { role: "user", content: "Find the suspect who was near a nuclear power plant and submit the answer." },
];

const toolDefs = tools.map((t) => ({ type: "function" as const, function: t.function }));
const toolMap = new Map(tools.map((t) => [t.function.name, t.handler]));

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
    for (const toolCall of message.toolCalls) {
      const { name, arguments: argsStr } = toolCall.function;
      console.log(`Tool call: ${name}(${argsStr})`);

      const handler = toolMap.get(name);
      if (!handler) throw new Error(`Unknown tool: ${name}`);

      const args = JSON.parse(argsStr);
      const result = await handler(args);
      console.log(`Result:`, JSON.stringify(result));

      messages.push({
        role: "tool",
        toolCallId: toolCall.id,
        content: JSON.stringify(result),
      } as Message);
    }
  } else {
    console.log("Agent final response:", message.content);
    break;
  }
}
