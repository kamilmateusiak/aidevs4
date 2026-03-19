import { openrouter } from "./openrouter.js";

const VISION_MODEL = "google/gemini-3-flash-preview";

export type Direction = "top" | "right" | "bottom" | "left";
export type BoardState = Record<string, Direction[]>;

const DIRECTIONS = ["top", "right", "bottom", "left"] as const;
const CELLS = ["1x1","1x2","1x3","2x1","2x2","2x3","3x1","3x2","3x3"] as const;

const BOARD_PROMPT = `You are analyzing a 3x3 electrical cable puzzle board.
Rows are numbered 1-3 top to bottom, columns 1-3 left to right.

Each cell contains a cable connector. Identify which edges the cable exits through.
Possible edges: top, right, bottom, left.

Fill in the board_state object with every cell's connections.`;

// Using structured output (json_schema) instead of parsing raw text —
// this guarantees the shape of the response and avoids regex hacks.
// Same pattern as lesson 6's responseFormat.
const responseFormat = {
  type: "json_schema" as const,
  jsonSchema: {
    name: "board_state",
    schema: {
      type: "object",
      properties: Object.fromEntries(
        CELLS.map((cell) => [
          cell,
          {
            type: "array",
            items: { type: "string", enum: DIRECTIONS },
          },
        ])
      ),
      required: [...CELLS],
      additionalProperties: false,
    },
    strict: true,
  },
};

export async function describeBoard(pngBuffer: Buffer): Promise<BoardState> {
  const base64 = pngBuffer.toString("base64");

  const response = await openrouter.chat.send({
    chatGenerationParams: {
      model: VISION_MODEL,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: BOARD_PROMPT },
            // Image passed as base64 data URL — standard for vision-capable models
            {
              type: "image_url",
              imageUrl: { url: `data:image/png;base64,${base64}` },
            },
          ],
        },
      ],
      responseFormat,
    },
  });

  const content = response.choices[0]?.message?.content ?? "";
  return JSON.parse(content) as BoardState;
}
