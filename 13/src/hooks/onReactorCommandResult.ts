import { z } from "zod";

const resultSchema = z.object({
    "message": z.string(),
    "board": z.array(
        z.array(
            z.enum([".", "B", "P", "G"])
        ).length(7)
    ).length(5),
    "player": z.object({
        "col": z.int(),
        "row": z.int()
    }),
    "goal": z.object({
        "col": z.int(),
        "row": z.int(),
    }),
    "blocks": z.array(z.object({
        "col": z.int(),
        "top_row": z.int(),
        "bottom_row": z.int(),
        "direction": z.enum(["up", "down"]),
    })),
    "reached_goal": z.boolean(),
})

export const onReactorCommandResult = (toolName: string, args: unknown, result: unknown): Promise<string | null> => {
    if (toolName !== "reactorCommand") return Promise.resolve(null);

    const parsed = resultSchema.safeParse(result);
    if (!parsed.success) {
        console.log("Unsupported result format", result);
        return Promise.resolve(null);
    }

    const { player, blocks, goal, reached_goal } = parsed.data;

    if (reached_goal) return Promise.resolve("Goal reached! Call returnResult now.");

    const lines: string[] = [];
    lines.push(`Robot is at column ${player.col}. Goal is at column ${goal.col}`);

    const interestingBlocks = blocks.filter(block => block.col >= player.col);

    if (interestingBlocks.length > 0) { 
        lines.push(`Blocks: ${interestingBlocks.map(block => `col ${block.col} (rows ${block.top_row}-${block.bottom_row}, moving ${block.direction})`).join(', ')}`)
    }

    return Promise.resolve(lines.join("\n"));
}
