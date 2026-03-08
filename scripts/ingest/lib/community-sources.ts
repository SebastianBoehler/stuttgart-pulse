import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import { point } from "@turf/helpers";
import type {
  CommunityAirMeasurementRecord,
  CommunityAirSensorRecord,
  DistrictFeatureCollection,
} from "../../../lib/types";

const COMMUNITY_URL = "https://data.sensor.community/airrohr/v1/filter/area=48.70,9.00,48.86,9.33";
const cacheDir = resolve(process.cwd(), "data", "cache", "community");
const officialDistrictCachePath = resolve(process.cwd(), "data", "cache", "official", "districts.json");

type SourceManifest = {
  fetchedAt: string;
  counts: {
    sensors: number;
    measurements: number;
  };
  source: string;
};

type CommunitySnapshot = {
  sensors: CommunityAirSensorRecord[];
  measurements: CommunityAirMeasurementRecord[];
  manifest: SourceManifest;
};

type SensorCommunityRow = {
  timestamp?: string;
  sensor?: { id?: number | string };
  location?: { latitude?: string; longitude?: string; id?: number | string };
  sensordatavalues?: Array<{ value_type?: string; value?: string }>;
};

async function loadDistricts() {
  try {
    const contents = await readFile(officialDistrictCachePath, "utf8");
    return JSON.parse(contents) as DistrictFeatureCollection;
  } catch (error) {
    throw new Error(
      `Official district cache is required before syncing community data. Run ingest:official first. ${error instanceof Error ? error.message : ""}`.trim(),
    );
  }
}

function findDistrictId(districts: DistrictFeatureCollection, longitude: number, latitude: number) {
  const location = point([longitude, latitude]);
  const match = districts.features.find((feature) => booleanPointInPolygon(location, feature));
  return match?.properties.id ?? districts.features[0]?.properties.id ?? "stuttgart";
}

function toTimestamp(value: string) {
  return new Date(value.replace(" ", "T") + "Z").toISOString();
}

function toNumeric(value: string | undefined) {
  if (!value) {
    return null;
  }

  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

export async function fetchCommunitySnapshot() {
  const districts = await loadDistricts();
  const response = await fetch(COMMUNITY_URL, {
    headers: {
      "User-Agent": "stuttgart-pulse/0.1.0",
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch Sensor.Community data: ${response.status} ${response.statusText}`);
  }

  const payload = (await response.json()) as SensorCommunityRow[];
  const sensors = new Map<string, CommunityAirSensorRecord>();
  const measurements = new Map<string, CommunityAirMeasurementRecord>();

  payload.forEach((row) => {
    const sensorId = row.sensor?.id ? String(row.sensor.id) : "";
    const latitude = toNumeric(row.location?.latitude);
    const longitude = toNumeric(row.location?.longitude);
    const timestamp = row.timestamp ? toTimestamp(row.timestamp) : null;

    if (!sensorId || latitude === null || longitude === null || !timestamp) {
      return;
    }

    const particulateValues = (row.sensordatavalues ?? []).filter(
      (entry) => entry.value_type === "P1" || entry.value_type === "P2",
    );

    if (particulateValues.length === 0) {
      return;
    }

    sensors.set(sensorId, {
      id: sensorId,
      name: `Sensor ${sensorId}`,
      districtId: findDistrictId(districts, longitude, latitude),
      latitude,
      longitude,
      source: "Sensor.Community",
    });

    particulateValues.forEach((entry) => {
      const numericValue = toNumeric(entry.value);
      if (numericValue === null || !entry.value_type) {
        return;
      }

      const pollutant = entry.value_type === "P2" ? "PM2.5" : "PM10";
      const id = `${sensorId}-${pollutant}-${timestamp}`;

      measurements.set(id, {
        id,
        sensorId,
        timestamp,
        pollutant,
        value: Number(numericValue.toFixed(2)),
        unit: "µg/m³",
      });
    });
  });

  return {
    sensors: [...sensors.values()].sort((left, right) => left.name.localeCompare(right.name)),
    measurements: [...measurements.values()].sort(
      (left, right) => new Date(left.timestamp).getTime() - new Date(right.timestamp).getTime(),
    ),
    manifest: {
      fetchedAt: new Date().toISOString(),
      counts: {
        sensors: sensors.size,
        measurements: measurements.size,
      },
      source: COMMUNITY_URL,
    },
  } satisfies CommunitySnapshot;
}

export async function fetchAndCacheCommunitySnapshot() {
  const snapshot = await fetchCommunitySnapshot();

  await mkdir(cacheDir, { recursive: true });
  await Promise.all([
    writeFile(resolve(cacheDir, "sensors.json"), JSON.stringify(snapshot.sensors, null, 2), "utf8"),
    writeFile(resolve(cacheDir, "measurements.json"), JSON.stringify(snapshot.measurements, null, 2), "utf8"),
    writeFile(resolve(cacheDir, "manifest.json"), JSON.stringify(snapshot.manifest, null, 2), "utf8"),
  ]);

  return snapshot;
}
