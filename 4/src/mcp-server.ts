import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { config } from "./config.js";
import { OpenRouter } from "@openrouter/sdk";

const VISION_MODEL = "google/gemini-2.0-flash-001";

const openrouter = new OpenRouter({ apiKey: config.OPEN_ROUTER_KEY });

export const createMcpServer = () => {
  const server = new McpServer(
    { name: "aidev-s01e04-server", version: "1.0.0" },
    { capabilities: { tools: {} } }
  );

  server.registerTool(
    "fetch_docs",
    {
      description: "Fetches a remote document and returns its text content. Use for text-based files (.md, .txt, .html, .json). Do NOT use for image files — use analyze_image instead.",
      inputSchema: { url: z.string().describe("Full URL of the document to fetch") }
    },
    async ({ url }) => {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`);
      const text = await res.text();
      return { content: [{ type: "text", text }] };
    }
  );

  server.registerTool(
    "analyze_image",
    {
      description: "Sends an image to a vision model and returns the answer to a specific question about its content. Use for image files (.png, .jpg, .jpeg, .webp) when you need to extract data, read tables, or understand visual content. Do not use for text content like md files.",
      inputSchema: {
        url: z.string().describe("Full URL of the image to analyze"),
        question: z.string().describe("Specific question about what to extract or find in the image")
      }
    },
    async ({ url, question }) => {
      const response = await openrouter.chat.send({
        chatGenerationParams: {
          model: VISION_MODEL,
          messages: [
            {
              role: "user",
              content: [
                { type: "image_url", imageUrl: { url } },
                { type: "text", text: question },
              ],
            },
          ],
        },
      });
      const text = response.choices[0]?.message?.content ?? "No response";
      return { content: [{ type: "text", text: String(text) }] };
    }
  );

  server.registerTool(
    "submitDeclaration",
    {
      description: "Submits the completed transport declaration to the verification endpoint. Call this only when the declaration is fully filled out and ready.",
      inputSchema: {
        declaration: z.string().describe("The full declaration text, formatted exactly as the template requires")
      }
    },
    async ({ declaration }) => {
      const res = await fetch(`${config.AIDEVS_HUB_BASE_URL}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apikey: config.AIDEVS_HUB_API_KEY,
          task: "sendit",
          answer: { declaration },
        }),
      });
      const body = await res.text();
      return { content: [{ type: "text", text: body }] };
    }
  );

  return server;
};

const server = createMcpServer();
const transport = new StdioServerTransport();
await server.connect(transport);
