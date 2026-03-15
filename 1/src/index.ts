import "dotenv/config";
import { writeFileSync } from "fs";
import { fetchCsv, csvToObjects } from "./fetchCsv.js";
import { config } from "./config.js";
import { PersonSchema, type Person } from "./schema.js";
import { tagPersons } from "./tagger.js";

const CURRENT_YEAR = new Date().getFullYear();

function parseRows(rows: Record<string, string>[]): Person[] {
  return rows.map((row, i) => {
    const result = PersonSchema.safeParse(row);
    if (!result.success) throw new Error(`Row ${i} invalid: ${JSON.stringify(result.error.flatten().fieldErrors)}`);
    return result.data;
  });
}

function filterRecords(rows: Person[]) {
  return rows.filter((row) => {
    const age = CURRENT_YEAR - new Date(row.birthDate).getFullYear();
    return age >= 20 && age <= 40 && row.birthPlace === "Grudziądz" && row.gender === "M";
  });
}

async function main() {
  const url = `${config.AIDEVS_HUB_BASE_URL}/data/${config.AIDEVS_HUB_API_KEY}/people.csv`;
  const raw = await fetchCsv(url);
  const rows = parseRows(csvToObjects(raw));
  console.log(`Loaded ${rows.length} rows`);

  const filtered = filterRecords(rows);
  console.log(`Filtered: ${filtered.length} records`);

  const tagged = await tagPersons(filtered);
  const result = tagged.filter((p) => p.tags.includes("transport"));
  writeFileSync("./suspects.json", JSON.stringify(result, null, 2));
  console.log(`Saved ${result.length} suspects to suspects.json`);

  const response = await fetch(`${config.AIDEVS_HUB_BASE_URL}/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      apikey: config.AIDEVS_HUB_API_KEY,
      task: "people",
      answer: result,
    }),
  });

  const json = await response.json();
  console.log("Response:", json);
}

main().catch(console.error);
