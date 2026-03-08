import "server-only";
import { readCachedCommunityMeasurements, readCachedCommunitySensors } from "@/lib/data/community-cache";

export async function getCommunityAirSensors() {
  const cached = await readCachedCommunitySensors();
  return cached ?? [];
}

export async function getCommunityAirMeasurements() {
  const cached = await readCachedCommunityMeasurements();
  return cached ?? [];
}
