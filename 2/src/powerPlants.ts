import { existsSync, readFileSync, writeFileSync } from "fs";
import { openrouter } from "./openrouter.js";
import { config } from "./config.js";

const CACHE_FILE = "./power_plants_with_coords.json";
const MODEL = "openai/gpt-4o-mini";

export type PowerPlant = {
  city: string;
  code: string;
  lat: number;
  lng: number;
};

async function fetchPowerPlants(): Promise<Record<string, { code: string }>> {
  const res = await fetch(`${config.AIDEVS_HUB_BASE_URL}/data/${config.AIDEVS_HUB_API_KEY}/findhim_locations.json`);
  const data = await res.json() as { power_plants: Record<string, { code: string }> };
  return data.power_plants;
}

type CityCoord = { cityName: string; lat: number; lng: number };

async function resolveCoordinates(cities: string[]): Promise<CityCoord[]> {
  const response = await openrouter.chat.send({
    chatGenerationParams: {
      model: MODEL,
      messages: [
        {
          role: "user",
          content: `Return the geographic coordinates (lat, lng) for these Polish cities. Cities: ${cities.join(", ")}`,
        },
      ],
      responseFormat: {
        type: "json_schema",
        jsonSchema: {
          name: "city_results",
          strict: true,
          schema: {
            type: "object",
            properties: {
              results: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    cityName: { type: "string" },
                    lat: { type: "number" },
                    lng: { type: "number" },
                  },
                  required: ["cityName", "lat", "lng"],
                  additionalProperties: false,
                },
              },
            },
            required: ["results"],
            additionalProperties: false,
          },
        },
      },
    },
  });

  const content = response.choices[0]?.message?.content;
  if (!content || typeof content !== "string") throw new Error("Empty response from model");

  const { results } = JSON.parse(content) as { results: CityCoord[] };
  return results;
}

export async function getPowerPlants(): Promise<PowerPlant[]> {
  if (existsSync(CACHE_FILE)) {
    console.log("Loading power plants from cache...");
    return JSON.parse(readFileSync(CACHE_FILE, "utf-8"));
  }

  console.log("Fetching power plants and resolving coordinates...");
  const plants = await fetchPowerPlants();
  const cities = Object.keys(plants);
  const coords = await resolveCoordinates(cities);

  const result: PowerPlant[] = cities.map((city) => {
    const coord = coords.find((c) => c.cityName === city);
    if (!coord) throw new Error(`No coordinates found for ${city}`);
    return { city, code: plants[city]!.code, lat: coord.lat, lng: coord.lng };
  });

  writeFileSync(CACHE_FILE, JSON.stringify(result, null, 2));
  console.log(`Saved ${result.length} power plants to cache.`);
  return result;
}
