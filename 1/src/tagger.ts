import { openrouter } from "./openrouter.js";
import { type Person, type TaggedPerson, TAG_VALUES } from "./schema.js";
import { z } from "zod";

const MODEL = "openai/gpt-4o-mini";

const TAG_DESCRIPTIONS: Record<typeof TAG_VALUES[number], string> = {
  "IT": "software development, programming, IT infrastructure, cybersecurity, data science, tech support",
  "transport": "logistics, shipping, delivery, supply chain, warehousing, freight",
  "edukacja": "teaching, lecturing, tutoring, training, academic research, school administration",
  "medycyna": "medicine, nursing, pharmacy, dentistry, veterinary, mental health, healthcare",
  "praca z ludźmi": "customer service, HR, sales, social work, counseling, public relations, management",
  "praca z pojazdami": "driving, truck driving, bus driving, vehicle maintenance, mechanics, fleet management",
  "praca fizyczna": "construction, manufacturing, farming, cleaning, manual labor, craftwork, warehouse work",
};

const TAG_LIST = TAG_VALUES.map((tag) => `- ${tag}: ${TAG_DESCRIPTIONS[tag]}`).join("\n");

const SYSTEM_PROMPT = `You are a job classifier. For each person provided, assign one or more tags based on their job description.

Available tags:
${TAG_LIST}

A person can have multiple tags if applicable. Only use tags from the list.`;

const TagResultSchema = z.object({
  results: z.array(z.object({
    index: z.number(),
    tags: z.array(z.enum(TAG_VALUES)),
  })),
});

export async function tagPersons(persons: Person[]): Promise<TaggedPerson[]> {
  const input = persons
    .map((p, i) => `${i}. ${p.name} ${p.surname}: ${p.job}`)
    .join("\n");

  const response = await openrouter.chat.send({
    chatGenerationParams: {
      model: MODEL,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `Tag these people:\n${input}` },
      ],
      responseFormat: {
        type: "json_schema",
        jsonSchema: {
          name: "tag_results",
          strict: true,
          schema: {
            type: "object",
            properties: {
              results: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    index: { type: "number" },
                    tags: {
                      type: "array",
                      items: { type: "string", enum: [...TAG_VALUES] },
                    },
                  },
                  required: ["index", "tags"],
                  additionalProperties: false,
                },
              },
            },
            required: ["results"],
            additionalProperties: false,
          },
        },
      },
    },
  });

  const content = response.choices[0]?.message?.content;
  if (!content || typeof content !== "string") throw new Error("Empty response from model");

  const { results } = TagResultSchema.parse(JSON.parse(content));

  return results.map(({ index, tags }) => {
    const p = persons[index]!;
    return {
      name: p.name,
      surname: p.surname,
      gender: p.gender,
      born: new Date(p.birthDate).getFullYear(),
      city: p.birthPlace,
      tags,
    };
  });
}
