import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  AIDEVS_HUB_API_KEY: z.string().min(1),
  AIDEVS_HUB_BASE_URL: z.string().check(z.url()),
  OPEN_ROUTER_KEY: z.string().min(1),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment variables:");
  console.error(z.flattenError(parsed.error).fieldErrors);
  process.exit(1);
}

export const config = parsed.data;
