import { config } from "../config.js";
import { withRetry } from "../utils/retry.js";

const SHELL_URL = `${config.AIDEVS_HUB_BASE_URL}/api/shell`;

const MAX_OUTPUT = 5000;

function responseLimiter(output: string): string {
    if (output.length <= MAX_OUTPUT) return output;
    return output.slice(0, MAX_OUTPUT) + `\n[output trimmed — ${output.length - MAX_OUTPUT} chars omitted. Do not cat binary files.]`;
}

export async function runShellCommand(args: unknown): Promise<string> {
    const { cmd } = args as { cmd: string };

    console.log(`  [shell] $ ${cmd}`);

    let res: Response;
    try {
        res = await withRetry(
            () =>fetch(SHELL_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ apikey: config.AIDEVS_HUB_API_KEY, cmd }),
            })
        );
    } catch (err) {
        return `[network error] ${String(err)}`;
    }

    if (res.status === 429) {
        return "[rate limited] Too many requests. Wait a moment before retrying.";
    }

    if (res.status === 503) {
        return "[service unavailable] Shell API is temporarily unavailable. Try again shortly.";
    }

    if (!res.ok) {
        const body = await res.text().catch(() => "");
        const banMatch = body.match(/ban[^\d]*(\d+)/i);
        if (banMatch) {
            return `[banned] Access blocked for ${banMatch[1]} seconds due to a security violation. Wait before retrying, or call shell({ cmd: "reboot" }) if the system state is unrecoverable.`;
        }
        console.log(`  [shell error ${res.status}] ${body.slice(0, 300)}`);
        return `[http error ${res.status}] ${body}`;
    }

    const data = await res.json() as unknown;

    // API returns { code, message, data } — prefer data (actual content) over message (description)
    if (typeof data === "string") return responseLimiter(data);
    if (data && typeof data === "object") {
        const d = data as Record<string, unknown>;
        const content = d["data"] ?? d["output"] ?? d["result"] ?? d["stdout"] ?? d["message"];
        const output = Array.isArray(content) ? content.join("\n") : String(content ?? JSON.stringify(d));

        console.log(`  [shell output] ${output.slice(0, 300)}`);

        return responseLimiter(output);
    }

    return responseLimiter(String(data));
}

export const runShellCommandToolDefinition = {
    type: "function",
    function: {
        name: "runShellCommand",
        description: "Execute a shell command on the remote virtual machine. Returns the command output or an error message. Use 'help' first to see available commands — this is a non-standard Linux shell.",
        parameters: {
            type: "object",
            properties: {
                cmd: {
                    type: "string",
                    description: "The shell command to run, e.g. 'ls /opt/firmware' or 'help'",
                },
            },
            required: ["cmd"],
            additionalProperties: false,
        },
    },
} as const;
