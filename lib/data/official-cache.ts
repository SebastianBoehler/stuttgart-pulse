import "server-only";
import { access, readFile } from "node:fs/promises";
import { constants } from "node:fs";
import { resolve } from "node:path";
import type {
  AirQualityMeasurementRecord,
  AirQualityStationRecord,
  DistrictFeatureCollection,
  MobilityEventRecord,
  ParkingSiteRecord,
  TransitStopRecord,
} from "@/lib/types";

const cacheDir = resolve(process.cwd(), "data", "cache", "official");

async function readCacheFile<T>(fileName: string) {
  const filePath = resolve(cacheDir, fileName);

  try {
    await access(filePath, constants.F_OK);
    const contents = await readFile(filePath, "utf8");
    return JSON.parse(contents) as T;
  } catch {
    return null;
  }
}

export function readCachedDistricts() {
  return readCacheFile<DistrictFeatureCollection>("districts.json");
}

export function readCachedStations() {
  return readCacheFile<AirQualityStationRecord[]>("stations.json");
}

export function readCachedMeasurements() {
  return readCacheFile<AirQualityMeasurementRecord[]>("measurements.json");
}

export function readCachedMobilityEvents() {
  return readCacheFile<MobilityEventRecord[]>("mobility-events.json");
}

export function readCachedParkingSites() {
  return readCacheFile<ParkingSiteRecord[]>("parking-sites.json");
}

export function readCachedTransitStops() {
  return readCacheFile<TransitStopRecord[]>("transit-stops.json");
}
