import { config } from "./config.js";
import { haversineDistance } from "./haversine.js";
import type { PowerPlant } from "./powerPlants.js";

export type LocationResult = {
  lat: number;
  lng: number;
  nearestPlant: {
    city: string;
    code: string;
    distance_km: number;
  };
};

export type AccessLevelResult = {
  accessLevel: number;
};

export async function getLocations(
  name: string,
  surname: string,
  plants: PowerPlant[]
): Promise<LocationResult[]> {
  const res = await fetch(`${config.AIDEVS_HUB_BASE_URL}/api/location`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ apikey: config.AIDEVS_HUB_API_KEY, name, surname }),
  });
  const data = await res.json() as { latitude: number; longitude: number }[];
console.log('lll', plants.length)
  return data.map((loc) => {
    const nearest = plants
      .map((p) => ({ ...p, distance_km: haversineDistance(loc.latitude, loc.longitude, p.lat, p.lng) }))
      .sort((a, b) => a.distance_km - b.distance_km)[0]!;

      
    return {
      lat: loc.latitude,
      lng: loc.longitude,
      nearestPlant: { city: nearest.city, code: nearest.code, distance_km: nearest.distance_km },
    };
  });
}

export async function getAccessLevel(
  name: string,
  surname: string,
  birthYear: number
): Promise<AccessLevelResult> {
  const res = await fetch(`${config.AIDEVS_HUB_BASE_URL}/api/accesslevel`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ apikey: config.AIDEVS_HUB_API_KEY, name, surname, birthYear }),
  });
  const data = await res.json() as { accessLevel: number };
  console.log('aaa', data);

  return { accessLevel: data.accessLevel };
}

export async function submitAnswer(
  name: string,
  surname: string,
  accessLevel: number,
  powerPlant: string
): Promise<{ message: string }> {
  const res = await fetch(`${config.AIDEVS_HUB_BASE_URL}/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      apikey: config.AIDEVS_HUB_API_KEY,
      task: "findhim",
      answer: { name, surname, accessLevel, powerPlant },
    }),
  });
  const data = await res.json() as { message: string };
  return data;
}
