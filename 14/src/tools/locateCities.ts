import { z } from "zod";
import { data } from "../loadData.js";

const paramsSchema = z.array(z.string()).min(1);

export async function handleLocateCities(params: string): Promise<{ output: string }> {
  let parsed: z.infer<typeof paramsSchema>;

  try {
    const raw = JSON.parse(params) as unknown;
    const result = paramsSchema.safeParse(raw);
    if (!result.success) {
      return { output: "Invalid params: expected a non-empty JSON array of item codes" };
    }
    parsed = result.data;
  } catch {
    return { output: "Invalid params: expected a JSON array of item codes" };
  }

  const itemCodes = parsed;

  // Build array of city code sets for each item code
  const citySets: Set<string>[] = [];

  for (const itemCode of itemCodes) {
    const citySet = data.connections.get(itemCode);
    if (!citySet) {
      return { output: `No connections found for itemCode: ${itemCode}` };
    }
    citySets.push(citySet);
  }

  // Compute intersection starting from the first set
  let intersected = new Set<string>(citySets[0]);

  for (let i = 1; i < citySets.length; i++) {
    for (const code of intersected) {
      if (!citySets[i]!.has(code)) {
        intersected.delete(code);
      }
    }
  }

  // Map city codes to names
  const intersectedCityNames = Array.from(intersected).map(
    (code) => data.cities.get(code) ?? code
  );

  return { output: JSON.stringify(intersectedCityNames) };
}
