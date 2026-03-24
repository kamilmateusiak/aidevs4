import z from "zod";
import { openrouter } from "../openrouter.js";

const VISION_MODEL = "openai/gpt-5.4";

export async function callVisionModel(args: unknown): Promise<string> {
  const schema = z.object({
    imageUrl: z.string().min(1),
    prompt: z.string().min(1),
  });
  
  const parsedArgs = schema.safeParse(args);

  if (!parsedArgs.success) {
      console.error("Invalid arguments:");
      console.error(z.flattenError(parsedArgs.error).fieldErrors);
      
      return "Wrong arguments - either imageUrl or prompt not following the schema";
  }

  const { imageUrl, prompt } = parsedArgs.data;

  const response = await openrouter.chat.send({
    chatGenerationParams: {
      model: VISION_MODEL,
      messages: [
        {
          role: "user",
          content: [
            { type: "image_url", imageUrl: { url: imageUrl } },
            { type: "text", text: prompt },
          ] as never,
        },
      ],
    },
  });

  const answer = (response.choices[0]?.message?.content as string) ?? "";
  console.log("VisionModel answer: ", answer);

  return (response.choices[0]?.message?.content as string) ?? "";
}
