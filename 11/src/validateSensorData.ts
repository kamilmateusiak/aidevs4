import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

export type SensorRecord = {
  sensor_type: string;
  timestamp: number;
  temperature_K: number;
  pressure_bar: number;
  water_level_meters: number;
  voltage_supply_v: number;
  humidity_percent: number;
  operator_notes: string;
};

export type ValidationResult = {
  filename: string;
  record: SensorRecord;
  error: string | null;
};

const SENSOR_FIELDS = {
  temperature: { field: "temperature_K",     min: 553, max: 873  },
  pressure:    { field: "pressure_bar",       min: 60,  max: 160  },
  water:       { field: "water_level_meters", min: 5.0, max: 15.0 },
  voltage:     { field: "voltage_supply_v",   min: 229, max: 231  },
  humidity:    { field: "humidity_percent",   min: 40,  max: 80   },
} as const;

type SensorName = keyof typeof SENSOR_FIELDS;

export function validateSensorData(filename: string, record: SensorRecord): ValidationResult {
  const activeTypes = record.sensor_type.split("/") as SensorName[];

  for (const type of activeTypes) {
    if (!(type in SENSOR_FIELDS)) {
      return { filename, record, error: `Unknown sensor type: "${type}"` };
    }
  }

  for (const [type, { field, min, max }] of Object.entries(SENSOR_FIELDS) as [SensorName, { field: keyof SensorRecord, min: number, max: number }][]) {
    const value = record[field] as number;
    const isActive = activeTypes.includes(type);

    if (isActive) {
      if (value < min || value > max) {
        return { filename, record, error: `${field} value ${value} out of range [${min}, ${max}]` };
      }
    } else {
      if (value !== 0) {
        return { filename, record, error: `${field} should be 0 for sensor_type "${record.sensor_type}", got ${value}` };
      }
    }
  }

  return { filename, record, error: null };
}

const NEGATIVE_PATTERNS = /\b(wrong|bad|error|fault|fail(ed|ure)?|broken|damag(e|ed)|defect(ive)?|anomal(y|ous)|abnormal|irregular|unusual|unstable|instabilit|exceed(s|ed)?|too (high|low)|out of range|outside (range|normal)|spike(d|s)?|alert|alarm|warning|critical|concern(ing)?|problem|issue|incorrect|inaccurate|malfunction(ing)?|off|corrupt(ed)?|mismatch|discrepan(cy|t))\b/i;

export function hasNegativeNote(note: string): boolean {
  return NEGATIVE_PATTERNS.test(note);
}

export async function validateSensorDataFiles(filesDir: string): Promise<ValidationResult[]> {
  const filenames = (await readdir(filesDir)).filter(f => f.endsWith(".json"));

  return Promise.all(
    filenames.map(async (filename) => {
      const raw = await readFile(join(filesDir, filename), "utf-8");
      const record = JSON.parse(raw) as SensorRecord;
      return validateSensorData(filename, record);
    })
  );
}
