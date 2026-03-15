import "dotenv/config";
import express from "express";
import ngrok from "@ngrok/ngrok";
import { config } from "./config.js";
import { runAgent } from "./agent.js";

const app = express();
app.use(express.json());

app.post("/", async (req, res) => {
  const { sessionID, msg } = req.body as { sessionID?: string; msg?: string };

  if (!sessionID || !msg) {
    res.status(400).json({ error: "sessionID and msg are required" });
    return;
  }

  console.log(`[${sessionID}] ← ${msg}`);

  try {
    const reply = await runAgent(sessionID, msg);
    console.log(`[${sessionID}] → ${reply}`);
    res.json({ msg: reply });
  } catch (err) {
    console.error(`[${sessionID}] Error:`, err);
    res.status(500).json({ error: "Internal server error" });
  }
});

await new Promise<void>((resolve) => app.listen(config.PORT, resolve));
console.log(`Server listening on port ${config.PORT}`);

// Top-level reference keeps the tunnel alive for the lifetime of the process
const listener = await ngrok.connect({
  addr: config.PORT,
  authtoken: config.NGROK_AUTHTOKEN,
});
const publicUrl = listener.url();
console.log(`ngrok tunnel: ${publicUrl}`);

const sessionID = `${config.SUBMIT_SESSION_ID}`;

const submitBody = {
  apikey: config.AIDEVS_HUB_API_KEY,
  task: "proxy",
  answer: {
    url: `${publicUrl}/`,
    sessionID,
  },
};

console.log("Submitting to hub...", JSON.stringify(submitBody, null, 2));

const submitRes = await fetch(`${config.AIDEVS_HUB_BASE_URL}/verify`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(submitBody),
});

const submitJson = await submitRes.json();
console.log("Hub response:", JSON.stringify(submitJson, null, 2));
console.log("Waiting for incoming connections...");
process.stdin.resume(); // keep process alive until Ctrl+C
