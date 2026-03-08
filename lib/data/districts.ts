import "server-only";
import type { DistrictFeatureCollection } from "@/lib/types";
import { readCachedDistricts } from "@/lib/data/official-cache";

export async function getDistricts() {
  const emptyCollection: DistrictFeatureCollection = {
    type: "FeatureCollection",
    features: [],
  };

  const cached = await readCachedDistricts();
  return cached ?? emptyCollection;
}
