import { existsSync, mkdirSync } from "node:fs";
import { readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import AdmZip from "adm-zip";
import { config } from "./config.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, "../data");
const FILES_DIR = path.join(DATA_DIR, "files");
const ZIP_PATH = path.join(DATA_DIR, "sensors.zip");

const SENSORS_URL = `${config.AIDEVS_HUB_BASE_URL}/dane/sensors.zip`;

async function downloadAndExtract(): Promise<void> {
  if (existsSync(FILES_DIR)) {
    const files = await readdir(FILES_DIR);
    if (files.length > 0) {
      console.log(`Data already present (${files.length} files). Skipping download.`);
      return;
    }
  }

  mkdirSync(DATA_DIR, { recursive: true });
  mkdirSync(FILES_DIR, { recursive: true });

  console.log("Downloading sensors.zip...");
  const response = await fetch(SENSORS_URL);
  if (!response.ok) throw new Error(`Download failed: ${response.status} ${response.statusText}`);

  const buffer = Buffer.from(await response.arrayBuffer());
  await writeFile(ZIP_PATH, buffer);
  console.log(`Downloaded ${(buffer.length / 1024 / 1024).toFixed(1)} MB`);

  console.log("Extracting...");
  const zip = new AdmZip(ZIP_PATH);
  zip.extractAllTo(FILES_DIR, true);

  const extracted = await readdir(FILES_DIR);
  console.log(`Extracted ${extracted.length} files to ${FILES_DIR}`);
}

await downloadAndExtract();

import { validateSensorDataFiles } from "./validateSensorData.js";
import { evaluateNotes } from "./evaluateNotes.js";

const results = await validateSensorDataFiles(FILES_DIR);

const flagged = results.filter(r => r.error !== null);
console.log(`\nTotal: ${results.length}, programmatically flagged: ${flagged.length}`);
for (const r of flagged.slice(0, 10)) {
  console.log(`  ${r.filename}: ${r.error}`);
}
if (flagged.length > 10) console.log(`  ... and ${flagged.length - 10} more`);

// Send all unique notes from clean files to LLM
const flaggedFilenames = new Set(flagged.map(r => r.filename));
const cleanResults = results.filter(r => !flaggedFilenames.has(r.filename));
const uniqueCleanNotes = [...new Set(cleanResults.map(r => r.record.operator_notes))];

console.log(`\nClean files: ${cleanResults.length} (${uniqueCleanNotes.length} unique notes)`);
console.log(`Sending to LLM...`);
const confirmedNegativeNotes = await evaluateNotes(uniqueCleanNotes);
console.log(`LLM flagged ${confirmedNegativeNotes.size} notes across ${cleanResults.filter(r => confirmedNegativeNotes.has(r.record.operator_notes)).length} files`);

const llmFlagged = cleanResults.filter(r => confirmedNegativeNotes.has(r.record.operator_notes));

// Final answer
const allAnomalous = new Set([
  ...flagged.map(r => r.filename),
  ...llmFlagged.map(r => r.filename),
]);
const ids = [...allAnomalous].map(f => f.replace(".json", "")).sort();
console.log(`\nTotal anomalies: ${ids.length}`);

const res = await fetch(`${config.AIDEVS_HUB_BASE_URL}/verify`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ apikey: config.AIDEVS_HUB_API_KEY, task: "evaluation", answer: { recheck: ids } }),
});
const data = await res.json();
console.log("\nSubmission response:", JSON.stringify(data, null, 2));
