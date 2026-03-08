import "server-only";
import { readCachedMobilityEvents } from "@/lib/data/official-cache";

export async function getMobilityEvents() {
  const cached = await readCachedMobilityEvents();
  return cached ?? [];
}
