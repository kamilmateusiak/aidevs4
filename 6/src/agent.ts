import "dotenv/config";
import { openrouter } from "./openrouter.js";
import { CLASSIFICATION_PROMPT, AGENT_SYSTEM_PROMPT } from "./prompt.js";
import { downloadCsv, testPrompt, resetBudget, type CsvItem } from "./hubApi.js";

const MAX_ITERATIONS = 10;
const MODEL = "openai/gpt-4o-mini";

let currentPrompt = CLASSIFICATION_PROMPT;
const pastFailures: { description: string; classifiedAs: string; shouldBe: string }[] = [];

await resetBudget();
const items = await downloadCsv();
console.log(`Fetched ${items.length} items: `, items);

for (let i = 0; i < MAX_ITERATIONS; i++) {
    console.log(`\n--- Round ${i + 1} ---`);

    const results: { item: CsvItem; response: unknown }[] = [];

    for (const item of items) {
        const filled = currentPrompt.replace("{ description }", item.description).replace("{ id }", item.id);
        const response = await testPrompt(filled);
        console.log(`Item ${item.id}:`, JSON.stringify(response));
        results.push({ item, response });

        if (JSON.stringify(response).includes("{FLG:")) {
            console.log("Flag found! Task complete.");
            process.exit(0);
        }
    }

    type HubResponse = { code: number; message: string; debug?: { output?: string } };

    const classifiedResults = results
        .filter((r) => {
            const s = JSON.stringify(r.response);
            return s.includes("wrong classification") || (r.response as HubResponse).code === 0;
        })
        .map((r) => {
            const output = (r.response as HubResponse).debug?.output;
            const wrong = JSON.stringify(r.response).includes("wrong classification");
            return {
                description: r.item.description,
                classifiedAs: output,
                correct: !wrong,
                ...(wrong ? { shouldBe: output === "DNG" ? "NEU" : "DNG" } : {}),
            };
        });

    const firstWrong = results.find((r) => JSON.stringify(r.response).includes("wrong classification"));
    const wrongOutput = firstWrong ? (firstWrong.response as HubResponse).debug?.output : null;
    if (firstWrong && wrongOutput) {
        pastFailures.push({
            description: firstWrong.item.description,
            classifiedAs: wrongOutput,
            shouldBe: wrongOutput === "DNG" ? "NEU" : "DNG",
        });
    }

    console.log("\nAsking prompt engineer to improve the prompt...");

    const engineerResponse = await openrouter.chat.send({
        chatGenerationParams: {
            model: MODEL,
            messages: [
                { role: "system", content: AGENT_SYSTEM_PROMPT },
                {
                    role: "user",
                    content: `Current prompt:\n${currentPrompt}\n\nAll items this round:\n${items.map(i => i.description).join("\n")}\n\nThis round results:\n${JSON.stringify(classifiedResults, null, 2)}\n\nAll failures across rounds:\n${JSON.stringify(pastFailures, null, 2)}`,
                },
            ],
            responseFormat: {
                type: "json_schema",
                jsonSchema: {
                    name: "improved_prompt",
                    schema: {
                        type: "object",
                        properties: {
                            prompt: { type: "string" },
                        },
                        required: ["prompt"],
                        additionalProperties: false,
                    },
                    strict: true,
                },
            },
        },
    });

    const content = engineerResponse.choices[0]?.message?.content;
    if (!content) throw new Error("No response from prompt engineer");

    const parsed = JSON.parse(content) as { prompt: string };
    currentPrompt = parsed.prompt;
    console.log("New prompt:", currentPrompt);

    await resetBudget();
    console.log("Budget reset, fetching fresh CSV...");
    items.splice(0, items.length, ...(await downloadCsv()));
}

console.log("Max iterations reached without finding flag.");
