import "server-only";
import { readCachedMeasurements, readCachedStations } from "@/lib/data/official-cache";

export async function getAirQualityStations() {
  const cached = await readCachedStations();
  return cached ?? [];
}

export async function getAirQualityMeasurements() {
  const cached = await readCachedMeasurements();
  return cached ?? [];
}
