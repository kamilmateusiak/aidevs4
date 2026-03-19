import { config } from "./config.js";

const HUB_BASE_URL = config.AIDEVS_HUB_BASE_URL;
const TASK = "categorize";

export type CsvItem = {
    id: string;
    description: string;
};

export async function downloadCsv(): Promise<CsvItem[]> {
    const url = `${HUB_BASE_URL}/data/${config.AIDEVS_HUB_API_KEY}/${TASK}.csv`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`CSV fetch failed: ${res.status}`);
    const text = await res.text();
    return text
        .trim()
        .split("\n")
        .slice(1) // skip header
        .map((line) => {
            const comma = line.indexOf(",");
            return { id: line.slice(0, comma), description: line.slice(comma + 1) };
        });
}

export async function testPrompt(prompt: string): Promise<unknown> {
    const res = await fetch(`${HUB_BASE_URL}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            apikey: config.AIDEVS_HUB_API_KEY,
            task: TASK,
            answer: { prompt },
        }),
    });
    return res.json();
}

export async function resetBudget(): Promise<unknown> {
    return testPrompt("reset");
}
