import "server-only";
import { access, readFile } from "node:fs/promises";
import { constants } from "node:fs";
import { resolve } from "node:path";
import type { CommunityAirMeasurementRecord, CommunityAirSensorRecord } from "@/lib/types";

const cacheDir = resolve(process.cwd(), "data", "cache", "community");

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

export function readCachedCommunitySensors() {
  return readCacheFile<CommunityAirSensorRecord[]>("sensors.json");
}

export function readCachedCommunityMeasurements() {
  return readCacheFile<CommunityAirMeasurementRecord[]>("measurements.json");
}
