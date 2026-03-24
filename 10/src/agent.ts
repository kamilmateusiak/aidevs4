import { runAgent } from "./agentRunner.js";
import { orchestratorAgent } from "./agents/orchestrator.js";

console.log("=== Drone Mission Start ===");

const result = await runAgent(
  orchestratorAgent,
  "Execute the drone mission. Follow your strategy step by step."
) as { flag: string };

console.log("\n=== Mission Complete ===");
console.log("Flag:", result.flag);
