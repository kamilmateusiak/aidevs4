import { runAgent } from "./agentRunner.js";
import { reactorNavigator } from "./agents/reactorNavigator.js";

console.log("=== Reactor task start ===");

const result = await runAgent(
  reactorNavigator,
  "Navigate the robot from column 1 to column 7 (goal G) without being crushed by reactor blocks. Start with the 'start' command."
) as { status: string };

console.log("\n=== Task Completed ===");
console.log("Status:", result.status);
