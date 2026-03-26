import { openrouter } from "./openrouter.js";

const SYSTEM_PROMPT = `You are analyzing power plant operator notes.
For each numbered note, determine if the operator is claiming something is wrong, broken, out of range, or abnormal.
Respond with ONLY a JSON array of the indices (numbers) of notes where the operator claims a problem exists.
If none, respond with an empty array [].
Do not explain. Do not include notes where the operator says everything is fine, even if cautionary words appear in a negative context (e.g. "no fault", "no warning signs").`;

const BATCH_SIZE = 100;

export async function evaluateNotes(notes: string[]): Promise<Set<string>> {
  const negativeNotes = new Set<string>();

  for (let i = 0; i < notes.length; i += BATCH_SIZE) {
    const batch = notes.slice(i, i + BATCH_SIZE);

    const numbered = batch.map((note, idx) => `${i + idx}: ${note}`).join("\n");

    const response = await openrouter.chat.send({
      chatGenerationParams: {
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: numbered },
        ],
        responseFormat: {
          type: "json_schema",
          jsonSchema: {
            name: "flagged_indices",
            strict: true,
            schema: {
              type: "object",
              properties: {
                indices: { type: "array", items: { type: "number" } },
              },
              required: ["indices"],
              additionalProperties: false,
            },
          },
        },
      },
    });

    const content = response.choices[0]?.message?.content ?? '{"indices":[]}';
    const { indices: flaggedIndices } = JSON.parse(content) as { indices: number[] };

    for (const idx of flaggedIndices) {
      negativeNotes.add(notes[idx]);
    }

    console.log(`  Batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(notes.length / BATCH_SIZE)}: ${flaggedIndices.length} flagged`);
  }

  return negativeNotes;
}
