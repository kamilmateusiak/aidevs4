import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { join, dirname } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = join(__dirname, "../data");

function loadCsv(filePath: string): string[][] {
  const content = readFileSync(filePath, "utf-8");
  const lines = content.split("\n").filter((line) => line.trim().length > 0);
  // Skip header row
  return lines.slice(1).map((line) => line.split(","));
}

// items: Map<code, name>
const items = new Map<string, string>();
// itemsList: Array<{code, name}> for searching
const itemsList: Array<{ code: string; name: string }> = [];

for (const parts of loadCsv(join(dataDir, "items.csv"))) {
  const name = parts[0];
  const code = parts[parts.length - 1];
  if (code && name) {
    items.set(code.trim(), name.trim());
    itemsList.push({ code: code.trim(), name: name.trim() });
  }
}

// cities: Map<code, name>
const cities = new Map<string, string>();

for (const parts of loadCsv(join(dataDir, "cities.csv"))) {
  const name = parts[0];
  const code = parts[parts.length - 1];
  if (code && name) {
    cities.set(code.trim(), name.trim());
  }
}

// connections: Map<itemCode, Set<cityCode>>
const connections = new Map<string, Set<string>>();

for (const parts of loadCsv(join(dataDir, "connections.csv"))) {
  const itemCode = parts[0]?.trim();
  const cityCode = parts[parts.length - 1]?.trim();
  if (itemCode && cityCode) {
    if (!connections.has(itemCode)) {
      connections.set(itemCode, new Set());
    }
    connections.get(itemCode)!.add(cityCode);
  }
}

export const data = {
  items,
  itemsList,
  cities,
  connections,
};
