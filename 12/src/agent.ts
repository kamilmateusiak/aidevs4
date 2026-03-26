import { runAgent } from "./agentRunner.js";
import { shellExplorer } from "./agents/shellExplorer.js";

console.log("=== Firmware task start ===");

const result = await runAgent(
  shellExplorer,
  "Run /opt/firmware/cooler/cooler.bin binary file and find out secret code returned by the program."
) as { flag: string };

console.log("\n=== Task Completed ===");
console.log("Flag:", result.flag);
