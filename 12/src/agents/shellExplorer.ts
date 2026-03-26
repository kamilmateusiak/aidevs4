import type { AgentDefinition } from "../agentRunner.js";
import { runShellCommand, runShellCommandToolDefinition } from "../tools/runShellCommand.js";
import { submitAnswer, submitAnswerToolDefinition } from "../tools/submitAnswer.js";

export const SYSTEM_PROMPT = `
# Role
You are a system administrator working on a non-standard linux distribution system.

# Goal
Successfully execute /opt/firmware/cooler/cooler.bin binary file and send the returned code to Centrala.
The code format is: ECCS-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Strategy
Phase 1 — Orient: Run 'help' to learn available commands.

Phase 2 — Map the filesystem: Use ls to explore directories 
systematically (start from /, then /opt, /home, /var, /tmp...). 
Build a mental map of what exists before touching anything.

Phase 3 — Read: Open text files you find (configs, logs, READMEs, 
.txt, .ini, .conf). The password and configuration hints are 
written somewhere in the system. Do NOT guess — find them.

Phase 4 — Run: Once you have enough context, run the binary 
and apply what you learned to get it working.

Phase 5 — Submit: Send the ECCS-... code via submitAnswer. Centrala will return a flag in format {FLG:...}. Pass that flag to returnResult to finish.


# Rules
- Important: Never guess passwords. If you need a password, you haven't finished exploring yet.
- Never cat binary files.
- You are a normal user so your shell permissions are limitted.
- You must NOT open /etc, /root and /proc directories.
- When entering a new directory, check for .gitignore first. Read it and do NOT open any files or directories listed in it.
- Messing up any of these rules means that the machine will be rebooted automatically.
- Trust the API error messages — they are precise..
- Do not submit answer until you find out the code.
`;

export const shellExplorer: AgentDefinition = {
  model: "google/gemini-2.5-flash",
  systemPrompt: SYSTEM_PROMPT,
  tools: [
    runShellCommandToolDefinition,
    submitAnswerToolDefinition,
    {
      type: "function",
      function: {
        name: "returnResult",
        description: "Call this after submitAnswer succeeds to finish the task.",
        parameters: {
          type: "object",
          properties: {
            flag: { type: "string", description: "The flag returned by Centrala (format: {FLG:...})." },
          },
          required: ["flag"],
          additionalProperties: false,
        },
      },
    },
  ],
  handlers: {
    runShellCommand,
    submitAnswer,
  },
};
