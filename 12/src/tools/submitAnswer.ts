import { z } from "zod";
import { config } from "../config.js";

export async function submitAnswer(args: unknown): Promise<unknown> {
    const schema = z.object({
        code: z.string().min(1).startsWith("ECCS-"),
    })

    const parsedArgs = schema.safeParse(args);

    if (!parsedArgs.success) {
        return "[validation error] Code parameter was invalid.";
    }
    const res = await fetch(`${config.AIDEVS_HUB_BASE_URL}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apikey: config.AIDEVS_HUB_API_KEY, task: "firmware", answer: { confirmation: parsedArgs.data.code } }),
    });
    const data: unknown = await res.json();

    console.log("Centrala response:", JSON.stringify(data, null, 2));

    return data;
}

export const submitAnswerToolDefinition = {
    type: "function",
    function: {
        name: "submitAnswer",
        description: "Use when you send the code to Centrala. Returns flag in the format: {FLG:...} when code is correct.",
        parameters: {
            type: "object",
            properties: {
                code: {
                    type: "string",
                    description: "The code you obtained after successfully running /opt/firmware/cooler/cooler.bin binary file.",
                },
            },
            required: ["code"],
            additionalProperties: false,
        },
    },
} as const;
