import fetch from "node-fetch";
import { parse } from "csv-parse/sync";

export async function fetchCsv(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch CSV: HTTP ${res.status}`);
  return res.text();
}

export function csvToObjects(raw: string): Record<string, string>[] {
  return parse(raw, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });
}
