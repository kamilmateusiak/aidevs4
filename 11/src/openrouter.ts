import { OpenRouter } from "@openrouter/sdk";
import { config } from "./config.js";

export const openrouter = new OpenRouter({
  apiKey: config.OPEN_ROUTER_KEY,
});
