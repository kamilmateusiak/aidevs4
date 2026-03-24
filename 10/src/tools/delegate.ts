// src/tools/delegate.ts
import z from "zod";
import { runAgent } from "../agentRunner.js";
import type { AgentDefinition } from "../agentRunner.js";
import { mapAnalystAgent } from "../agents/mapAnalyst.js";
import { docParserAgent } from "../agents/docParser.js";
import { executorAgent } from "../agents/executor.js";

const agentRegistry = {
  mapAnalyst: mapAnalystAgent,
  docParser: docParserAgent,
  executor: executorAgent,
} as const;

export async function delegate(args: unknown): Promise<unknown> {
    const schema = z.object({
        agentName: z.enum(["mapAnalyst", "docParser", "executor"]),
        task: z.string().min(1),
    });
    
    const parsedArgs = schema.safeParse(args);

    if (!parsedArgs.success) {
        console.error("Invalid arguments:");
        console.error(z.flattenError(parsedArgs.error).fieldErrors);
        
        return "Wrong arguments - either agentName or task are not following the schema";
    }

    const { agentName, task } = parsedArgs.data;

    const agent = agentRegistry[agentName];

    console.log(`Delegate -> ${agentName}, task: ${task}`)

    const result = await runAgent(agent, task);

    return result;
}

const agentsDescription = Object.keys(agentRegistry).reduce((acc, agentName) => {
    const currentAgentDescription = `${agentName}: ${agentRegistry[agentName as keyof typeof agentRegistry].specialization}\n`
    return acc + currentAgentDescription;
}, "");

export const delegateToolDefinition = {
  type: "function",
  function: {
    name: "delegate",
    description: "Use delegate tool to give a task to specialized agent when you don't have enought tools to resolve it yourself.",
    parameters: {
      type: "object",
      properties: {
        agentName: { type: "string", description: `The agent that should handle the task. Use one of the following agents:\n${agentsDescription}` },
        task: { type: "string", description: "The task you want to delegate for more specialized system actor. Use plain text with the detailed description of the problem to solve and expected return value format." },
      },
      required: ["agentName", "task"],
      additionalProperties: false,
    },
  },
};
